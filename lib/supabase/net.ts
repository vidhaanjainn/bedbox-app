// Browser-side network layer for every Supabase call.
//
// Why this exists: the admin app used to hang forever (black screen, endless
// "Loading dashboard...", login spinner that never ends) whenever the browser
// could not complete a request to *.supabase.co - blocked by an ISP/DNS/
// extension, a dropped connection, a stuck request. A plain fetch has no
// timeout, so nothing ever failed visibly and nothing ever recovered.
//
// Guarantees:
//   1. Every request ends: it either succeeds or fails with a clear error.
//   2. If the direct route to Supabase fails at the network level, requests
//      move to a same-origin route (/sb/*, rewritten to Supabase by Vercel -
//      see next.config.ts), which only needs the browser to reach our own
//      site. The choice is remembered for 30 minutes, then direct is retried.
//   3. If the backup route itself fails, we go back to direct. Neither route
//      can strand a user whose other route works.
//   4. Writes are never silently re-sent after a failure (a retry could
//      double-save a payment); reads and auth calls are retried once on the
//      other route, writes surface an error and use the working route next time.
//   5. The UI is told (window event "bb:net") so it can show a banner.

const DIRECT = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const ROUTE_KEY = 'bb-sb-route'
const PROXY_TTL_MS = 30 * 60 * 1000
const DIRECT_TIMEOUT_MS = 12000
const PROXY_TIMEOUT_MS = 25000

export type NetState = 'ok' | 'degraded' | 'down'
export type NetDetail = { state: NetState; route: 'direct' | 'proxy'; message?: string }

export function emitNet(detail: NetDetail) {
  try { window.dispatchEvent(new CustomEvent<NetDetail>('bb:net', { detail })) } catch {}
}

export function getRoute(): 'direct' | 'proxy' {
  try {
    const raw = localStorage.getItem(ROUTE_KEY)
    if (!raw) return 'direct'
    const { route, at } = JSON.parse(raw)
    if (route === 'proxy' && Date.now() - at < PROXY_TTL_MS) return 'proxy'
  } catch {}
  return 'direct'
}

export function setRoute(route: 'direct' | 'proxy') {
  try {
    if (route === 'direct') localStorage.removeItem(ROUTE_KEY)
    else localStorage.setItem(ROUTE_KEY, JSON.stringify({ route, at: Date.now() }))
  } catch {}
}

export function toProxyUrl(url: string) {
  return url.startsWith(DIRECT) ? `${window.location.origin}/sb${url.slice(DIRECT.length)}` : url
}

class CallerAbort extends Error {}

async function attempt(url: string, init: RequestInit | undefined, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const caller = init?.signal
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; ctrl.abort() }, ms)
  const onCallerAbort = () => ctrl.abort()
  if (caller) {
    if (caller.aborted) ctrl.abort()
    else caller.addEventListener('abort', onCallerAbort, { once: true })
  }
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    if (caller?.aborted && !timedOut) throw new CallerAbort()
    throw e instanceof Error && !timedOut ? e : new Error(timedOut ? `Request timed out after ${ms / 1000}s` : 'Failed to fetch')
  } finally {
    clearTimeout(timer)
    caller?.removeEventListener('abort', onCallerAbort)
  }
}

const isGatewayFailure = (r: Response) => r.status >= 502 && r.status <= 504

// The database host stalls now and then (statement timeouts come back as 500,
// restarts as 502-504). Reads are safe to repeat, so ride through short stalls
// with two quick retries instead of showing an error or empty data.
const TRANSIENT = new Set([500, 502, 503, 504])
async function withTransientRetry(run: () => Promise<Response>, retryable: boolean) {
  let res = await run()
  for (const wait of [700, 1800]) {
    if (!retryable || !TRANSIENT.has(res.status)) break
    await new Promise(r => setTimeout(r, wait))
    res = await run()
  }
  return res
}

export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window === 'undefined') return fetch(input, init)
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : ''
  if (!DIRECT || !url.startsWith(DIRECT)) return fetch(input, init)

  const method = (init?.method || 'GET').toUpperCase()
  const retryable = method === 'GET' || method === 'HEAD' || url.includes('/auth/v1/')
  const route = getRoute()

  const first = route === 'proxy' ? toProxyUrl(url) : url
  const second = route === 'proxy' ? url : toProxyUrl(url)
  const firstMs = route === 'proxy' ? PROXY_TIMEOUT_MS : DIRECT_TIMEOUT_MS
  const secondMs = route === 'proxy' ? DIRECT_TIMEOUT_MS : PROXY_TIMEOUT_MS
  const other: 'direct' | 'proxy' = route === 'proxy' ? 'direct' : 'proxy'

  let failure: unknown
  try {
    const res = await withTransientRetry(() => attempt(first, init, firstMs), retryable)
    if (!(route === 'proxy' && isGatewayFailure(res) && retryable)) {
      if (route === 'proxy') emitNet({ state: 'degraded', route })
      else emitNet({ state: 'ok', route })
      return res
    }
    failure = new Error(`Backup route returned ${res.status}`)
  } catch (e) {
    if (e instanceof CallerAbort) throw e
    failure = e
  }

  // The route we just tried is not working: switch for next time.
  setRoute(other)
  if (!retryable) {
    emitNet({ state: 'down', route: other, message: 'A change could not be sent. Nothing was saved - please try again.' })
    throw failure
  }
  try {
    const res = await attempt(second, init, secondMs)
    emitNet({ state: other === 'proxy' ? 'degraded' : 'ok', route: other })
    return res
  } catch (e) {
    if (e instanceof CallerAbort) throw e
    setRoute('direct')
    emitNet({ state: 'down', route, message: e instanceof Error ? e.message : 'Could not reach the database' })
    throw e
  }
}
