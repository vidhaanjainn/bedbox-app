import { NextResponse } from 'next/server'

// Server-side health probe of the parts of Supabase the app depends on
// (Auth + the REST/PostgREST data API), as seen from our own servers.
// Returns 503 when either is down so uptime monitors can just check the HTTP
// status. Public and read-only: no secrets, only status and timings.
export const dynamic = 'force-dynamic'

async function probe(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const t = Date.now()
  if (!base || !key) return { ok: false, status: 0, ms: 0, error: 'not configured' }
  try {
    const r = await fetch(base + path, { headers: { apikey: key }, signal: AbortSignal.timeout(8000), cache: 'no-store' })
    return { ok: r.ok, status: r.status, ms: Date.now() - t }
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t, error: e instanceof Error ? e.name : 'error' }
  }
}

export async function GET() {
  const [auth, data] = await Promise.all([probe('/auth/v1/health'), probe('/rest/v1/rooms?select=id&limit=1')])
  const ok = auth.ok && data.ok
  return NextResponse.json({ ok, auth, data, at: new Date().toISOString() }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
