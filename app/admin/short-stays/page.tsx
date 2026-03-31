'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Hotel, Plus, X, Loader2, Calendar, IndianRupee, CheckCircle, Clock, Upload } from 'lucide-react'

export default function ShortStaysPage() {
  const [stays, setStays] = useState<any[]>([])
  const [beds, setBeds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active')
  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null)
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null)
  const [form, setForm] = useState({
    name: '', mobile: '', email: '',
    bed_id: '', checkin_date: new Date().toISOString().split('T')[0],
    checkout_date: '', daily_rate: '',
    payment_mode: 'upi', amount_paid: '0', notes: '',
  })
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [statusFilter])

  const fetchAll = async () => {
    setLoading(true)
    let q = supabase.from('short_stays')
      .select('*, bed:beds(bed_number, room:rooms(room_number))')
      .order('checkin_date', { ascending: false })
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    const { data } = await q
    setStays(data || [])

    const { data: b } = await supabase.from('beds')
      .select('*, room:rooms(room_number)')
      .in('status', ['available', 'reserved'])
    setBeds(b || [])
    setLoading(false)
  }

  const getNights = () => {
    if (!form.checkin_date || !form.checkout_date) return 0
    const diff = new Date(form.checkout_date).getTime() - new Date(form.checkin_date).getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const totalAmount = getNights() * parseFloat(form.daily_rate || '0')

  const uploadDoc = async (file: File, side: 'front' | 'back', stayId: string) => {
    const ext = file.name.split('.').pop()
    const path = `short-stays/${stayId}/${side}.${ext}`
    await supabase.storage.from('private-docs').upload(path, file, { upsert: true })
    return path
  }

  const handleAdd = async () => {
    if (!form.name || !form.mobile || !form.checkin_date || !form.checkout_date || !form.daily_rate) return
    setSaving(true)
    const { data: prop } = await supabase.from('properties').select('id').single()
    const amountPaid = parseFloat(form.amount_paid || '0')
    const paymentStatus = amountPaid >= totalAmount ? 'paid' : amountPaid > 0 ? 'partial' : 'pending'

    const { data: stay, error } = await supabase.from('short_stays').insert({
      property_id: prop?.id,
      name: form.name,
      mobile: form.mobile,
      email: form.email || null,
      bed_id: form.bed_id || null,
      checkin_date: form.checkin_date,
      checkout_date: form.checkout_date,
      daily_rate: parseFloat(form.daily_rate),
      total_amount: totalAmount,
      payment_mode: form.payment_mode as any,
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      notes: form.notes || null,
      status: 'active',
      tc_agreed_at: new Date().toISOString(),
    }).select().single()

    if (!error && stay) {
      if (aadhaarFront) {
        const fp = await uploadDoc(aadhaarFront, 'front', stay.id)
        await supabase.from('short_stays').update({ aadhaar_front_path: fp }).eq('id', stay.id)
      }
      if (aadhaarBack) {
        const bp = await uploadDoc(aadhaarBack, 'back', stay.id)
        await supabase.from('short_stays').update({ aadhaar_back_path: bp }).eq('id', stay.id)
      }
      if (form.bed_id) {
        await supabase.from('beds').update({ status: 'occupied' }).eq('id', form.bed_id)
      }
    }

    setShowModal(false)
    setForm({ name: '', mobile: '', email: '', bed_id: '', checkin_date: new Date().toISOString().split('T')[0], checkout_date: '', daily_rate: '', payment_mode: 'upi', amount_paid: '0', notes: '' })
    setAadhaarFront(null)
    setAadhaarBack(null)
    setSaving(false)
    fetchAll()
  }

  const handleCheckout = async (stay: any) => {
    await supabase.from('short_stays').update({ status: 'checked_out' }).eq('id', stay.id)
    if (stay.bed_id) await supabase.from('beds').update({ status: 'available' }).eq('id', stay.bed_id)
    fetchAll()
  }

  const getDaysLeft = (checkout: string) => {
    const diff = new Date(checkout).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
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

  return (
    <div style={{ padding: '32px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Short Stays
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            {stays.filter(s => s.status === 'active').length} active · Daily / weekly guests
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="bb-btn-primary" style={{ gap: '8px' }}>
          <Plus size={16} /> Check In Guest
        </button>
      </div>

      {/* Status Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['all', 'active', 'checked_out', 'cancelled'].map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 16px', borderRadius: '999px', border: '1px solid',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              background: statusFilter === s ? 'rgba(0,212,200,0.1)' : 'transparent',
              borderColor: statusFilter === s ? 'var(--teal-500)' : 'var(--border)',
              color: statusFilter === s ? 'var(--teal-500)' : 'var(--text-muted)',
              textTransform: 'capitalize'
            }}
          >{s === 'all' ? 'All' : s.replace('_', ' ')}</button>
        ))}
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Active Guests', value: stays.filter(s => s.status === 'active').length, color: '#34d399' },
          { label: 'Checking Out Soon', value: stays.filter(s => s.status === 'active' && getDaysLeft(s.checkout_date) <= 2).length, color: '#fbbf24' },
          { label: 'Revenue This Month', value: formatCurrency(stays.filter(s => new Date(s.checkin_date).getMonth() === new Date().getMonth()).reduce((sum, s) => sum + (s.amount_paid || 0), 0)), color: 'var(--teal-500)' },
        ].map((stat, i) => (
          <div key={i} className="stat-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: stat.color, fontFamily: 'Syne, sans-serif' }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Stays List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Loader2 size={28} color="var(--teal-500)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : stays.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <Hotel size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <p>No short stays yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {stays.map(stay => {
            const daysLeft = getDaysLeft(stay.checkout_date)
            const nights = Math.ceil((new Date(stay.checkout_date).getTime() - new Date(stay.checkin_date).getTime()) / (1000 * 60 * 60 * 24))
            const isActive = stay.status === 'active'
            return (
              <div key={stay.id} className="stat-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{stay.name}</span>
                      <span style={{
                        fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '999px',
                        background: isActive ? 'rgba(52,211,153,0.1)' : 'rgba(148,163,184,0.1)',
                        color: isActive ? '#34d399' : '#94a3b8',
                      }}>{stay.status.replace('_', ' ')}</span>
                      {isActive && daysLeft <= 2 && (
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '999px', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                          {daysLeft <= 0 ? 'Checkout Today' : `${daysLeft}d left`}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>📱 {stay.mobile}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>📅 {formatDate(stay.checkin_date)} → {formatDate(stay.checkout_date)}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>🌙 {nights} nights · ₹{stay.daily_rate}/night</span>
                      {stay.bed?.room && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>🛏 Room {stay.bed.room.room_number} · Bed {stay.bed.bed_number}</span>}
                    </div>
                    <div style={{ marginTop: '10px', display: 'flex', gap: '16px' }}>
                      <span style={{ fontSize: '13px', color: stay.payment_status === 'paid' ? '#34d399' : '#fbbf24', fontWeight: '600' }}>
                        {stay.payment_status === 'paid' ? '✓ Paid' : stay.payment_status === 'partial' ? '⚡ Partial'  : '⏳ Pending'} — {formatCurrency(stay.amount_paid)} / {formatCurrency(stay.total_amount)}
                      </span>
                    </div>
                  </div>
                  {isActive && (
                    <button onClick={() => handleCheckout(stay)} className="bb-btn-secondary" style={{ fontSize: '12px', padding: '8px 16px', gap: '6px' }}>
                      <CheckCircle size={14} /> Check Out
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Check-in Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface-1)', borderRadius: '20px', border: '1px solid var(--border)', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Guest Check-In</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Guest Name *</label>
                  <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label style={labelStyle}>Mobile *</label>
                  <input style={inputStyle} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="10-digit" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Bed</label>
                <select style={inputStyle} value={form.bed_id} onChange={e => setForm(f => ({ ...f, bed_id: e.target.value }))}>
                  <option value="">Select bed</option>
                  {beds.map(b => <option key={b.id} value={b.id}>Room {b.room?.room_number} · Bed {b.bed_number} — ₹{b.rate_daily}/night</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Check-in *</label>
                  <input type="date" style={inputStyle} value={form.checkin_date} onChange={e => setForm(f => ({ ...f, checkin_date: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Check-out *</label>
                  <input type="date" style={inputStyle} value={form.checkout_date} onChange={e => setForm(f => ({ ...f, checkout_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Daily Rate (₹) *</label>
                  <input style={inputStyle} value={form.daily_rate} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))} placeholder="e.g. 500" />
                </div>
                <div>
                  <label style={labelStyle}>Amount Paid (₹)</label>
                  <input style={inputStyle} value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} placeholder="0" />
                </div>
              </div>

              {/* Live Total */}
              {getNights() > 0 && parseFloat(form.daily_rate || '0') > 0 && (
                <div style={{ padding: '14px 16px', background: 'rgba(0,212,200,0.06)', border: '1px solid rgba(0,212,200,0.2)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{getNights()} nights × ₹{form.daily_rate}</span>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '700', color: 'var(--teal-500)' }}>{formatCurrency(totalAmount)}</span>
                </div>
              )}

              <div>
                <label style={labelStyle}>Payment Mode</label>
                <select style={inputStyle} value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              {/* Aadhaar Upload */}
              <div>
                <label style={labelStyle}>Aadhaar (Optional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[{ label: 'Front', file: aadhaarFront, setter: setAadhaarFront }, { label: 'Back', file: aadhaarBack, setter: setAadhaarBack }].map(({ label, file, setter }) => (
                    <label key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', border: `2px dashed ${file ? 'rgba(0,212,200,0.4)' : 'var(--border)'}`, borderRadius: '10px', cursor: 'pointer', background: file ? 'rgba(0,212,200,0.05)' : 'transparent', fontSize: '12px', color: file ? 'var(--teal-500)' : 'var(--text-muted)' }}>
                      <Upload size={14} /> {file ? file.name.substring(0, 12) + '…' : `Upload ${label}`}
                      <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => setter(e.target.files?.[0] || null)} />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special notes" />
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button onClick={() => setShowModal(false)} className="bb-btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleAdd} disabled={saving || !form.name || !form.mobile || !form.checkin_date || !form.checkout_date || !form.daily_rate} className="bb-btn-primary" style={{ flex: 1, gap: '8px' }}>
                  {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Hotel size={16} />}
                  Check In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
