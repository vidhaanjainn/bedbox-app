'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Bed, User, Home, CheckCircle } from 'lucide-react'
import { STAY_DURATIONS } from '@/lib/utils'

export default function EditResidentPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [beds, setBeds] = useState<any[]>([])
  const [currentBed, setCurrentBed] = useState<any>(null)

  const [form, setForm] = useState({
    name: '', mobile: '', email: '',
    emergency_contact_name: '', emergency_contact_number: '',
    hometown: '', institution: '', occupation: 'student',
    bed_id: '', room_number: '',
    rent_amount: '', security_deposit: '',
    date_of_joining: '', expected_duration: '',
    initial_electricity_reading: '0',
    stay_type: 'long_stay', status: 'active', notes: '',
  })

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: resident }, { data: allBeds }] = await Promise.all([
      supabase.from('residents')
        .select('*, bed:beds(id, bed_number, room:rooms(room_number, type, floor))')
        .eq('id', id).single(),
      supabase.from('beds')
        .select('*, room:rooms(room_number, type, floor)')
        .in('status', ['available', 'reserved', 'occupied']),
    ])

    if (resident) {
      setCurrentBed(resident.bed || null)
      setForm({
        name: resident.name || '',
        mobile: resident.mobile || '',
        email: resident.email || '',
        emergency_contact_name: resident.emergency_contact_name || '',
        emergency_contact_number: resident.emergency_contact_number || '',
        hometown: resident.hometown || '',
        institution: resident.institution || '',
        occupation: resident.occupation || 'student',
        bed_id: resident.bed_id || '',
        room_number: resident.room_number || '',
        rent_amount: resident.rent_amount?.toString() || '',
        security_deposit: resident.security_deposit?.toString() || '',
        date_of_joining: resident.date_of_joining || '',
        expected_duration: resident.expected_duration || '',
        initial_electricity_reading: resident.initial_electricity_reading?.toString() || '0',
        stay_type: resident.stay_type || 'long_stay',
        status: resident.status || 'active',
        notes: resident.notes || '',
      })
    }
    setBeds(allBeds || [])
    setLoading(false)
  }

  const handleBedSelect = (bedId: string) => {
    const bed = beds.find(b => b.id === bedId)
    setForm(f => ({
      ...f,
      bed_id: bedId,
      room_number: bed?.room?.room_number || f.room_number,
      rent_amount: bed?.rate_monthly?.toString() || f.rent_amount,
    }))
  }

  const handleSave = async () => {
    if (!form.name || !form.mobile || !form.rent_amount) {
      setError('Name, mobile and rent amount are required')
      return
    }
    setSaving(true)
    setError('')

    try {
      // If bed changed — free old bed, occupy new one
      const oldBedId = currentBed?.id
      const newBedId = form.bed_id || null

      if (oldBedId && oldBedId !== newBedId) {
        await supabase.from('beds').update({ status: 'available' }).eq('id', oldBedId)
      }
      if (newBedId && newBedId !== oldBedId) {
        await supabase.from('beds').update({ status: 'occupied' }).eq('id', newBedId)
      }

      const { error: updateError } = await supabase.from('residents').update({
        name: form.name,
        mobile: form.mobile,
        email: form.email || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_number: form.emergency_contact_number || null,
        hometown: form.hometown || null,
        institution: form.institution || null,
        occupation: form.occupation,
        bed_id: newBedId,
        room_number: form.room_number || null,
        rent_amount: parseFloat(form.rent_amount),
        security_deposit: parseFloat(form.security_deposit || '0'),
        date_of_joining: form.date_of_joining,
        expected_duration: form.expected_duration || null,
        initial_electricity_reading: parseFloat(form.initial_electricity_reading || '0'),
        stay_type: form.stay_type,
        status: form.status,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', id as string)

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => router.push(`/admin/residents/${id}`), 1000)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: '600',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--text-muted)', marginBottom: '6px'
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: '10px', color: 'var(--text-primary)',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  }
  const sectionTitle = (icon: React.ReactNode, title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', marginTop: '8px' }}>
      <div style={{ width: '28px', height: '28px', background: 'rgba(0,212,200,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{title}</span>
    </div>
  )

  if (loading) return (
    <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Loader2 size={28} color="var(--teal-500)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ padding: '32px', maxWidth: '720px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <Link href={`/admin/residents/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', marginBottom: '16px' }}>
          <ArrowLeft size={14} /> Back to Resident
        </Link>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          Edit Resident
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Personal Info */}
        <div className="stat-card" style={{ padding: '24px' }}>
          {sectionTitle(<User size={14} color="var(--teal-500)" />, 'Personal Info')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Mobile *</label>
              <input style={inputStyle} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <label style={labelStyle}>Occupation</label>
              <select style={inputStyle} value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}>
                <option value="student">Student</option>
                <option value="working">Working Professional</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Emergency Contact Name</label>
              <input style={inputStyle} value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Emergency Contact Number</label>
              <input style={inputStyle} value={form.emergency_contact_number} onChange={e => setForm(f => ({ ...f, emergency_contact_number: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Hometown</label>
              <input style={inputStyle} value={form.hometown} onChange={e => setForm(f => ({ ...f, hometown: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Institution / Company</label>
              <input style={inputStyle} value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Stay & Bed Details */}
        <div className="stat-card" style={{ padding: '24px' }}>
          {sectionTitle(<Bed size={14} color="var(--teal-500)" />, 'Stay & Bed Assignment')}

          {/* Current Bed Display */}
          {currentBed && (
            <div style={{ padding: '12px 16px', background: 'rgba(0,212,200,0.06)', border: '1px solid rgba(0,212,200,0.2)', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bed size={14} color="var(--teal-500)" />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Currently assigned:</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--teal-500)' }}>
                Room {currentBed.room?.room_number} · Bed {currentBed.bed_number}
              </span>
            </div>
          )}

          <div>
            <label style={labelStyle}>Assign Bed</label>
            <select style={inputStyle} value={form.bed_id} onChange={e => handleBedSelect(e.target.value)}>
              <option value="">No bed assigned</option>
              {beds.map(b => (
                <option key={b.id} value={b.id} disabled={b.status === 'occupied' && b.id !== form.bed_id}>
                  Room {b.room?.room_number} ({b.room?.type}) · Bed {b.bed_number} — ₹{b.rate_monthly?.toLocaleString('en-IN')}/mo
                  {b.status === 'occupied' && b.id !== form.bed_id ? ' [Occupied]' : ''}
                  {b.status === 'available' ? ' ✓ Available' : ''}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Selecting a new bed will auto-update rent amount and free the old bed.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <div>
              <label style={labelStyle}>Monthly Rent (₹) *</label>
              <input style={inputStyle} value={form.rent_amount} onChange={e => setForm(f => ({ ...f, rent_amount: e.target.value }))} placeholder="e.g. 8500" />
            </div>
            <div>
              <label style={labelStyle}>Security Deposit (₹)</label>
              <input style={inputStyle} value={form.security_deposit} onChange={e => setForm(f => ({ ...f, security_deposit: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Date of Joining</label>
              <input type="date" style={inputStyle} value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Expected Duration</label>
              <select style={inputStyle} value={form.expected_duration} onChange={e => setForm(f => ({ ...f, expected_duration: e.target.value }))}>
                <option value="">Not specified</option>
                <option value="1-3 months">1–3 months</option>
                <option value="3-6 months">3–6 months</option>
                <option value="6-12 months">6–12 months</option>
                <option value="12+ months">12+ months</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Stay Type</label>
              <select style={inputStyle} value={form.stay_type} onChange={e => setForm(f => ({ ...f, stay_type: e.target.value }))}>
                <option value="long_stay">Long Stay</option>
                <option value="short_stay">Short Stay</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="notice">Notice Period</option>
                <option value="vacated">Vacated</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Initial Electricity Reading</label>
              <input style={inputStyle} value={form.initial_electricity_reading} onChange={e => setForm(f => ({ ...f, initial_electricity_reading: e.target.value }))} placeholder="0" />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this resident" />
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div style={{ padding: '14px 16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', color: '#f87171', fontSize: '14px' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '14px 16px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '10px', color: '#34d399', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} /> Saved! Redirecting…
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', paddingBottom: '32px' }}>
          <Link href={`/admin/residents/${id}`} className="bb-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving || success} className="bb-btn-primary" style={{ flex: 2, gap: '8px' }}>
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
