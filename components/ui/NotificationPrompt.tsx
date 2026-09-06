'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { isPushSupported, getNotificationPermission, subscribeToPush } from '@/lib/push-client'

const DISMISS_KEY = 'bb_notif_prompt_dismissed'

// Dismissible banner offering to enable push notifications — shown once per
// browser until enabled or dismissed. Safe no-op on unsupported browsers,
// already-decided permission, or a previous dismissal.
export default function NotificationPrompt({ dark = true }: { dark?: boolean }) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isPushSupported()) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    if (getNotificationPermission() !== 'default') return
    setVisible(true)
  }, [])

  const handleEnable = async () => {
    setLoading(true); setError('')
    let result: { ok: boolean; error?: string }
    try {
      result = await subscribeToPush()
    } catch (err: any) {
      result = { ok: false, error: err?.message || 'Could not enable notifications.' }
    }
    setLoading(false)
    if (!result.ok) { setError(result.error || 'Could not enable notifications.'); return }
    setVisible(false)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  const colors = dark
    ? { bg: 'rgba(0,212,200,0.06)', border: 'rgba(0,212,200,0.2)', text: '#e8eaf0', muted: 'rgba(255,255,255,0.5)' }
    : { bg: 'var(--surface-1)', border: 'var(--border)', text: 'var(--text-primary)', muted: 'var(--text-muted)' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, marginBottom: 16, background: colors.bg, border: `1px solid ${colors.border}` }}>
      <Bell size={18} color="#00d4c8" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>Turn on notifications</div>
        <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Get alerted the moment something needs your attention.</div>
        {error && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>{error}</div>}
      </div>
      <button onClick={handleEnable} disabled={loading}
        style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#00d4c8,#0099ff)', color: '#070d1a', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {loading ? 'Enabling...' : 'Enable'}
      </button>
      <button onClick={handleDismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.muted, flexShrink: 0, padding: 4 }}>
        <X size={16} />
      </button>
    </div>
  )
}
