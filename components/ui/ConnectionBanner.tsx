'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { WifiOff, ShieldAlert } from 'lucide-react'
import type { NetDetail } from '@/lib/supabase/net'

// Shows what the network layer (lib/supabase/net.ts) is doing, so a failure
// is never silent: red when the database can't be reached at all (data on
// screen may be missing or stale), amber while running on the backup route.
export default function ConnectionBanner() {
  const [net, setNet] = useState<NetDetail | null>(null)

  useEffect(() => {
    const onNet = (e: Event) => setNet((e as CustomEvent<NetDetail>).detail)
    window.addEventListener('bb:net', onNet)
    return () => window.removeEventListener('bb:net', onNet)
  }, [])

  if (!net || net.state === 'ok') return null
  const down = net.state === 'down'

  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      padding: '10px 16px', fontSize: 13,
      background: down ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.10)',
      borderBottom: `1px solid ${down ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.3)'}`,
      color: down ? '#fca5a5' : '#fcd34d',
    }}>
      {down ? <WifiOff size={16} /> : <ShieldAlert size={16} />}
      <span style={{ flex: 1, minWidth: 200 }}>
        {down
          ? <>Can&apos;t reach the database{net.message ? ` (${net.message})` : ''}. What you see may be missing or out of date.</>
          : <>Direct connection is blocked or slow on this network - using the backup route. Everything still works.</>}
      </span>
      {down && <button onClick={() => window.location.reload()} className="bb-btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>Retry</button>}
      <Link href="/status" style={{ fontSize: 12, textDecoration: 'underline', color: 'inherit' }}>Connection check</Link>
    </div>
  )
}
