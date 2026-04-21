'use client'

import { useState } from 'react'

type Step = 'form' | 'submitting' | 'done' | 'error'

const ROOM_TYPES = ['Single', 'Double', 'Triple / Dorm']
const DURATIONS  = ['1–2 months', '3–6 months', '6–12 months', '1 year+', 'Not sure yet']

export default function BookingFormPage() {
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    mobile: '',
    altMobile: '',
    email: '',
    roomType: '',
    institution: '',
    course: '',
    duration: '',
    hometown: '',
    message: '',
  })

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const canSubmit =
    form.name.trim().length > 1 &&
    form.mobile.replace(/\D/g, '').length === 10

  const handleSubmit = async () => {
    if (!canSubmit) return
    setStep('submitting')
    setError('')
    try {
      const res = await fetch('/api/booking-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong')
      setStep('done')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setStep('error')
    }
  }

  /* ─── Shared styles ──────────────────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: '8px',
  }
  const focus = (e: React.FocusEvent<any>) => (e.target.style.borderColor = '#00d4c8')
  const blur  = (e: React.FocusEvent<any>) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')

  /* ─── Done screen ────────────────────────────────────────────────── */
  if (step === 'done') return (
    <Shell>
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg,#00d4c8,#0099ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 32,
        }}>✓</div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 26, margin: '0 0 12px', color: '#fff' }}>
          We'll be in touch!
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.7, maxWidth: 300, margin: '0 auto 36px' }}>
          Your inquiry has been received. TheBedBox team will call or WhatsApp you shortly.
        </p>
        <div style={{
          background: 'rgba(0,212,200,0.06)',
          border: '1px solid rgba(0,212,200,0.2)',
          borderRadius: 14, padding: '20px 24px', textAlign: 'left', maxWidth: 300, margin: '0 auto',
        }}>
          <div style={{ fontSize: 11, color: '#00d4c8', marginBottom: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            What happens next
          </div>
          {[
            'We review your inquiry within a few hours',
            'Our team calls / WhatsApps you to discuss',
            'Room confirmed → digital agreement sent',
          ].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
              <span style={{ color: '#00d4c8', fontWeight: 700, fontSize: 11, minWidth: 20, paddingTop: 1 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 32, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
          Questions? Call us at{' '}
          <a href="tel:+917999546362" style={{ color: '#00d4c8' }}>+91 79995 46362</a>
        </p>
      </div>
    </Shell>
  )

  /* ─── Error screen ───────────────────────────────────────────────── */
  if (step === 'error') return (
    <Shell>
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 22, color: '#fff', margin: '0 0 12px' }}>
          Something went wrong
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          {error}
        </p>
        <button
          onClick={() => setStep('form')}
          style={{
            padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#00d4c8,#0099ff)',
            color: '#070d1a', fontWeight: 700, fontSize: 14,
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          Try again
        </button>
        <p style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
          Or call us directly:{' '}
          <a href="tel:+917999546362" style={{ color: '#00d4c8' }}>+91 79995 46362</a>
        </p>
      </div>
    </Shell>
  )

  /* ─── Main form ──────────────────────────────────────────────────── */
  return (
    <Shell>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 28,
          color: '#fff', margin: '0 0 8px', lineHeight: 1.2,
        }}>
          Book a room at<br />
          <span style={{ color: '#00d4c8' }}>TheBedBox</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Fill this form and we'll WhatsApp / call you within a few hours to confirm availability and next steps.
        </p>
      </div>

      {/* Address pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 999,
        background: 'rgba(0,212,200,0.07)', border: '1px solid rgba(0,212,200,0.15)',
        fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 32,
      }}>
        📍 8, Mahabali Nagar, Kolar Road, Bhopal (M.P.)
      </div>

      {/* Form card */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20, padding: '28px 24px',
      }}>

        {/* Section: Contact */}
        <SectionLabel>Your details</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input style={inputStyle} placeholder="Your full name"
              value={form.name} onChange={set('name')} onFocus={focus} onBlur={blur} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Mobile *</label>
              <div style={{ display: 'flex' }}>
                <div style={{
                  padding: '13px 10px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRight: 'none',
                  borderRadius: '12px 0 0 12px', fontSize: 13, color: 'rgba(255,255,255,0.4)',
                  whiteSpace: 'nowrap',
                }}>+91</div>
                <input
                  type="tel" maxLength={10} placeholder="98765 43210"
                  style={{ ...inputStyle, borderRadius: '0 12px 12px 0' }}
                  value={form.mobile} onChange={set('mobile')} onFocus={focus} onBlur={blur}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Alt. Mobile</label>
              <input type="tel" maxLength={10} placeholder="Optional"
                style={inputStyle} value={form.altMobile} onChange={set('altMobile')} onFocus={focus} onBlur={blur} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" placeholder="you@example.com"
              style={inputStyle} value={form.email} onChange={set('email')} onFocus={focus} onBlur={blur} />
          </div>
        </div>

        {/* Section: Stay */}
        <SectionLabel>Stay preference</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          <div>
            <label style={labelStyle}>Room Type Preference</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ROOM_TYPES.map(rt => (
                <button key={rt} type="button"
                  onClick={() => setForm(f => ({ ...f, roomType: rt }))}
                  style={{
                    padding: '9px 16px', borderRadius: 10, border: '1px solid',
                    borderColor: form.roomType === rt ? 'rgba(0,212,200,0.5)' : 'rgba(255,255,255,0.1)',
                    background: form.roomType === rt ? 'rgba(0,212,200,0.1)' : 'rgba(255,255,255,0.03)',
                    color: form.roomType === rt ? '#00d4c8' : 'rgba(255,255,255,0.5)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.15s',
                  }}
                >
                  {rt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Expected Duration</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DURATIONS.map(d => (
                <button key={d} type="button"
                  onClick={() => setForm(f => ({ ...f, duration: d }))}
                  style={{
                    padding: '9px 16px', borderRadius: 10, border: '1px solid',
                    borderColor: form.duration === d ? 'rgba(0,212,200,0.5)' : 'rgba(255,255,255,0.1)',
                    background: form.duration === d ? 'rgba(0,212,200,0.1)' : 'rgba(255,255,255,0.03)',
                    color: form.duration === d ? '#00d4c8' : 'rgba(255,255,255,0.5)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.15s',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section: Background */}
        <SectionLabel>Background</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          <div>
            <label style={labelStyle}>College / Coaching / Company</label>
            <input placeholder="e.g. MANIT, NEET coaching, Infosys"
              style={inputStyle} value={form.institution} onChange={set('institution')} onFocus={focus} onBlur={blur} />
          </div>
          <div>
            <label style={labelStyle}>Course / Program / Role</label>
            <input placeholder="e.g. B.Tech CSE, MBBS, Software Engineer"
              style={inputStyle} value={form.course} onChange={set('course')} onFocus={focus} onBlur={blur} />
          </div>
          <div>
            <label style={labelStyle}>Hometown / Coming from</label>
            <input placeholder="e.g. Jabalpur, Mumbai"
              style={inputStyle} value={form.hometown} onChange={set('hometown')} onFocus={focus} onBlur={blur} />
          </div>
        </div>

        {/* Message */}
        <div style={{ marginBottom: 28 }}>
          <label style={labelStyle}>Anything else you'd like to tell us?</label>
          <textarea
            placeholder="Preferred joining date, budget, any questions..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            value={form.message} onChange={set('message')} onFocus={focus} onBlur={blur}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || step === 'submitting'}
          style={{
            width: '100%', padding: '15px',
            borderRadius: 14, border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit
              ? 'linear-gradient(135deg,#00d4c8,#0099ff)'
              : 'rgba(255,255,255,0.07)',
            color: canSubmit ? '#070d1a' : 'rgba(255,255,255,0.25)',
            fontSize: 15, fontWeight: 700,
            fontFamily: "'DM Sans',sans-serif",
            transition: 'all 0.2s',
          }}
        >
          {step === 'submitting' ? 'Submitting…' : 'Send Inquiry →'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 14, lineHeight: 1.6 }}>
          By submitting you agree to be contacted by TheBedBox via call or WhatsApp.
          Your data is stored securely and never shared with third parties.
        </p>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
        Prefer to call?{' '}
        <a href="tel:+917999546362" style={{ color: '#00d4c8', fontWeight: 600 }}>+91 79995 46362</a>
      </div>
    </Shell>
  )
}

/* ─── Shell wrapper ──────────────────────────────────────────────────── */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#070d1a',
      fontFamily: "'DM Sans', sans-serif", color: '#e8eaf0',
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 60px' }}>
        {/* Logo bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,#00d4c8,#0099ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: '#070d1a',
          }}>B</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: '#00d4c8' }}>
            TheBedBox
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 600,
            padding: '4px 10px', borderRadius: 999,
            background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
            color: '#34d399', letterSpacing: '0.05em',
          }}>
            ROOMS AVAILABLE
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#00d4c8',
      marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(0,212,200,0.15)' }} />
      {children}
      <div style={{ flex: 1, height: 1, background: 'rgba(0,212,200,0.15)' }} />
    </div>
  )
}
