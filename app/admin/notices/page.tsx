'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, getNoticeDaysRemaining, getNoticeTargetDate } from '@/lib/utils'
import { Bell, Plus, X, Loader2, AlertTriangle, CheckCircle, RefreshCw, FileSpreadsheet, ClipboardCheck, Trash2 } from 'lucide-react'
import { Modal, FormField } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'

// Parses the sheet's dd/mm/yyyy text (when present — often blank) into an ISO date.
function parseSheetDate(raw?: string | null): string {
  if (!raw) return ''
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return ''
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<any[]>([])
  const [residents, setResidents] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active')
  const [form, setForm] = useState({ resident_id: '', notice_date: new Date().toISOString().split('T')[0], reason: '', last_day_of_stay: '' })
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { resident_id: string; last_day_of_stay: string }>>({})
  const [settlementTarget, setSettlementTarget] = useState<any>(null)
  const [checklist, setChecklist] = useState({ keys_returned: false, room_condition_ok: false, dues_cleared: false, furniture_fixtures_ok: false })
  const [deductions, setDeductions] = useState<{ reason: string; amount: string }[]>([])
  const [refundMode, setRefundMode] = useState('upi')
  const [settling, setSettling] = useState(false)
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [statusFilter])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: n }, { data: r }, { data: sub }] = await Promise.all([
      supabase.from('notice_periods').select('*, resident:residents(id, name, room_number, mobile, rent_amount, security_deposit, bed_id)')
        .eq('status', statusFilter).order('notice_date', { ascending: false }),
      supabase.from('residents').select('id, name, room_number').eq('status', 'active'),
      supabase.from('notice_form_submissions').select('*').eq('review_status', 'pending').order('submitted_at', { ascending: false }),
    ])
    setNotices(n || [])
    setResidents(r || [])
    setSubmissions(sub || [])
    // Pre-fill each draft with a best-guess resident match (same room, active) + parsed date
    const drafts: Record<string, { resident_id: string; last_day_of_stay: string }> = {}
    sub?.forEach(s => {
      const guess = r?.find(res => res.room_number === s.room_number)
      drafts[s.id] = { resident_id: guess?.id || '', last_day_of_stay: parseSheetDate(s.last_day_raw) }
    })
    setReviewDrafts(drafts)
    setLoading(false)
  }

  const syncForm = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/sync-notice-form', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setSyncMsg(data.error || 'Sync failed.'); return }
      setSyncMsg(`✓ Checked ${data.totalRows} rows, ${data.imported} new`)
      fetchAll()
    } catch {
      setSyncMsg('Sync failed — check your connection.')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 5000)
    }
  }

  const applySubmission = async (sub: any) => {
    const draft = reviewDrafts[sub.id]
    if (!draft?.resident_id || !draft?.last_day_of_stay) { alert('Pick a resident and a last day of stay first.'); return }
    await supabase.from('notice_periods').insert({
      resident_id: draft.resident_id,
      notice_date: parseSheetDate(sub.submitted_at) || new Date().toISOString().split('T')[0],
      last_day_of_stay: draft.last_day_of_stay,
      reason: sub.reason || null,
      status: 'active',
      submitted_via: 'form',
    })
    await supabase.from('residents').update({ status: 'notice' }).eq('id', draft.resident_id)
    await supabase.from('notice_form_submissions').update({ review_status: 'applied', matched_resident_id: draft.resident_id }).eq('id', sub.id)
    fetchAll()
  }

  const dismissSubmission = async (id: string) => {
    await supabase.from('notice_form_submissions').update({ review_status: 'dismissed' }).eq('id', id)
    fetchAll()
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

  const openSettlement = (notice: any) => {
    setSettlementTarget(notice)
    setChecklist({ keys_returned: false, room_condition_ok: false, dues_cleared: false, furniture_fixtures_ok: false })
    setDeductions([])
    setRefundMode('upi')
  }

  const totalDeductions = deductions.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
  const depositAmount = Number(settlementTarget?.resident?.security_deposit) || 0
  const refundAmount = Math.max(0, depositAmount - totalDeductions)
  const allChecked = Object.values(checklist).every(Boolean)

  const completeMoveOut = async () => {
    if (!settlementTarget) return
    setSettling(true)
    const resident = settlementTarget.resident

    await supabase.from('deposit_settlements').insert({
      resident_id: resident.id,
      security_deposit: depositAmount,
      deductions: deductions.filter(d => d.reason.trim() && parseFloat(d.amount) > 0).map(d => ({ reason: d.reason, amount: parseFloat(d.amount) })),
      total_deductions: totalDeductions,
      refund_amount: refundAmount,
      refund_mode: refundMode,
      refund_status: 'pending',
      keys_returned: checklist.keys_returned,
      room_condition_ok: checklist.room_condition_ok,
      dues_cleared: checklist.dues_cleared,
      furniture_fixtures_ok: checklist.furniture_fixtures_ok,
    })
    await supabase.from('notice_periods').update({ status: 'completed' }).eq('id', settlementTarget.id)
    await supabase.from('residents').update({ status: 'vacated' }).eq('id', resident.id)
    if (resident.bed_id) {
      await supabase.from('beds').update({ status: 'available' }).eq('id', resident.bed_id)
      const { data: bed } = await supabase.from('beds').select('room_id').eq('id', resident.bed_id).single()
      if (bed?.room_id) {
        const { data: allBeds } = await supabase.from('beds').select('status').eq('room_id', bed.room_id)
        const occupied = allBeds?.filter(b => b.status === 'occupied').length || 0
        await supabase.from('rooms').update({ status: occupied === 0 ? 'available' : 'partial' }).eq('id', bed.room_id)
      }
    }

    setSettlementTarget(null)
    setSettling(false)
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {syncMsg && <span style={{ fontSize: '12px', color: syncMsg.startsWith('✓') ? '#34d399' : '#f87171' }}>{syncMsg}</span>}
          <button onClick={syncForm} disabled={syncing} className="bb-btn-secondary">
            {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            Sync Google Form
          </button>
          <button onClick={() => setShowModal(true)} className="bb-btn-primary">
            <Plus size={16} /> Add Notice
          </button>
        </div>
      </div>

      {/* Google Form review queue — deliberately requires confirmation, not auto-applied.
          The form has repeat/old submissions from residents who are still currently active. */}
      {submissions.length > 0 && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', borderColor: 'rgba(249,115,22,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <FileSpreadsheet size={16} color="#f97316" />
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              {submissions.length} Form Submission{submissions.length > 1 ? 's' : ''} Awaiting Review
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
            From the "Notice to Vacate" Google Form. Confirm the matching resident and last day before this becomes an official notice — some of these may be old or already resolved.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {submissions.map(s => {
              const draft = reviewDrafts[s.id] || { resident_id: '', last_day_of_stay: '' }
              return (
                <div key={s.id} className="bb-notice-review-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: '10px', alignItems: 'center', padding: '12px', background: 'var(--surface-2)', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{s.name || '—'} <span style={{ fontWeight: '400', color: 'var(--text-muted)' }}>(Room {s.room_number || '?'})</span></div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.submitted_at} · {s.reason?.slice(0, 60) || 'No reason given'}</div>
                  </div>
                  <select className="bb-input" value={draft.resident_id} onChange={e => setReviewDrafts(d => ({ ...d, [s.id]: { ...draft, resident_id: e.target.value } }))}>
                    <option value="">Match to resident...</option>
                    {residents.map(r => <option key={r.id} value={r.id}>{r.name} — Room {r.room_number}</option>)}
                  </select>
                  <input className="bb-input" type="date" value={draft.last_day_of_stay} onChange={e => setReviewDrafts(d => ({ ...d, [s.id]: { ...draft, last_day_of_stay: e.target.value } }))} />
                  <button onClick={() => applySubmission(s)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#34d399', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>Apply</button>
                  <button onClick={() => dismissSubmission(s.id)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Dismiss</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
            const daysLeft = getNoticeDaysRemaining(n) ?? 0
            const urgent = daysLeft <= 14
            const target = getNoticeTargetDate(n)
            const totalWindowDays = target ? Math.max(1, Math.round((new Date(target).getTime() - new Date(n.notice_date).getTime()) / 86400000)) : 60
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
                      width: `${Math.max(0, Math.min(100, ((totalWindowDays - daysLeft) / totalWindowDays) * 100))}%`,
                      background: urgent ? 'linear-gradient(90deg, #f87171, #ef4444)' : undefined
                    }} />
                  </div>
                )}

                {n.status === 'active' && (
                  <button
                    onClick={() => openSettlement(n)}
                    style={{
                      width: '100%', padding: '8px', borderRadius: '8px',
                      border: '1px solid rgba(52,211,153,0.3)',
                      background: 'rgba(52,211,153,0.05)',
                      color: '#34d399', fontSize: '12px', fontWeight: '600',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '6px'
                    }}
                  >
                    <ClipboardCheck size={13} /> Move-Out & Settle Deposit
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

      {/* Move-out checklist + deposit settlement */}
      {settlementTarget && (
        <Modal title={`Move Out — ${settlementTarget.resident?.name}`} onClose={() => setSettlementTarget(null)} maxWidth="520px">
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
            Room {settlementTarget.resident?.room_number} · Security deposit {formatCurrency(depositAmount)}
          </div>

          <div style={{ fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>Checklist</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {[
              { key: 'keys_returned', label: 'Keys & access cards returned' },
              { key: 'room_condition_ok', label: 'Room condition verified (normal wear only)' },
              { key: 'dues_cleared', label: 'All rent & electricity dues cleared' },
              { key: 'furniture_fixtures_ok', label: 'Furniture & fixtures accounted for' },
            ].map(item => (
              <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={(checklist as any)[item.key]} onChange={e => setChecklist(c => ({ ...c, [item.key]: e.target.checked }))} style={{ width: 16, height: 16 }} />
                {item.label}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Deductions</span>
            <button onClick={() => setDeductions(d => [...d, { reason: '', amount: '' }])} className="bb-btn-secondary" style={{ fontSize: '11px', padding: '5px 10px' }}><Plus size={12} /> Add</button>
          </div>
          {deductions.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="bb-input" placeholder="Reason (damage, unpaid dues...)" value={d.reason} onChange={e => setDeductions(ds => ds.map((x, xi) => xi === i ? { ...x, reason: e.target.value } : x))} />
              <input className="bb-input" style={{ maxWidth: 110 }} type="number" placeholder="₹" value={d.amount} onChange={e => setDeductions(ds => ds.map((x, xi) => xi === i ? { ...x, amount: e.target.value } : x))} />
              <button onClick={() => setDeductions(ds => ds.filter((_, xi) => xi !== i))} className="bb-icon-btn" style={{ width: 40, height: 40, minWidth: 40, minHeight: 40 }}><Trash2 size={14} /></button>
            </div>
          ))}

          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 14, margin: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span style={{ color: 'var(--text-muted)' }}>Deposit</span><span>{formatCurrency(depositAmount)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span style={{ color: 'var(--text-muted)' }}>Total deductions</span><span style={{ color: totalDeductions > 0 ? '#f87171' : 'inherit' }}>−{formatCurrency(totalDeductions)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}><span>Refund due</span><span style={{ color: 'var(--teal-500)' }}>{formatCurrency(refundAmount)}</span></div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Refund Mode</label>
            <select className="bb-input" value={refundMode} onChange={e => setRefundMode(e.target.value)}>
              <option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option>
            </select>
          </div>

          {!allChecked && <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 12 }}>Complete all checklist items before finalizing.</div>}
          <button onClick={completeMoveOut} disabled={!allChecked || settling} className="bb-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            {settling ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ClipboardCheck size={14} />}
            Complete Move-Out — Refund {formatCurrency(refundAmount)}
          </button>
        </Modal>
      )}
    </div>
  )
}
