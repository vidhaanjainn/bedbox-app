'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSessionSafe } from '@/lib/supabase/safe-session'
import { getRoute, setRoute } from '@/lib/supabase/net'

// Connection check: runs real requests from THIS browser and says which part
// is failing - this site, the direct route to the database, the backup route,
// the database itself (as seen from our servers), or the saved login.
type Check = { label: string; state: 'run' | 'ok' | 'fail'; detail: string }

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function timed(url: string, init?: RequestInit, ms = 10000): Promise<{ ok: boolean; status: number; ms: number; error?: string }> {
  const t = Date.now()
  try {
    const r = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(ms) })
    return { ok: r.ok, status: r.status, ms: Date.now() - t }
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t, error: e instanceof Error ? e.name : 'error' }
  }
}

export default function StatusPage() {
  const [checks, setChecks] = useState<Check[]>([])
  const [verdict, setVerdict] = useState('Running checks...')
  const [running, setRunning] = useState(true)

  const run = useCallback(async () => {
    const hdr = { headers: { apikey: KEY } }
    const [server, direct, backup] = await Promise.all([
      timed('/api/health', undefined, 15000),
      timed(`${BASE}/auth/v1/health`, hdr),
      timed(`/sb/auth/v1/health`, hdr),
    ])
    let session: Awaited<ReturnType<typeof getSessionSafe>> = null
    try { session = await getSessionSafe(createClient(), 5000) } catch {}

    const fmt = (r: { ok: boolean; status: number; ms: number; error?: string }) =>
      r.ok ? `${r.ms} ms` : r.status ? `HTTP ${r.status} after ${r.ms} ms` : `${r.error === 'TimeoutError' ? 'no answer' : 'blocked / unreachable'} after ${r.ms} ms`
    const list: Check[] = [
      { label: 'Database, as seen from our servers (Auth + data API)', state: server.ok ? 'ok' : 'fail', detail: fmt(server) },
      { label: 'Direct connection from this device to the database', state: direct.ok ? 'ok' : 'fail', detail: fmt(direct) },
      { label: 'Backup route (through this website)', state: backup.ok ? 'ok' : 'fail', detail: fmt(backup) },
      { label: 'Saved login on this device', state: session ? 'ok' : 'fail', detail: session ? 'signed in' : 'not signed in (or expired)' },
    ]
    setChecks(list)

    if (!server.ok) setVerdict('The database is not answering properly on our side (Supabase is slow or restarting). This is not your device or internet. Wait a few minutes and retry; if it continues, restart the project in Supabase.')
    else if (!direct.ok && backup.ok) { setRoute('proxy'); setVerdict('Your network blocks the direct database route. The app has switched to the backup route and will work normally.') }
    else if (!direct.ok && !backup.ok) setVerdict('This device cannot reach the database at all. Check the internet connection, turn off VPN/ad-blockers, or try mobile data.')
    else if (!session) setVerdict('Everything is reachable. You just need to sign in again.')
    else { if (getRoute() === 'proxy') setRoute('direct'); setVerdict('Everything is working.') }
    setRunning(false)
  }, [])

  useEffect(() => { const id = setTimeout(run, 0); return () => clearTimeout(id) }, [run])

  const report = [verdict, ...checks.map(c => `${c.state.toUpperCase()}  ${c.label}: ${c.detail}`),
    `Browser: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`, `Time: ${new Date().toISOString()}`].join('\n')

  return (
    <div style={{ minHeight: '100vh', background: '#05070a', color: '#f4f7fb', padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, margin: '0 0 6px' }}>Connection check</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 20px' }}>Tests this device&apos;s connection to TheBedBox and its database.</p>

        <div style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 16, fontSize: 14, lineHeight: 1.5,
          background: running ? 'rgba(255,255,255,0.05)' : checks.every(c => c.state === 'ok') ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(255,255,255,0.12)' }}>{verdict}</div>

        {checks.map(c => (
          <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13 }}>
            <span>{c.state === 'ok' ? '✅' : '❌'} {c.label}</span>
            <span style={{ color: 'rgba(255,255,255,0.55)', textAlign: 'right' }}>{c.detail}</span>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <button onClick={() => { setRunning(true); setVerdict('Running checks...'); run() }} disabled={running} className="bb-btn-primary">Run again</button>
          <button onClick={() => navigator.clipboard?.writeText(report)} className="bb-btn-secondary">Copy report</button>
          <Link href="/login" className="bb-btn-secondary">Back to login</Link>
        </div>
      </div>
    </div>
  )
}
