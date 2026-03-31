'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatCurrency } from '@/lib/utils'
import { BookOpen, Plus, X, Loader2, ChevronRight, Phone, Mail, Calendar, IndianRupee, CheckCircle, XCircle, Clock, Send } from 'lucide-react'

const STAGES = [
  { key: 'inquiry', label: 'Inquiry', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  { key: 'booked', label: 'Booked', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  { key: 'onboarding_sent', label: 'Onboarding Sent', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  { key: 'onboarded', label: 'Onboarded', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  { key: 'cancelled', label: 'Cancelled', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
]

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [beds, setBeds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [stageFilter, setStageFilter] = useState('all')
  const [form, setForm] = useState({
    full_name: '', mobile: '', email: '', occupation: '',
    bed_id: '', from_date: '', duration: '',
    price_finalised: '', token_amount: '0', notes: '',
  })
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [stageFilter])

  const fetchAll = async () => {
    setLoading(true)
    let q = supabase.from('bookings')
      .select('*, bed:beds(bed_number, room:rooms(room_number))')
      .order('created_at', { ascending: false })
    if (stageFilter !== 'all') q = q.eq('status', stageFilter)
    const { data } = await q
    setBookings(data || [])

    const { data: b } = await supabase.from('beds')
      .select('*, room:rooms(room_number)')
      .in('status', ['available', 'reserved'])
    setBeds(b || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!form.full_name || !form.mobile) return
    setSaving(true)
    const { data: prop } = await supabase.from('properties').select('id').single()
    await supabase.from('bookings').insert({
      property_id: prop?.id,
      full_name: form.full_name,
      mobile: form.mobile,
      email: form.email || null,
      occupation: form.occupation || null,
      bed_id: form.bed_id || null,
      from_date: form.from_date || null,
      duration: form.duration || null,
      price_finalised: form.price_finalised ? parseFloat(form.price_finalised) : null,
      token_amount: parseFloat(form.token_amount || '0'),
      notes: form.notes || null,
      status: 'inquiry',
    })
    setShowModal(false)
    setForm({ full_name: '', mobile: '', email: '', occupation: '', bed_id: '', from_date: '', duration: '', price_finalised: '', token_amount: '0', notes: '' })
    setSaving(false)
    fetchAll()
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('bookings').update({
      status,
      ...(status === 'onboarding_sent' ? { onboarding_link_sent_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    fetchAll()
  }

  const getStage = (key: string) => STAGES.find(s => s.key === key) || STAGES[0]

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
            Bookings Pipeline
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            {bookings.length} total · {bookings.filter(b => b.status === 'inquiry').length} inquiries · {bookings.filter(b => b.status === 'booked').length} confirmed
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="bb-btn-primary" style={{ gap: '8px' }}>
          <Plus size={16} /> Add Booking
        </button>
      </div>

      {/* Stage Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setStageFilter('all')}
          style={{
            padding: '6px 16px', borderRadius: '999px', border: '1px solid',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            background: stageFilter === 'all' ? 'var(--teal-500)' : 'transparent',
            borderColor: stageFilter === 'all' ? 'var(--teal-500)' : 'var(--border)',
            color: stageFilter === 'all' ? '#070d1a' : 'var(--text-muted)',
          }}
        >All</button>
        {STAGES.map(s => (
          <button key={s.key}
            onClick={() => setStageFilter(s.key)}
            style={{
              padding: '6px 16px', borderRadius: '999px', border: '1px solid',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              background: stageFilter === s.key ? s.bg : 'transparent',
              borderColor: stageFilter === s.key ? s.color : 'var(--border)',
              color: stageFilter === s.key ? s.color : 'var(--text-muted)',
            }}
          >{s.label}</button>
        ))}
      </div>

      {/* Pipeline Kanban Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {STAGES.slice(0, 4).map(s => {
          const count = bookings.filter(b => b.status === s.key).length
          return (
            <div key={s.key} className="stat-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setStageFilter(s.key)}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: s.color, fontFamily: 'Syne, sans-serif' }}>{count}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
              <div style={{ height: '3px', background: s.bg, borderRadius: '2px', marginTop: '10px' }}>
                <div style={{ height: '100%', width: count > 0 ? '100%' : '0%', background: s.color, borderRadius: '2px', transition: 'width 0.3s' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Bookings List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Loader2 size={28} color="var(--teal-500)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <BookOpen size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <p>No bookings yet. Add your first inquiry.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {bookings.map(b => {
            const stage = getStage(b.status)
            const nextStages = {
              inquiry: 'booked', booked: 'onboarding_sent',
              onboarding_sent: 'onboarded', onboarded: null, cancelled: null
            } as any
            const next = nextStages[b.status]
            const nextLabel = { booked: 'Mark Booked', onboarding_sent: 'Send Onboarding', onboarded: 'Mark Onboarded' } as any

            return (
              <div key={b.id} className="stat-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{b.full_name}</span>
                      <span style={{
                        fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '999px',
                        background: stage.bg, color: stage.color, border: `1px solid ${stage.color}40`
                      }}>{stage.label}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <Phone size={12} /> {b.mobile}
                      </span>
                      {b.email && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <Mail size={12} /> {b.email}
                      </span>}
                      {b.from_date && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <Calendar size={12} /> {formatDate(b.from_date)}
                      </span>}
                      {b.price_finalised && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <IndianRupee size={12} /> {formatCurrency(b.price_finalised)}/mo
                      </span>}
                      {b.bed?.room && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Room {b.bed.room.room_number} · Bed {b.bed.bed_number}
                      </span>}
                    </div>
                    {b.notes && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>{b.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {next && (
                      <button onClick={() => updateStatus(b.id, next)} className="bb-btn-primary" style={{ fontSize: '12px', padding: '8px 14px', gap: '6px' }}>
                        {next === 'onboarding_sent' ? <Send size={12} /> : <CheckCircle size={12} />}
                        {nextLabel[next]}
                      </button>
                    )}
                    {b.status !== 'cancelled' && b.status !== 'onboarded' && (
                      <button onClick={() => updateStatus(b.id, 'cancelled')} className="bb-btn-secondary" style={{ fontSize: '12px', padding: '8px 14px', gap: '6px' }}>
                        <XCircle size={12} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
                {b.token_amount > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '16px' }}>
                    <span style={{ fontSize: '12px', color: '#34d399' }}>✓ Token received: {formatCurrency(b.token_amount)}</span>
                    {b.onboarding_link_sent_at && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Onboarding sent: {formatDate(b.onboarding_link_sent_at)}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface-1)', borderRadius: '20px', border: '1px solid var(--border)', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>New Booking / Inquiry</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input style={inputStyle} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Applicant name" />
                </div>
                <div>
                  <label style={labelStyle}>Mobile *</label>
                  <input style={inputStyle} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="10-digit number" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Optional" />
                </div>
                <div>
                  <label style={labelStyle}>Occupation</label>
                  <select style={inputStyle} value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="student">Student</option>
                    <option value="working">Working Professional</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Preferred Bed</label>
                  <select style={inputStyle} value={form.bed_id} onChange={e => setForm(f => ({ ...f, bed_id: e.target.value }))}>
                    <option value="">Not decided</option>
                    {beds.map(b => (
                      <option key={b.id} value={b.id}>Room {b.room?.room_number} · Bed {b.bed_number} — {formatCurrency(b.rate_monthly)}/mo</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Expected Move-in</label>
                  <input type="date" style={inputStyle} value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Finalised Rent (₹/mo)</label>
                  <input style={inputStyle} value={form.price_finalised} onChange={e => setForm(f => ({ ...f, price_finalised: e.target.value }))} placeholder="e.g. 8500" />
                </div>
                <div>
                  <label style={labelStyle}>Token Amount (₹)</label>
                  <input style={inputStyle} value={form.token_amount} onChange={e => setForm(f => ({ ...f, token_amount: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any specific requirements, source of inquiry, etc." />
              </div>
              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button onClick={() => setShowModal(false)} className="bb-btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleAdd} disabled={saving || !form.full_name || !form.mobile} className="bb-btn-primary" style={{ flex: 1, gap: '8px' }}>
                  {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />}
                  Add to Pipeline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
