'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, getDaysRemaining } from '@/lib/utils'
import { Bell, Plus, X, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'

export default function NoticesPage() {
  const [notices, setNotices] = useState<any[]>([])
  const [residents, setResidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active')
  const [form, setForm] = useState({ resident_id: '', notice_date: new Date().toISOString().split('T')[0], reason: '', last_day_of_stay: '' })
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [statusFilter])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: n }, { data: r }] = await Promise.all([
      supabase.from('notice_periods').select('*, resident:residents(name, room_number, mobile, rent_amount)')
        .eq('status', statusFilter).order('notice_date', { ascending: false }),
      supabase.from('residents').select('id, name, room_number').eq('status', 'active'),
    ])
    setNotices(n || [])
    setResidents(r || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!form.resident_id || !form.notice_date) return
    setSaving(true)

    await supabase.from('notice_periods').insert({
      resident_id: form.resident_id,
      notice_date: form.notice_date,
      last_day_of_stay: form.last_day_of_stay || null,
      reason: form.reason || null,
      submitted_via: 'manual',
      status: 'active',
    })

    await supabase.from('residents').update({ status: 'notice' }).eq('id', form.resident_id)

    setShowModal(false)
    setForm({ resident_id: '', notice_date: new Date().toISOString().split('T')[0], reason: '', last_day_of_stay: '' })
    setSaving(false)
    fetchAll()
  }

  const markCompleted = async (noticeId: string, residentId: string) => {
    await supabase.from('notice_periods').update({ status: 'completed' }).eq('id', noticeId)
    await supabase.from('residents').update({ status: 'vacated' }).eq('id', residentId)
    fetchAll()
  }

  return (
    <div style={{ padding: '32px' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Notice Periods
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            2-month notice required · Track vacating residents
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="bb-btn-primary">
          <Plus size={16} /> Add Notice
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px', width: 'fit-content', marginBottom: '24px' }}>
        {['active', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '6px 16px', borderRadius: '7px', border: 'none', fontSize: '12px',
            fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
            background: statusFilter === s ? 'var(--teal-500)' : 'transparent',
            color: statusFilter === s ? 'var(--navy-900)' : 'var(--text-muted)',
          }}>{s}</button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : notices.length === 0 ? (
        <div style={{ padding: '80px', textAlign: 'center' }}>
          <Bell size={40} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No {statusFilter} notices.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {notices.map(n => {
            const daysLeft = getDaysRemaining(n.last_day_per_agreement)
            const urgent = daysLeft <= 14
            return (
              <div key={n.id} className="glass-card-hover" style={{
                padding: '24px',
                borderColor: urgent && n.status === 'active' ? 'rgba(249,115,22,0.3)' : undefined
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>
                      {n.resident?.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Room {n.resident?.room_number}
                    </div>
                  </div>
                  {n.status === 'active' && (
                    <div style={{
                      textAlign: 'center', minWidth: '60px',
                      background: urgent ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.1)',
                      border: `1px solid ${urgent ? 'rgba(239,68,68,0.3)' : 'rgba(249,115,22,0.3)'}`,
                      borderRadius: '10px', padding: '8px 12px'
                    }}>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: urgent ? '#f87171' : '#f97316', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
                        {daysLeft}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
                        days left
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Notice Date</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>{formatDate(n.notice_date)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last Day (Agreement)</span>
                    <span style={{ fontSize: '12px', color: urgent ? '#f87171' : 'var(--text-primary)', fontWeight: '600' }}>
                      {formatDate(n.last_day_per_agreement)}
                    </span>
                  </div>
                  {n.last_day_of_stay && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Actual Last Day</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{formatDate(n.last_day_of_stay)}</span>
                    </div>
                  )}
                  {n.reason && (
                    <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'var(--surface-2)', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Reason: {n.reason}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {n.status === 'active' && (
                  <div className="bb-progress" style={{ marginBottom: '16px' }}>
                    <div className="bb-progress-bar" style={{
                      width: `${Math.max(0, Math.min(100, ((60 - daysLeft) / 60) * 100))}%`,
                      background: urgent ? 'linear-gradient(90deg, #f87171, #ef4444)' : undefined
                    }} />
                  </div>
                )}

                {n.status === 'active' && (
                  <button
                    onClick={() => markCompleted(n.id, n.resident_id)}
                    style={{
                      width: '100%', padding: '8px', borderRadius: '8px',
                      border: '1px solid rgba(52,211,153,0.3)',
                      background: 'rgba(52,211,153,0.05)',
                      color: '#34d399', fontSize: '12px', fontWeight: '600',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '6px'
                    }}
                  >
                    <CheckCircle size={13} /> Mark as Vacated
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Notice Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Add Notice Period
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {[
              { label: 'Resident *', el: <select className="bb-input" value={form.resident_id} onChange={e => setForm(f => ({ ...f, resident_id: e.target.value }))}>
                <option value="">Select resident</option>
                {residents.map(r => <option key={r.id} value={r.id}>{r.name} — Room {r.room_number}</option>)}
              </select> },
              { label: 'Notice Date *', el: <input className="bb-input" type="date" value={form.notice_date} onChange={e => setForm(f => ({ ...f, notice_date: e.target.value }))} /> },
              { label: 'Actual Last Day (optional)', el: <input className="bb-input" type="date" value={form.last_day_of_stay} onChange={e => setForm(f => ({ ...f, last_day_of_stay: e.target.value }))} /> },
              { label: 'Reason', el: <textarea className="bb-input" style={{ height: '80px', resize: 'vertical' }} placeholder="Reason for vacating..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /> },
            ].map(({ label, el }) => (
              <div key={label} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>{label}</label>
                {el}
              </div>
            ))}

            {form.notice_date && (
              <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last Day per Agreement (auto-calculated)</div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#f97316', marginTop: '4px' }}>
                  {formatDate(new Date(new Date(form.notice_date).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString())}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowModal(false)} className="bb-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={handleAdd} className="bb-btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving || !form.resident_id}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Bell size={14} />}
                Add Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
