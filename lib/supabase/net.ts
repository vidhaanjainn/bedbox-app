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
//   2. Data and login calls go through our OWN domain first (/sb/*, rewritten
//      to Supabase by Vercel - see next.config.ts). The phone then only ever
//      needs to reach app.thebedbox.in - the one site it must reach anyway to
//      open the app. Some Indian ISPs block or throttle *.supabase.co; that no
//      longer matters. (2026-11-06: was direct-first with /sb as a backup,
//      which meant a 12s stall + amber banner every time supabase.co flaked.)
//   3. If the main route fails at the network level, the request is retried
//      on the other route and that choice is remembered for 30 minutes.
//      Neither route can strand a user whose other route works.
//      File uploads/downloads (/storage/v1/) stay direct-first: large bodies
//      shouldn't take an extra hop, and onboarding has its own server fallback.
//   4. Writes are never silently re-sent after a failure (a retry could
//      double-save a payment); reads and auth calls are retried once on the
//      other route, writes surface an error and use the working route next time.
//   5. The UI is told (window event "bb:net") so it can show a banner when
//      the database truly can't be reached.

const DIRECT = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const AVOID_KEY = 'bb-sb-avoid'
const AVOID_TTL_MS = 30 * 60 * 1000
const PRIMARY_TIMEOUT_MS = 20000
const FALLBACK_TIMEOUT_MS = 20000

type Route = 'direct' | 'proxy'
export type NetState = 'ok' | 'degraded' | 'down'
export type NetDetail = { state: NetState; route: Route; message?: string }

export function emitNet(detail: NetDetail) {
  try { window.dispatchEvent(new CustomEvent<NetDetail>('bb:net', { detail })) } catch {}
}

const isStorage = (url: string) => url.includes('/storage/v1/')
const primaryFor = (url: string): Route => (isStorage(url) ? 'direct' : 'proxy')
const otherRoute = (r: Route): Route => (r === 'proxy' ? 'direct' : 'proxy')

function avoided(): Route | null {
  try {
    const raw = localStorage.getItem(AVOID_KEY)
    if (!raw) return null
    const { route, at } = JSON.parse(raw)
    if ((route === 'proxy' || route === 'direct') && Date.now() - at < AVOID_TTL_MS) return route
  } catch {}
  return null
}

function avoid(route: Route | null) {
  try {
    if (!route) localStorage.removeItem(AVOID_KEY)
    else localStorage.setItem(AVOID_KEY, JSON.stringify({ route, at: Date.now() }))
  } catch {}
}

function routeFor(url: string): Route {
  const primary = primaryFor(url)
  return avoided() === primary ? otherRoute(primary) : primary
}

// Route currently used for data/login calls (the status page shows it).
export function getRoute(): Route { return routeFor(DIRECT + '/rest/v1/') }

// Force a route for data/login calls: 'proxy' (the normal one) clears any
// remembered failure; 'direct' avoids our domain for the next 30 minutes.
export function setRoute(route: Route) { avoid(route === 'proxy' ? null : 'proxy') }

export function toProxyUrl(url: string) {
  return url.startsWith(DIRECT) ? `${window.location.origin}/sb${url.slice(DIRECT.length)}` : url
}

const urlOn = (route: Route, url: string) => (route === 'proxy' ? toProxyUrl(url) : url)

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
  const route = routeFor(url)
  const other = otherRoute(route)

  let failure: unknown
  try {
    const res = await withTransientRetry(() => attempt(urlOn(route, url), init, PRIMARY_TIMEOUT_MS), retryable)
    // A 502-504 from our own domain after retries means Vercel could not reach
    // Supabase for us - worth trying the direct route for reads.
    if (!(route === 'proxy' && isGatewayFailure(res) && retryable)) {
      if (avoided() === route) avoid(null)
      emitNet({ state: 'ok', route })
      return res
    }
    failure = new Error(`Our server could not reach the database (HTTP ${res.status})`)
  } catch (e) {
    if (e instanceof CallerAbort) throw e
    failure = e
  }

  // The route we just tried is not working: use the other one for a while.
  avoid(route)
  if (!retryable) {
    emitNet({ state: 'down', route: other, message: 'A change could not be sent. Nothing was saved - please try again.' })
    throw failure
  }
  try {
    const res = await attempt(urlOn(other, url), init, FALLBACK_TIMEOUT_MS)
    emitNet({ state: 'ok', route: other })
    return res
  } catch (e) {
    if (e instanceof CallerAbort) throw e
    avoid(null)
    emitNet({ state: 'down', route, message: e instanceof Error ? e.message : 'Could not reach the database' })
    throw e
  }
}
