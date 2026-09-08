'use client'

import { X } from 'lucide-react'
import { useInstallPlatform } from '@/lib/useInstallPlatform'
import { InstallStepsBody, InstallCornerPointer, installCorner } from '@/components/ui/InstallStepsBody'

// Full step-by-step install tutorial, same approach as 75 Smart's
// InstallAppButton: detect the exact browser/OS combination (since iOS
// alone splits into Safari, Chrome, Firefox, Edge - each with a different
// menu location and no shared install API) and show that one exact path,
// with an animated arrow pointing at the real on-screen button to tap,
// instead of a generic "check your browser's menu" that half of visitors
// can't actually find.
export default function InstallGuideSheet({ open, onClose, onInstalled }: { open: boolean; onClose: () => void; onInstalled?: () => void }) {
  const { platform, triggerNativeInstall } = useInstallPlatform(open)

  if (!open) return null

  const handleInstallClick = async () => {
    const outcome = await triggerNativeInstall()
    if (outcome === 'accepted') { onInstalled?.(); onClose() }
  }

  const corner = installCorner(platform)

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }} onClick={onClose}>
        <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '380px', padding: '28px', textAlign: 'center', animation: 'fadeIn 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
            <button onClick={onClose} className="bb-icon-btn" aria-label="Close" style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}><X size={16} /></button>
          </div>

          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '19px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>
            Follow the steps to install the app
          </h2>

          <InstallStepsBody platform={platform} onInstallClick={handleInstallClick} />
        </div>
      </div>
      {corner && <InstallCornerPointer corner={corner} />}
    </>
  )
}
