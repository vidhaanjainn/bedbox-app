'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, CheckCircle, Loader2, User, Home, FileText, Shield } from 'lucide-react'
import Link from 'next/link'
import { STAY_DURATIONS } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Personal Info', icon: User },
  { id: 2, label: 'Stay Details', icon: Home },
  { id: 3, label: 'Documents', icon: FileText },
  { id: 4, label: 'Agreement', icon: Shield },
]

export default function NewResidentPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [beds, setBeds] = useState<any[]>([])
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    name: '', mobile: '', email: '', emergency_contact_name: '',
    emergency_contact_number: '', hometown: '', institution: '',
    occupation: 'student', bed_id: '', room_number: '', rent_amount: '',
    security_deposit: '', date_of_joining: '', expected_duration: '',
    initial_electricity_reading: '0', notes: '', stay_type: 'long_stay',
  })

  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null)
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null)
  const [tcAgreed, setTcAgreed] = useState(false)

  useEffect(() => {
    fetchAvailableBeds()
  }, [])

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

  const handleSubmit = async () => {
    if (!tcAgreed) { setError('Please agree to the terms and conditions'); return }
    setLoading(true)
    setError('')

    try {
      // 1. Create resident record
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
        })
        .select()
        .single()

      if (residentError) throw residentError

      // 2. Upload Aadhaar docs if provided
      if (aadhaarFront) {
        const frontPath = await uploadAadhaar(aadhaarFront, 'front', resident.id)
        await supabase.from('residents').update({ aadhaar_front_path: frontPath }).eq('id', resident.id)
      }
      if (aadhaarBack) {
        const backPath = await uploadAadhaar(aadhaarBack, 'back', resident.id)
        await supabase.from('residents').update({ aadhaar_back_path: backPath }).eq('id', resident.id)
      }

      // 3. Update bed status
      if (form.bed_id) {
        await supabase.from('beds').update({ status: 'occupied' }).eq('id', form.bed_id)
      }

      // 4. Create first month rent record
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

  const inputStyle = { marginBottom: '16px' }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: '600',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--text-muted)', marginBottom: '8px'
  }

  return (
    <div style={{ padding: '32px', maxWidth: '700px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <Link href="/admin/residents" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', marginBottom: '16px' }}>
          <ArrowLeft size={14} /> Back to Residents
        </Link>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          Add New Resident
        </h1>
      </div>

      {/* Step indicator */}
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
                {done ? (
                  <CheckCircle size={16} color="#34d399" />
                ) : (
                  <Icon size={16} color={active ? 'var(--teal-500)' : 'var(--text-muted)'} />
                )}
                <span style={{
                  fontSize: '12px', fontWeight: '600',
                  color: active ? 'var(--teal-500)' : done ? '#34d399' : 'var(--text-muted)',
                  whiteSpace: 'nowrap'
                }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: '20px', height: '1px', background: 'var(--border)', flexShrink: 0 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Form Card */}
      <div className="glass-card" style={{ padding: '32px' }}>
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 24px' }}>
              Personal Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Full Name *</label>
                <input className="bb-input" placeholder="Resident's full name"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Mobile *</label>
                <input className="bb-input" placeholder="10-digit mobile" type="tel"
                  value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input className="bb-input" placeholder="email@example.com" type="email"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Emergency Contact Name</label>
                <input className="bb-input" placeholder="Parent / Guardian name"
                  value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Emergency Contact Number</label>
                <input className="bb-input" placeholder="Emergency phone" type="tel"
                  value={form.emergency_contact_number} onChange={e => setForm(f => ({ ...f, emergency_contact_number: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Hometown</label>
                <input className="bb-input" placeholder="City / Town"
                  value={form.hometown} onChange={e => setForm(f => ({ ...f, hometown: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Institution / Company</label>
                <input className="bb-input" placeholder="College, coaching, or employer"
                  value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Occupation Type *</label>
                <select className="bb-input"
                  value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}>
                  <option value="student">Student</option>
                  <option value="working">Working Professional</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Stay Details */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 24px' }}>
              Stay Details
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Assign Bed</label>
                <select className="bb-input" value={form.bed_id} onChange={e => handleBedSelect(e.target.value)}>
                  <option value="">Select available bed</option>
                  {beds.map(bed => (
                    <option key={bed.id} value={bed.id}>
                      Room {bed.room?.room_number} — Bed {bed.bed_number} ({bed.room?.type}) · ₹{bed.rate_monthly}/mo
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Room Number</label>
                <input className="bb-input" placeholder="e.g. 103"
                  value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Monthly Rent (₹) *</label>
                <input className="bb-input" placeholder="5000" type="number"
                  value={form.rent_amount} onChange={e => setForm(f => ({ ...f, rent_amount: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Security Deposit (₹)</label>
                <input className="bb-input" placeholder="10000" type="number"
                  value={form.security_deposit} onChange={e => setForm(f => ({ ...f, security_deposit: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Date of Joining *</label>
                <input className="bb-input" type="date"
                  value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} />
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
                <input className="bb-input" placeholder="0" type="number"
                  value={form.initial_electricity_reading} onChange={e => setForm(f => ({ ...f, initial_electricity_reading: e.target.value }))} />
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
                <textarea className="bb-input" placeholder="Any internal notes about this resident..."
                  style={{ height: '80px', resize: 'vertical' }}
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Documents */}
        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Identity Documents
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
              Aadhaar images are stored in a private, encrypted bucket. Only admins can access them. Images are never shared with residents.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { label: 'Aadhaar Front', file: aadhaarFront, setter: setAadhaarFront },
                { label: 'Aadhaar Back', file: aadhaarBack, setter: setAadhaarBack },
              ].map(({ label, file, setter }) => (
                <div key={label}>
                  <label style={labelStyle}>{label}</label>
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '8px', padding: '24px',
                    border: `2px dashed ${file ? 'rgba(0,212,200,0.4)' : 'var(--border)'}`,
                    borderRadius: '12px',
                    background: file ? 'rgba(0,212,200,0.05)' : 'var(--surface-2)',
                    cursor: 'pointer', transition: 'all 0.2s ease'
                  }}>
                    {file ? (
                      <>
                        <CheckCircle size={24} color="var(--teal-500)" />
                        <span style={{ fontSize: '12px', color: 'var(--teal-500)', fontWeight: '600' }}>{file.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click to change</span>
                      </>
                    ) : (
                      <>
                        <Upload size={24} color="var(--text-muted)" />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Upload {label}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>JPG, PNG, PDF</span>
                      </>
                    )}
                    <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                      onChange={e => setter(e.target.files?.[0] || null)} />
                  </label>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: '20px', padding: '14px', borderRadius: '10px',
              background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)'
            }}>
              <p style={{ color: '#fbbf24', fontSize: '12px', margin: 0 }}>
                ⚠️ As per UIDAI guidelines, Aadhaar images are stored as identity proof only. The number is never extracted or stored in the database.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Agreement */}
        {step === 4 && (
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Terms & Conditions
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Review and confirm the rental agreement. Agreement PDF will be saved for your records only.
            </p>
            <div style={{
              height: '320px', overflowY: 'auto', padding: '20px',
              background: 'var(--surface-2)', borderRadius: '12px',
              border: '1px solid var(--border)', marginBottom: '20px',
              fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7'
            }}>
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

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              cursor: 'pointer', padding: '16px', borderRadius: '10px',
              background: tcAgreed ? 'rgba(0,212,200,0.05)' : 'var(--surface-2)',
              border: `1px solid ${tcAgreed ? 'rgba(0,212,200,0.3)' : 'var(--border)'}`,
              transition: 'all 0.2s ease'
            }}>
              <input type="checkbox" checked={tcAgreed} onChange={e => setTcAgreed(e.target.checked)}
                style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--teal-500)', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                I, <strong style={{ color: 'var(--text-primary)' }}>{form.name || 'the resident'}</strong>, confirm that I have read and agree to all terms and conditions of The BedBox Rental Agreement. I understand this is a legally binding digital agreement under the IT Act 2000.
              </span>
            </label>

            {error && (
              <div style={{
                marginTop: '12px', padding: '12px 16px', borderRadius: '10px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontSize: '13px'
              }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setStep(s => s - 1)}
            className="bb-btn-secondary"
            style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          {step < 4 ? (
            <button
              onClick={() => {
                if (step === 1 && !form.name) { setError('Name is required'); return }
                if (step === 1 && !form.mobile) { setError('Mobile is required'); return }
                if (step === 2 && !form.rent_amount) { setError('Rent amount is required'); return }
                if (step === 2 && !form.date_of_joining) { setError('Date of joining is required'); return }
                setError('')
                setStep(s => s + 1)
              }}
              className="bb-btn-primary"
            >
              Continue
            </button>
          ) : (
            <button onClick={handleSubmit} className="bb-btn-primary" disabled={loading || !tcAgreed}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
              {loading ? 'Saving...' : 'Complete Onboarding'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
