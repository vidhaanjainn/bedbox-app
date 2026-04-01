'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, CheckCircle, Loader2, User, Home, FileText, Shield, Zap, SkipForward } from 'lucide-react'
import Link from 'next/link'
import { STAY_DURATIONS } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Basic Info', icon: User, required: true },
  { id: 2, label: 'Stay Details', icon: Home, required: false },
  { id: 3, label: 'Documents', icon: FileText, required: false },
  { id: 4, label: 'Agreement', icon: Shield, required: false },
]

export default function NewResidentPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [beds, setBeds] = useState<any[]>([])
  const [error, setError] = useState('')
  const [inviteMode, setInviteMode] = useState(true) // default: invite-first
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    name: '', mobile: '', email: '', emergency_contact_name: '',
    emergency_contact_number: '', hometown: '', institution: '',
    occupation: 'student', bed_id: '', room_number: '', rent_amount: '',
    security_deposit: '', date_of_joining: new Date().toISOString().split('T')[0],
    expected_duration: '', initial_electricity_reading: '0',
    notes: '', stay_type: 'long_stay',
  })

  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null)
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null)
  const [tcAgreed, setTcAgreed] = useState(false)

  useEffect(() => { fetchAvailableBeds() }, [])

  const fetchAvailableBeds = async () => {
    const { data } = await supabase
      .from('beds')
      .select('*, room:rooms(room_number, type, floor)')
      .in('status', ['available', 'reserved'])
      .order('created_at')
    setBeds(data || [])
  }

  const handleBedSelect = (bedId: string) => {
    const bed = beds.find(b => b.id === bedId)
    setForm(f => ({
      ...f,
      bed_id: bedId,
      room_number: bed?.room?.room_number || '',
      rent_amount: bed?.rate_monthly?.toString() || f.rent_amount
    }))
  }

  const uploadAadhaar = async (file: File, side: 'front' | 'back', residentId: string) => {
    const ext = file.name.split('.').pop()
    const path = `aadhaar/${residentId}/${side}.${ext}`
    const { error } = await supabase.storage
      .from('private-docs')
      .upload(path, file, { upsert: true })
    if (error) throw error
    return path
  }

  // Save resident with minimal data, auto-generate invite token, redirect to detail page
  const handleSaveAndInvite = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: resident, error: residentError } = await supabase
        .from('residents')
        .insert({
          name: form.name,
          mobile: form.mobile,
          email: form.email || null,
          bed_id: form.bed_id || null,
          room_number: form.room_number || null,
          rent_amount: form.rent_amount ? parseFloat(form.rent_amount) : null,
          security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : 0,
          date_of_joining: form.date_of_joining || new Date().toISOString().split('T')[0],
          initial_electricity_reading: parseFloat(form.initial_electricity_reading || '0'),
          stay_type: form.stay_type,
          notes: form.notes || null,
          status: 'pending',
          onboarding_status: 'pending',
        })
        .select()
        .single()

      if (residentError) throw residentError

      // Mark bed as reserved (not occupied — resident hasn't moved in yet)
      if (form.bed_id) {
        await supabase.from('beds').update({ status: 'reserved' }).eq('id', form.bed_id)
      }

      // Auto-generate invite token
      const { data: token, error: tokenError } = await supabase.rpc('generate_onboard_token', {
        p_resident_id: resident.id
      })
      if (tokenError) throw tokenError

      // Redirect to detail page — invite link will be shown ready to copy
      router.push(`/admin/residents/${resident.id}?invited=true`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  // Full manual submit (admin filled everything)
  const handleFullSubmit = async () => {
    if (!tcAgreed) { setError('Please agree to the terms and conditions'); return }
    setLoading(true)
    setError('')

    try {
      const { data: resident, error: residentError } = await supabase
        .from('residents')
        .insert({
          name: form.name,
          mobile: form.mobile,
          email: form.email || null,
          emergency_contact_name: form.emergency_contact_name || null,
          emergency_contact_number: form.emergency_contact_number || null,
          hometown: form.hometown || null,
          institution: form.institution || null,
          occupation: form.occupation,
          bed_id: form.bed_id || null,
          room_number: form.room_number || null,
          rent_amount: parseFloat(form.rent_amount),
          security_deposit: parseFloat(form.security_deposit || '0'),
          date_of_joining: form.date_of_joining,
          expected_duration: form.expected_duration || null,
          initial_electricity_reading: parseFloat(form.initial_electricity_reading || '0'),
          stay_type: form.stay_type,
          notes: form.notes || null,
          tc_agreed_at: new Date().toISOString(),
          status: 'active',
          onboarding_status: 'active',
        })
        .select()
        .single()

      if (residentError) throw residentError

      if (aadhaarFront) {
        const frontPath = await uploadAadhaar(aadhaarFront, 'front', resident.id)
        await supabase.from('residents').update({ aadhaar_front_path: frontPath }).eq('id', resident.id)
      }
      if (aadhaarBack) {
        const backPath = await uploadAadhaar(aadhaarBack, 'back', resident.id)
        await supabase.from('residents').update({ aadhaar_back_path: backPath }).eq('id', resident.id)
      }

      if (form.bed_id) {
        await supabase.from('beds').update({ status: 'occupied' }).eq('id', form.bed_id)
      }

      const now = new Date()
      await supabase.from('rent_payments').insert({
        resident_id: resident.id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        rent_amount: parseFloat(form.rent_amount),
        total_amount: parseFloat(form.rent_amount),
        status: 'pending',
      })

      router.push(`/admin/residents/${resident.id}`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: '600',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--text-muted)', marginBottom: '8px'
  }

  const validateStep = () => {
    if (step === 1) {
      if (!form.name.trim()) { setError('Name is required'); return false }
      if (!form.mobile.trim() || form.mobile.length < 10) { setError('Valid 10-digit mobile is required'); return false }
    }
    setError('')
    return true
  }

  return (
    <div style={{ padding: '32px', maxWidth: '700px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <Link href="/admin/residents" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', marginBottom: '16px' }}>
          <ArrowLeft size={14} /> Back to Residents
        </Link>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Add New Resident
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Enter name &amp; mobile → send invite link → resident fills everything else themselves.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', padding: '4px', background: 'var(--surface-1)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <button
          onClick={() => setInviteMode(true)}
          style={{
            flex: 1, padding: '9px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', transition: 'all 0.2s ease',
            background: inviteMode ? 'rgba(0,212,200,0.15)' : 'transparent',
            color: inviteMode ? 'var(--teal-500)' : 'var(--text-muted)',
          }}
        >
          <Zap size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Quick Invite (Recommended)
        </button>
        <button
          onClick={() => setInviteMode(false)}
          style={{
            flex: 1, padding: '9px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', transition: 'all 0.2s ease',
            background: !inviteMode ? 'rgba(0,212,200,0.15)' : 'transparent',
            color: !inviteMode ? 'var(--teal-500)' : 'var(--text-muted)',
          }}
        >
          Full Manual Onboarding
        </button>
      </div>

      {/* ─── QUICK INVITE MODE ─── */}
      {inviteMode ? (
        <div className="glass-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '28px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(0,212,200,0.06)', border: '1px solid rgba(0,212,200,0.15)' }}>
            <Zap size={16} color="var(--teal-500)" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
              Resident will fill their own personal details, upload Aadhaar, and digitally sign the agreement via their invite link. You only need their name and mobile to get started.
            </p>
          </div>

          {/* Required */}
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Required
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Full Name *</label>
              <input className="bb-input" placeholder="Resident's full name"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Mobile *</label>
              <input className="bb-input" placeholder="10-digit mobile" type="tel" maxLength={10}
                value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>
                Email
                <span style={{ fontWeight: '400', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, marginLeft: '4px' }}>(needed to send invite)</span>
              </label>
              <input className="bb-input" placeholder="email@example.com" type="email"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>

          {/* Optional */}
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Optional — fill now or update later
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Assign Bed</label>
              <select className="bb-input" value={form.bed_id} onChange={e => handleBedSelect(e.target.value)}>
                <option value="">Select bed (optional)</option>
                {beds.map(bed => (
                  <option key={bed.id} value={bed.id}>
                    Room {bed.room?.room_number} — Bed {bed.bed_number} ({bed.room?.type}) · ₹{bed.rate_monthly}/mo
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Monthly Rent (₹)</label>
              <input className="bb-input" placeholder="Auto-fills from bed" type="number"
                value={form.rent_amount} onChange={e => setForm(f => ({ ...f, rent_amount: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Security Deposit (₹)</label>
              <input className="bb-input" placeholder="e.g. 10000" type="number"
                value={form.security_deposit} onChange={e => setForm(f => ({ ...f, security_deposit: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Date of Joining</label>
              <input className="bb-input" type="date"
                value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Initial Electricity Reading</label>
              <input className="bb-input" placeholder="0" type="number"
                value={form.initial_electricity_reading} onChange={e => setForm(f => ({ ...f, initial_electricity_reading: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Notes (Internal)</label>
              <textarea className="bb-input" placeholder="Any notes about this resident..."
                style={{ height: '72px', resize: 'vertical' }}
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                if (!form.name.trim()) { setError('Name is required'); return }
                if (!form.mobile.trim() || form.mobile.length < 10) { setError('Valid 10-digit mobile is required'); return }
                setError('')
                handleSaveAndInvite()
              }}
              className="bb-btn-primary"
              disabled={loading}
              style={{ fontSize: '14px', padding: '10px 24px' }}
            >
              {loading
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                : <><Zap size={14} /> Save &amp; Generate Invite Link</>
              }
            </button>
          </div>
        </div>
      ) : (
        /* ─── FULL MANUAL ONBOARDING MODE ─── */
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = step > s.id
              const active = step === s.id
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px', borderRadius: '10px', flex: 1,
                    background: active ? 'rgba(0,212,200,0.1)' : done ? 'rgba(52,211,153,0.08)' : 'var(--surface-1)',
                    border: `1px solid ${active ? 'rgba(0,212,200,0.3)' : done ? 'rgba(52,211,153,0.2)' : 'var(--border)'}`,
                  }}>
                    {done ? <CheckCircle size={16} color="#34d399" /> : <Icon size={16} color={active ? 'var(--teal-500)' : 'var(--text-muted)'} />}
                    <span style={{ fontSize: '12px', fontWeight: '600', color: active ? 'var(--teal-500)' : done ? '#34d399' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {s.label}
                      {!s.required && <span style={{ fontWeight: '400', opacity: 0.6 }}> (opt)</span>}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && <div style={{ width: '20px', height: '1px', background: 'var(--border)', flexShrink: 0 }} />}
                </div>
              )
            })}
          </div>

          <div className="glass-card" style={{ padding: '32px' }}>
            {/* Step 1 */}
            {step === 1 && (
              <div>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 24px' }}>Personal Information</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Full Name *</label>
                    <input className="bb-input" placeholder="Resident's full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Mobile *</label>
                    <input className="bb-input" placeholder="10-digit mobile" type="tel" maxLength={10} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input className="bb-input" placeholder="email@example.com" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Emergency Contact Name</label>
                    <input className="bb-input" placeholder="Parent / Guardian name" value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Emergency Contact Number</label>
                    <input className="bb-input" placeholder="Emergency phone" type="tel" value={form.emergency_contact_number} onChange={e => setForm(f => ({ ...f, emergency_contact_number: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Hometown</label>
                    <input className="bb-input" placeholder="City / Town" value={form.hometown} onChange={e => setForm(f => ({ ...f, hometown: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Institution / Company</label>
                    <input className="bb-input" placeholder="College, coaching, or employer" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Occupation Type</label>
                    <select className="bb-input" value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}>
                      <option value="student">Student</option>
                      <option value="working">Working Professional</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 24px' }}>Stay Details</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Assign Bed</label>
                    <select className="bb-input" value={form.bed_id} onChange={e => handleBedSelect(e.target.value)}>
                      <option value="">Select available bed</option>
                      {beds.map(bed => (
                        <option key={bed.id} value={bed.id}>Room {bed.room?.room_number} — Bed {bed.bed_number} ({bed.room?.type}) · ₹{bed.rate_monthly}/mo</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Room Number</label>
                    <input className="bb-input" placeholder="e.g. 103" value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Monthly Rent (₹) *</label>
                    <input className="bb-input" placeholder="5000" type="number" value={form.rent_amount} onChange={e => setForm(f => ({ ...f, rent_amount: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Security Deposit (₹)</label>
                    <input className="bb-input" placeholder="10000" type="number" value={form.security_deposit} onChange={e => setForm(f => ({ ...f, security_deposit: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Date of Joining *</label>
                    <input className="bb-input" type="date" value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Expected Duration</label>
                    <select className="bb-input" value={form.expected_duration} onChange={e => setForm(f => ({ ...f, expected_duration: e.target.value }))}>
                      <option value="">Select duration</option>
                      {STAY_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Initial Electricity Reading (units)</label>
                    <input className="bb-input" placeholder="0" type="number" value={form.initial_electricity_reading} onChange={e => setForm(f => ({ ...f, initial_electricity_reading: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Stay Type</label>
                    <select className="bb-input" value={form.stay_type} onChange={e => setForm(f => ({ ...f, stay_type: e.target.value }))}>
                      <option value="long_stay">Long Stay (Monthly)</option>
                      <option value="short_stay">Short Stay (Daily)</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Notes (Internal)</label>
                    <textarea className="bb-input" placeholder="Any internal notes..." style={{ height: '80px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Identity Documents</h2>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: '999px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>Optional</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>Aadhaar images stored in a private, encrypted bucket. Only admins can access them.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {[
                    { label: 'Aadhaar Front', file: aadhaarFront, setter: setAadhaarFront },
                    { label: 'Aadhaar Back', file: aadhaarBack, setter: setAadhaarBack },
                  ].map(({ label, file, setter }) => (
                    <div key={label}>
                      <label style={labelStyle}>{label}</label>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px', border: `2px dashed ${file ? 'rgba(0,212,200,0.4)' : 'var(--border)'}`, borderRadius: '12px', background: file ? 'rgba(0,212,200,0.05)' : 'var(--surface-2)', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                        {file ? (<><CheckCircle size={24} color="var(--teal-500)" /><span style={{ fontSize: '12px', color: 'var(--teal-500)', fontWeight: '600' }}>{file.name}</span><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click to change</span></>) : (<><Upload size={24} color="var(--text-muted)" /><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Upload {label}</span><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>JPG, PNG, PDF</span></>)}
                        <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => setter(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '20px', padding: '14px', borderRadius: '10px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <p style={{ color: '#fbbf24', fontSize: '12px', margin: 0 }}>⚠️ As per UIDAI guidelines, Aadhaar images are stored as identity proof only. The number is never extracted or stored in the database.</p>
                </div>
              </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Terms &amp; Conditions</h2>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: '999px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>Optional</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>Review and confirm the rental agreement.</p>
                <div style={{ height: '320px', overflowY: 'auto', padding: '20px', background: 'var(--surface-2)', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                  <p><strong style={{ color: 'var(--text-primary)' }}>RENTAL AGREEMENT — THE BEDBOX</strong></p>
                  <p>8, Mahabali Nagar, Kolar Road, Bhopal (M.P.)</p>
                  <p><strong>Resident:</strong> {form.name || '[Name]'} | Room {form.room_number || '[Room]'} | ₹{form.rent_amount || '[Rent]'}/month</p>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
                  <p><strong>1.</strong> Monthly rent of ₹{form.rent_amount || '___'} is payable in advance, on or before 5th of each month. A penalty of ₹200/day applies for late payment after the 5th.</p>
                  <p><strong>2.</strong> Security deposit of ₹{form.security_deposit || '___'} is non-adjustable and returnable without interest at the end of stay.</p>
                  <p><strong>3.</strong> Electricity charged at ₹10/unit as per sub-meter reading.</p>
                  <p><strong>4.</strong> A minimum two months' notice is required to vacate. Failure to give notice results in forfeiture of security deposit.</p>
                  <p><strong>5.</strong> No subletting, political activity, alcohol, drugs, or smoking on premises.</p>
                  <p><strong>6.</strong> Management reserves right to inspect rooms at any time.</p>
                  <p><strong>7.</strong> Damage to property will be charged to the resident.</p>
                  <p><strong>8.</strong> If rent unpaid by 10th, management reserves right to remove belongings and repossess room.</p>
                  <p><strong>9.</strong> ₹1000/day penalty if resident fails to vacate after notice period.</p>
                  <p><strong>10.</strong> Rent subject to 5–10% annual increase after 11 months.</p>
                  <p><strong>11.</strong> Premises cannot be used for GST registration or business address.</p>
                  <p><strong>12.</strong> This digital agreement is legally binding under the IT Act 2000. Acceptance timestamp and IP are logged as proof.</p>
                  <p><strong>13.</strong> Personal data including Aadhaar is collected for KYC purposes under DPDP Act 2023 and stored securely.</p>
                  <p><strong>14.</strong> Jurisdiction: Bhopal courts only.</p>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '16px', borderRadius: '10px', background: tcAgreed ? 'rgba(0,212,200,0.05)' : 'var(--surface-2)', border: `1px solid ${tcAgreed ? 'rgba(0,212,200,0.3)' : 'var(--border)'}`, transition: 'all 0.2s ease' }}>
                  <input type="checkbox" checked={tcAgreed} onChange={e => setTcAgreed(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--teal-500)', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    I, <strong style={{ color: 'var(--text-primary)' }}>{form.name || 'the resident'}</strong>, confirm that I have read and agree to all terms and conditions of The BedBox Rental Agreement. I understand this is a legally binding digital agreement under the IT Act 2000.
                  </span>
                </label>
              </div>
            )}

            {error && (
              <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '13px' }}>
                {error}
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setStep(s => s - 1)} className="bb-btn-secondary" style={{ visibility: step === 1 ? 'hidden' : 'visible' }}>
                <ArrowLeft size={14} /> Back
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                {step >= 3 && step < 4 && (
                  <button onClick={() => { setError(''); setStep(s => s + 1) }} className="bb-btn-secondary" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    <SkipForward size={14} /> Skip
                  </button>
                )}
                {step < 4 ? (
                  <button onClick={() => { if (!validateStep()) return; setStep(s => s + 1) }} className="bb-btn-primary">Continue</button>
                ) : (
                  <button onClick={handleFullSubmit} className="bb-btn-primary" disabled={loading || !tcAgreed}>
                    {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
                    {loading ? 'Saving...' : 'Complete Onboarding'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
