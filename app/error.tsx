'use client'

// Shown when a page crashes while rendering. Without this a render error leaves
// a blank screen; with it the user sees what happened and can retry.
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, margin: '0 0 10px', color: 'var(--text-primary, #e8eaf0)' }}>Something went wrong on this page</h2>
      <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 360, lineHeight: 1.5, margin: '0 0 18px' }}>Your data is safe. Try again, or reload the app.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => unstable_retry()} className="bb-btn-primary">Try again</button>
        <button onClick={() => window.location.reload()} className="bb-btn-secondary">Reload app</button>
      </div>
      <p style={{ fontSize: 11, opacity: 0.4, marginTop: 14, maxWidth: 360, wordBreak: 'break-word' }}>{error.message}</p>
    </div>
  )
}
