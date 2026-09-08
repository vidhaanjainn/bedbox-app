'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { onInstallPromptCaptured, clearCapturedInstallPrompt } from '@/lib/pwaInstall'
import { APP_URL } from '@/lib/config'

// Full step-by-step install tutorial, same approach as 75 Smart's
// InstallAppButton: detect the exact browser/OS combination (since iOS
// alone splits into Safari, Chrome, Firefox, Edge - each with a different
// menu location and no shared install API) and show that one exact path,
// with an animated arrow pointing at the real on-screen button to tap,
// instead of a generic "check your browser's menu" that half of visitors
// can't actually find.

type Platform =
  | 'checking' | 'installed' | 'chromium'
  | 'ios-safari' | 'ios-chrome' | 'ios-firefox' | 'ios-edge' | 'ios-other'
  | 'android-other' | 'desktop'

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent)
}
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

// Every iOS browser reports "iPhone/iPad" and even carries a legacy
// "Safari/..." token for compatibility, so plain Safari can only be told
// apart by the ABSENCE of every other browser's own token - checked first.
function detectIOSBrowser(): 'safari' | 'chrome' | 'firefox' | 'edge' | 'other' {
  const ua = navigator.userAgent
  if (/CriOS/i.test(ua)) return 'chrome'
  if (/FxiOS/i.test(ua)) return 'firefox'
  if (/EdgiOS/i.test(ua)) return 'edge'
  if (/OPiOS|UCBrowser/i.test(ua)) return 'other'
  return 'safari'
}

function androidBrowserName(): string {
  const ua = navigator.userAgent
  if (/firefox/i.test(ua)) return 'Firefox'
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet'
  if (/edga/i.test(ua)) return 'Edge'
  if (/opr\//i.test(ua)) return 'Opera'
  return 'your browser'
}

function detectFallbackPlatform(): Platform {
  if (isIOS()) {
    const b = detectIOSBrowser()
    if (b === 'chrome') return 'ios-chrome'
    if (b === 'firefox') return 'ios-firefox'
    if (b === 'edge') return 'ios-edge'
    if (b === 'other') return 'ios-other'
    return 'ios-safari'
  }
  if (isAndroid()) return 'android-other'
  return 'desktop'
}

// Pinned to the real screen corner via `position: fixed` + safe-area-inset,
// not aligned relative to the card - a corner is a corner, nothing here
// can drift out of place the way matching two independently-sized boxes'
// edges against each other can.
function CornerPointer({ corner }: { corner: 'top-right' | 'bottom-right' }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: corner === 'top-right' ? 'max(env(safe-area-inset-top, 0px), 10px)' : undefined,
        bottom: corner === 'bottom-right' ? 'max(env(safe-area-inset-bottom, 0px), 10px)' : undefined,
        // Chrome's Share icon sits right at the top edge - Safari's bottom
        // toolbar keeps its "..." noticeably further from the true edge,
        // so it needs a bigger inset to land on it rather than past it.
        right: corner === 'top-right' ? 'max(env(safe-area-inset-right, 0px), 10px)' : 'max(env(safe-area-inset-right, 0px), 36px)',
        zIndex: 210, width: 44, height: 44, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, fontWeight: 900, color: '#00d4c8', lineHeight: 1,
        animation: corner === 'top-right' ? 'bbPointerUp 1.1s ease-in-out infinite' : 'bbPointerDown 1.1s ease-in-out infinite',
      }}
    >
      {corner === 'top-right' ? '↑' : '↓'}
    </div>
  )
}

function AddToHomeScreenRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', marginTop: 14 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, border: '1.5px solid #00d4c8', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#00d4c8',
      }}>
        +
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left' }}>Add to Home Screen</div>
    </div>
  )
}

export default function InstallGuideSheet({ open, onClose, onInstalled }: { open: boolean; onClose: () => void; onInstalled?: () => void }) {
  const [platform, setPlatform] = useState<Platform>('checking')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (!open) return
    if (isStandalone()) { setPlatform('installed'); onInstalled?.(); return }

    const unsub = onInstallPromptCaptured((e) => {
      setDeferredPrompt(e)
      setPlatform('chromium')
    })
    // Give Chrome a moment to have already captured beforeinstallprompt
    // before falling back to a device/browser-based guess.
    const timer = setTimeout(() => {
      setPlatform((p) => (p === 'checking' ? detectFallbackPlatform() : p))
    }, 400)

    return () => { unsub(); clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const handleInstallClick = async () => {
    if (platform === 'chromium' && deferredPrompt) {
      deferredPrompt.prompt()
      try {
        const choice = await deferredPrompt.userChoice
        if (choice.outcome === 'accepted') { onInstalled?.(); onClose(); return }
      } catch { /* dismissed - leave the sheet open */ }
      clearCapturedInstallPrompt()
      setDeferredPrompt(null)
    }
  }

  // Chrome's Share icon sits at the top next to the address bar; Safari's
  // compact toolbar has no separate Share icon - the bottom-right "..." is
  // the real tap target.
  const corner: 'top-right' | 'bottom-right' | null =
    platform === 'ios-chrome' ? 'top-right' : platform === 'ios-safari' ? 'bottom-right' : null

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

          {platform === 'checking' && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>Checking your browser...</div>
          )}

          {platform === 'installed' && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>Already installed - you're all set. ✓</div>
          )}

          {platform === 'chromium' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 18 }}>
                Your browser can install this app directly - no extra steps needed.
              </div>
              <button onClick={handleInstallClick} className="bb-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Install App
              </button>
            </>
          )}

          {platform === 'ios-chrome' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                You're on Chrome
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Tap the <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Share icon</span> at the top-right of your screen, next to the address bar (see the arrow).
              </div>
              <AddToHomeScreenRow />
            </>
          )}

          {platform === 'ios-safari' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                You're on Safari
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Tap <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>⋯</span> at the bottom-right of your screen (see the arrow), then find <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Add to Home Screen</span> (directly, or under Share).
              </div>
              <AddToHomeScreenRow />
            </>
          )}

          {(platform === 'ios-firefox' || platform === 'ios-edge' || platform === 'ios-other') && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                You're on {platform === 'ios-firefox' ? 'Firefox' : platform === 'ios-edge' ? 'Edge' : 'this browser'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, textAlign: 'left' }}>
                {platform === 'ios-firefox' && <>1. Tap the <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>≡</span> menu, then <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Share</span></>}
                {platform === 'ios-edge' && <>1. Tap the <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>⋯</span> menu, then <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Share</span></>}
                {platform === 'ios-other' && <>1. Open this browser's share or menu option</>}
              </div>
              <AddToHomeScreenRow />
            </>
          )}

          {platform === 'android-other' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                You're on {androidBrowserName()}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, textAlign: 'left' }}>
                1. Open {androidBrowserName()}'s menu<br />
                2. Tap <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>"Add to Home Screen"</span> or <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>"Install app"</span>
              </div>
            </>
          )}

          {platform === 'desktop' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>Scan this on your phone to get the app</div>
              <div style={{ background: '#fff', borderRadius: 14, padding: 12, display: 'inline-block', marginBottom: 14 }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${APP_URL}/portal`)}`}
                  alt="QR code that opens the TheBedBox resident portal on your phone"
                  width={180} height={180}
                  style={{ display: 'block' }}
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Point your phone's camera at this, then add it to your home screen from there.
              </div>
            </>
          )}
        </div>
      </div>
      {corner && <CornerPointer corner={corner} />}
      <style>{`
        @keyframes bbPointerUp { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes bbPointerDown { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
      `}</style>
    </>
  )
}
