'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AGREEMENT_VERSION, AGREEMENT_CLAUSES } from '@/lib/agreement-clauses'
import { AlertTriangle, Check, Lock, Paperclip } from 'lucide-react'

type Step = 'loading' | 'error' | 'welcome' | 'details' | 'docs' | 'agreement' | 'done'

export default function OnboardPage() {
  const { token } = useParams()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('loading')
  const [resident, setResident] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [form, setForm] = useState({
    emergency_contact_name: '',
    emergency_contact_phone: '',
    hometown: '',
    institution: '',
    occupation: '',
    aadhaar_number: '',
    aadhaar_front: null as File | null,
    aadhaar_back: null as File | null,
    agreement_agreed: false,
  })

  useEffect(() => {
    if (!token) { setStep('error'); setErrorMsg('Invalid link.'); return }
    fetch(`/api/onboard/${token}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok || !data.resident) {
          setErrorMsg(data.error || 'This link is invalid or has expired.')
          setStep('error')
          return
        }
        setResident(data.resident)
        setStep('welcome')
      })
      .catch(() => { setErrorMsg('Could not verify your link. Check your connection and try again.'); setStep('error') })
  }, [token])

  // Uploads go to a server-issued signed URL — the token authorizes, no open bucket policy needed
  const uploadDoc = async (side: 'front' | 'back', file: File) => {
    const res = await fetch(`/api/onboard/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upload-url', side }),
    })
    const data = await res.json()
    if (!res.ok || !data.path) throw new Error(data.error || 'Upload failed. Please try again.')
    const { error } = await supabase.storage.from('resident-docs').uploadToSignedUrl(data.path, data.uploadToken, file)
    if (error) throw new Error('Upload failed. Please try again.')
    return data.path as string
  }

  const handleSubmit = async () => {
    if (!resident) return
    setSubmitting(true)
    try {
      let aadhaarFrontPath = ''
      let aadhaarBackPath = ''

      if (form.aadhaar_front) {
        setUploadProgress('Uploading Aadhaar front...')
        aadhaarFrontPath = await uploadDoc('front', form.aadhaar_front)
      }
      if (form.aadhaar_back) {
        setUploadProgress('Uploading Aadhaar back...')
        aadhaarBackPath = await uploadDoc('back', form.aadhaar_back)
      }

      setUploadProgress('Saving your details...')
      const res = await fetch(`/api/onboard/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          emergency_contact_name: form.emergency_contact_name,
          emergency_contact_phone: form.emergency_contact_phone,
          hometown: form.hometown,
          institution: form.institution,
          occupation: form.occupation,
          aadhaar_number: form.aadhaar_number,
          aadhaar_front_path: aadhaarFrontPath,
          aadhaar_back_path: aadhaarBackPath,
          agreement_agreed: form.agreement_agreed,
          agreement_version: AGREEMENT_VERSION,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Could not save your details.')

      // Notify admin
      try {
        await fetch('/api/notify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            residentName: resident.name,
            residentEmail: resident.email,
            residentMobile: resident.mobile,
            residentRoom: null,
          })
        })
      } catch {}

      // Go to done FIRST before anything else can interfere
      setStep('done')
    } catch (err: any) {
      alert('Something went wrong: ' + (err?.message || 'Please try again or contact TheBedBox.'))
    } finally {
      setSubmitting(false)
      setUploadProgress('')
    }
  }

  const canStep1 = () => form.emergency_contact_name.trim() && form.emergency_contact_phone.trim() && form.hometown.trim() && form.occupation.trim()
  const canStep2 = () => form.aadhaar_number.length === 12 && form.aadhaar_front && form.aadhaar_back

  const stepIndex = { welcome: 0, details: 1, docs: 2, agreement: 3, done: 4 }
  const currentIndex = stepIndex[step as keyof typeof stepIndex] ?? -1

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (step === 'loading') return (
    <Shell>
      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Verifying link...</div>
    </Shell>
  )

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (step === 'error') return (
    <Shell>
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ marginBottom: 16 }}><AlertTriangle size={40} color="#ff6b6b" strokeWidth={1.5} /></div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 22, color: '#fff', margin: '0 0 12px' }}>Link unavailable</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, maxWidth: 300, margin: '0 auto 24px', lineHeight: 1.7 }}>{errorMsg}</p>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Call TheBedBox: <a href="tel:+917999546362" style={{ color: '#00d4c8' }}>+91 79995 46362</a></p>
      </div>
    </Shell>
  )

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <Shell>
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4c8,#0099ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}><Check size={32} color="#070d1a" strokeWidth={3} /></div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 26, margin: '0 0 12px' }}>You're all done!</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.7, maxWidth: 320, margin: '0 auto 32px' }}>
          Your onboarding has been submitted to TheBedBox. You'll hear back once it's approved — usually within a few hours.
        </p>
        <div style={{ background: 'rgba(0,212,200,0.06)', border: '1px solid rgba(0,212,200,0.15)', borderRadius: 12, padding: 20, textAlign: 'left', maxWidth: 320, margin: '0 auto' }}>
          <div style={{ fontSize: 12, color: '#00d4c8', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>What's next</div>
          {['TheBedBox reviews your details', 'You receive approval via call/message', 'Portal login link sent to your email'].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              <span style={{ color: '#00d4c8', fontWeight: 700, fontSize: 11, minWidth: 20 }}>{String(i + 1).padStart(2, '0')}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )

  // ── FORM STEPS ────────────────────────────────────────────────────────────
  return (
    <Shell>
      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
        {['Welcome', 'Details', 'Documents', 'Agreement'].map((s, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div style={{ height: 3, borderRadius: 2, background: i <= currentIndex ? '#00d4c8' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
            <div style={{ fontSize: 10, marginTop: 4, color: i === currentIndex ? '#00d4c8' : 'rgba(255,255,255,0.3)', fontWeight: i === currentIndex ? 600 : 400 }}>{s}</div>
          </div>
        ))}
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* WELCOME */}
      {step === 'welcome' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 28, margin: '0 0 8px' }}>Hey {resident?.name?.split(' ')[0]} 👋</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, margin: '0 0 28px', lineHeight: 1.6 }}>Welcome to TheBedBox. Complete your onboarding in 4 quick steps.</p>
          <div style={{ background: 'rgba(0,212,200,0.06)', border: '1px solid rgba(0,212,200,0.15)', borderRadius: 12, padding: 20, marginBottom: 28 }}>
            <div style={{ fontSize: 12, color: '#00d4c8', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your booking</div>
            {[['Name', resident?.name], ['Email', resident?.email], ['Mobile', resident?.mobile]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{l}</span>
                <span style={{ color: '#fff', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
          <Btn onClick={() => setStep('details')}>Start Onboarding →</Btn>
        </div>
      )}

      {/* DETAILS */}
      {step === 'details' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 24, margin: '0 0 6px' }}>Your details</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 24px' }}>We need a few things from you</p>
          <SectionLabel>Emergency contact</SectionLabel>
          <Field label="Contact person name" value={form.emergency_contact_name} onChange={v => setForm(f => ({ ...f, emergency_contact_name: v }))} placeholder="Parent / sibling / friend" />
          <Field label="Their mobile number" value={form.emergency_contact_phone} onChange={v => setForm(f => ({ ...f, emergency_contact_phone: v }))} placeholder="+91 98765 43210" type="tel" />
          <SectionLabel>Background</SectionLabel>
          <Field label="Hometown" value={form.hometown} onChange={v => setForm(f => ({ ...f, hometown: v }))} placeholder="Indore, Delhi, Mumbai..." />
          <Field label="Institution / Company" value={form.institution} onChange={v => setForm(f => ({ ...f, institution: v }))} placeholder="College or employer name" />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Occupation</label>
            <select value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: form.occupation ? '#fff' : 'rgba(255,255,255,0.3)', outline: 'none', boxSizing: 'border-box', cursor: 'pointer', appearance: 'none' }}>
              <option value="" disabled>Select your occupation</option>
              <option value="student">Student</option>
              <option value="working_professional">Working Professional</option>
              <option value="self_employed">Self Employed</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <GhostBtn onClick={() => setStep('welcome')}>← Back</GhostBtn>
            <Btn onClick={() => setStep('docs')} disabled={!canStep1()}>Continue →</Btn>
          </div>
        </div>
      )}

      {/* DOCS */}
      {step === 'docs' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 24, margin: '0 0 6px' }}>Upload Aadhaar</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 24px' }}>Required for identity verification. Stored securely.</p>
          <Field label="Aadhaar number" value={form.aadhaar_number} onChange={v => setForm(f => ({ ...f, aadhaar_number: v.replace(/\D/g, '').slice(0, 12) }))} placeholder="12-digit Aadhaar number" type="tel" />
          <FileUpload label="Aadhaar front side" hint="Name & photo side" file={form.aadhaar_front} onFile={f => setForm(fm => ({ ...fm, aadhaar_front: f }))} />
          <FileUpload label="Aadhaar back side" hint="Address side" file={form.aadhaar_back} onFile={f => setForm(fm => ({ ...fm, aadhaar_back: f }))} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(255,200,0,0.06)', border: '1px solid rgba(255,200,0,0.15)', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: 'rgba(255,200,100,0.8)', lineHeight: 1.6 }}>
            <Lock size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Stored in private encrypted storage. Only TheBedBox management can access it.</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn onClick={() => setStep('details')}>← Back</GhostBtn>
            <Btn onClick={() => setStep('agreement')} disabled={!canStep2()}>Continue →</Btn>
          </div>
        </div>
      )}

      {/* AGREEMENT */}
      {step === 'agreement' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 24, margin: '0 0 6px' }}>Tenancy agreement</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 16px' }}>Read all {AGREEMENT_CLAUSES.length} clauses before agreeing</p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '4px 16px', maxHeight: 340, overflowY: 'auto', marginBottom: 20 }}>
            {AGREEMENT_CLAUSES.map((clause, i) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: i < AGREEMENT_CLAUSES.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ color: '#00d4c8', fontWeight: 600, minWidth: 22, fontSize: 11, paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>
                <span>{clause}</span>
              </div>
            ))}
          </div>
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 20 }}>
            <div onClick={() => setForm(f => ({ ...f, agreement_agreed: !f.agreement_agreed }))} style={{ width: 20, height: 20, borderRadius: 5, marginTop: 1, flexShrink: 0, border: `2px solid ${form.agreement_agreed ? '#00d4c8' : 'rgba(255,255,255,0.2)'}`, background: form.agreement_agreed ? '#00d4c8' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              {form.agreement_agreed && <span style={{ fontSize: 12, color: '#070d1a', fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              I, <strong style={{ color: '#fff' }}>{resident?.name}</strong>, have read and understood all {AGREEMENT_CLAUSES.length} clauses and agree to be bound by them. I acknowledge this is a legally binding digital agreement.
            </span>
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn onClick={() => setStep('docs')}>← Back</GhostBtn>
            <Btn onClick={handleSubmit} disabled={!form.agreement_agreed || submitting}>
              {submitting ? (uploadProgress || 'Submitting...') : 'Submit & Complete ✓'}
            </Btn>
          </div>
        </div>
      )}
    </Shell>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#070d1a', fontFamily: "'DM Sans',sans-serif", color: '#e8eaf0' }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 24px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#00d4c8,#0099ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: '#070d1a' }}>B</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 15, color: '#00d4c8' }}>TheBedBox</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#00d4c8', marginBottom: 10, marginTop: 4 }}>{children}</div>
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
        onFocus={e => e.target.style.borderColor = '#00d4c8'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
    </div>
  )
}

function FileUpload({ label, hint, file, onFile }: { label: string; hint: string; file: File | null; onFile: (f: File) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</label>
      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '18px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', border: file ? '2px solid #00d4c8' : '2px dashed rgba(255,255,255,0.15)', background: file ? 'rgba(0,212,200,0.06)' : 'rgba(255,255,255,0.03)' }}>
        <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        {file ? <><Check size={20} color="#00d4c8" style={{ marginBottom: 4 }} /><span style={{ fontSize: 13, color: '#00d4c8', fontWeight: 500 }}>{file.name}</span></> : <><Paperclip size={22} color="rgba(255,255,255,0.4)" style={{ marginBottom: 6 }} /><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Tap to upload</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{hint}</span></>}
      </label>
    </div>
  )
}

function Btn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ flex: 1, width: '100%', padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 600, background: disabled ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#00d4c8,#0099ff)', color: disabled ? 'rgba(255,255,255,0.3)' : '#070d1a', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'opacity 0.2s' }}>
      {children}
    </button>
  )
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 500, background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
      {children}
    </button>
  )
}
