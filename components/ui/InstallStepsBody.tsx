'use client'

import { APP_URL } from '@/lib/config'
import { InstallPlatform, androidBrowserName } from '@/lib/useInstallPlatform'

// The actual per-platform instructions, shared between InstallGuideSheet
// (a standalone popup) and the post-approval welcome walkthrough (one step
// inside a bigger wizard) - same content, different wrapper.

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

// Pinned to the real screen corner via `position: fixed` + safe-area-inset -
// a corner is a corner, nothing here can drift out of place.
export function InstallCornerPointer({ corner }: { corner: 'top-right' | 'bottom-right' }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: corner === 'top-right' ? 'max(env(safe-area-inset-top, 0px), 10px)' : undefined,
        bottom: corner === 'bottom-right' ? 'max(env(safe-area-inset-bottom, 0px), 10px)' : undefined,
        right: corner === 'top-right' ? 'max(env(safe-area-inset-right, 0px), 10px)' : 'max(env(safe-area-inset-right, 0px), 36px)',
        zIndex: 210, width: 44, height: 44, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, fontWeight: 900, color: '#00d4c8', lineHeight: 1,
        animation: corner === 'top-right' ? 'bbPointerUp 1.1s ease-in-out infinite' : 'bbPointerDown 1.1s ease-in-out infinite',
      }}
    >
      {corner === 'top-right' ? '↑' : '↓'}
      <style>{`
        @keyframes bbPointerUp { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes bbPointerDown { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
      `}</style>
    </div>
  )
}

export function installCorner(platform: InstallPlatform): 'top-right' | 'bottom-right' | null {
  // Chrome's Share icon sits at the top next to the address bar; Safari's
  // compact toolbar has no separate Share icon - the bottom-right "..." is
  // the real tap target.
  if (platform === 'ios-chrome') return 'top-right'
  if (platform === 'ios-safari') return 'bottom-right'
  return null
}

export function InstallStepsBody({ platform, onInstallClick }: { platform: InstallPlatform; onInstallClick: () => void }) {
  return (
    <>
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
          <button onClick={onInstallClick} className="bb-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
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
    </>
  )
}
