import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Without this, a shared app.thebedbox.in link (which residents get sent
// regularly - the portal login, an onboarding invite) fell back to
// whatever WhatsApp/iMessage could scrape on their own, which turned out
// to be a plain black box with a bare white triangle - not a great first
// impression for a link residents are handed as "here's how you log in."
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#070d1a',
          position: 'relative',
        }}
      >
        <div style={{
          position: 'absolute', top: -100, right: -100, width: 420, height: 420,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,200,0.25), transparent 70%)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{
            width: 88, height: 88, borderRadius: 20,
            background: 'linear-gradient(135deg,#00d4c8,#0099ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 48, fontWeight: 700, color: '#070d1a',
          }}>
            B
          </div>
          <span style={{ fontSize: 68, fontWeight: 700, color: 'white' }}>TheBedBox</span>
        </div>
        <p style={{ fontSize: 30, color: 'rgba(255,255,255,0.55)', marginTop: 22 }}>
          Property Management, Simplified
        </p>
      </div>
    ),
    { ...size }
  )
}
