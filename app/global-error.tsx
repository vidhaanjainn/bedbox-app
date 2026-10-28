'use client'

// Last-resort screen for a crash in the root layout itself (error.tsx cannot
// catch those). Must render its own <html>/<body>.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#070d1a', color: '#e8eaf0', fontFamily: '-apple-system, system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, margin: '0 0 10px' }}>TheBedBox hit a problem</h2>
          <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 340, lineHeight: 1.5, margin: '0 0 18px' }}>Your data is safe. Try again, or reload.</p>
          <div>
            <button onClick={() => unstable_retry()} style={{ padding: '12px 20px', borderRadius: 12, border: 0, fontWeight: 700, background: '#00d4c8', color: '#04120f', margin: 6 }}>Try again</button>
            <button onClick={() => window.location.reload()} style={{ padding: '12px 20px', borderRadius: 12, border: 0, fontWeight: 700, background: 'rgba(255,255,255,.1)', color: '#e8eaf0', margin: 6 }}>Reload</button>
          </div>
          <p style={{ fontSize: 11, opacity: 0.4, marginTop: 14, maxWidth: 340, wordBreak: 'break-word' }}>{error.message}</p>
        </div>
      </body>
    </html>
  )
}
