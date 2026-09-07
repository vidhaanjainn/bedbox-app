'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const DISMISS_KEY = 'bb_install_prompt_dismissed'

// Android Chrome (and other Chromium browsers) fire `beforeinstallprompt`
// when a site meets PWA installability criteria - this captures that event
// and shows our own banner instead of relying on Chrome's subtle default
// omnibox icon. iOS Safari has no equivalent API (Apple requires the
// manual Share -> Add to Home Screen flow), so this is a no-op there.
export default function InstallPrompt({ dark = true }: { dark?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    deferredPrompt.prompt()
    try { await deferredPrompt.userChoice } catch {}
    setInstalling(false)
    setVisible(false)
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  const colors = dark
    ? { bg: 'rgba(0,212,200,0.06)', border: 'rgba(0,212,200,0.2)', text: '#e8eaf0', muted: 'rgba(255,255,255,0.5)' }
    : { bg: 'var(--surface-1)', border: 'var(--border)', text: 'var(--text-primary)', muted: 'var(--text-muted)' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, marginBottom: 16, background: colors.bg, border: `1px solid ${colors.border}` }}>
      <Download size={18} color="#00d4c8" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>Install this app</div>
        <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Add it to your home screen for one-tap access.</div>
      </div>
      <button onClick={install} disabled={installing}
        style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#00d4c8,#0099ff)', color: '#070d1a', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {installing ? 'Installing...' : 'Install'}
      </button>
      <button onClick={dismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.muted, flexShrink: 0, padding: 4 }}>
        <X size={16} />
      </button>
    </div>
  )
}
