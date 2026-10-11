'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { deriveInvoice, toDateInput, fromDateInput } from '@/lib/rent'
import { X, Loader2, Upload, Eye } from 'lucide-react'

export const fieldLabel = { display: 'block', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' } as const

export type ReceivedBy = { collected_by: string; received_by_name: string }
type Admin = { id: string; name: string }

// "Who got the money": one of the app's admins, or anyone else by name (a
// family member, the manager, staff) - the money isn't always handed to
// someone with a login. Value is { collected_by: adminId | '', received_by_name }.
export function ReceivedByField({ value, onChange, admins, currentAdminId }: {
  value: ReceivedBy; onChange: (v: ReceivedBy) => void; admins: Admin[]; currentAdminId?: string | null
}) {
  const isOther = !value.collected_by
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={fieldLabel}>Received by</label>
      <select className="bb-input" value={isOther ? '__other' : value.collected_by}
        onChange={e => onChange(e.target.value === '__other' ? { collected_by: '', received_by_name: value.received_by_name } : { collected_by: e.target.value, received_by_name: '' })}>
        {admins.map(a => <option key={a.id} value={a.id}>{a.name}{a.id === currentAdminId ? ' (you)' : ''}</option>)}
        <option value="__other">Someone else…</option>
      </select>
      {isOther && (
        <input className="bb-input" style={{ marginTop: 8 }} placeholder="Name (e.g. Papa, manager)" value={value.received_by_name}
          onChange={e => onChange({ collected_by: '', received_by_name: e.target.value })} />
      )}
    </div>
  )
}

// Full correction of one month's invoice: amounts, what was received, by whom,
// how, when, notes and proof. Everything derived (total, split, status) is
// recomputed by lib/rent.ts on save, never typed by hand.
export function EditPaymentModal({ payment, admins, currentAdminId, onClose, onSaved }: {
  payment: any; admins: Admin[]; currentAdminId?: string | null; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    rent: String(payment.rent_amount ?? ''),
    electricity: payment.electricity_logged_at || Number(payment.electricity_amount) > 0 ? String(payment.electricity_amount ?? 0) : '',
    paid: String(payment.amount_paid ?? 0),
    mode: payment.payment_mode || 'upi',
    date: toDateInput(payment.paid_at || payment.created_at),
    notes: payment.notes || '',
  })
  const [receivedBy, setReceivedBy] = useState<ReceivedBy>({
    collected_by: payment.collected_by || (payment.received_by_name ? '' : (currentAdminId || admins[0]?.id || '')),
    received_by_name: payment.received_by_name || '',
  })
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const forgiven = !!payment.late_fee_forgiven_at
  const preview = deriveInvoice({
    rent: parseFloat(form.rent) || 0,
    electricity: form.electricity.trim() === '' ? 0 : parseFloat(form.electricity) || 0,
    lateFee: Number(payment.late_fee || 0), lateFeeForgiven: forgiven,
    prorataCredit: Number(payment.prorata_credit_applied || 0),
    paid: parseFloat(form.paid) || 0,
  })

  const viewProof = async () => {
    const { data } = await supabase.storage.from('private-docs').createSignedUrl(payment.payment_screenshot_path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }

  const save = async () => {
    const rent = parseFloat(form.rent)
    if (!(rent >= 0)) { setError('Enter the rent amount.'); return }
    if (!receivedBy.collected_by && Number(form.paid) > 0 && !receivedBy.received_by_name.trim()) { setError('Who received the money?'); return }
    setBusy(true); setError('')
    let screenshotPath = payment.payment_screenshot_path || null
    if (screenshot) {
      const path = `receipts/${payment.id}/${Date.now()}.${screenshot.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('private-docs').upload(path, screenshot)
      if (upErr) { setBusy(false); setError('Screenshot upload failed.'); return }
      screenshotPath = path
    }
    const electricityGiven = form.electricity.trim() !== ''
    const { error: err } = await supabase.from('rent_payments').update({
      rent_amount: rent,
      electricity_amount: electricityGiven ? parseFloat(form.electricity) || 0 : 0,
      electricity_logged_at: electricityGiven ? (payment.electricity_logged_at || new Date().toISOString()) : null,
      total_amount: preview.total_amount,
      amount_paid: preview.amount_paid,
      rent_paid: preview.rent_paid,
      electricity_paid: preview.electricity_paid,
      late_fee_paid: preview.late_fee_paid,
      status: preview.status,
      payment_mode: preview.amount_paid > 0 ? form.mode : null,
      paid_at: preview.amount_paid > 0 ? fromDateInput(form.date) : null,
      collected_by: preview.amount_paid > 0 ? (receivedBy.collected_by || null) : null,
      received_by_name: preview.amount_paid > 0 && !receivedBy.collected_by ? receivedBy.received_by_name.trim() : null,
      notes: form.notes.trim() || null,
      payment_screenshot_path: screenshotPath,
    }).eq('id', payment.id)
    setBusy(false)
    if (err) { setError('Could not save changes.'); return }
    onSaved()
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 480, padding: 28, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Edit payment</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          {payment.resident?.name} · Room {payment.resident?.room_number} · {months[payment.month - 1]} {payment.year}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>Rent (₹)</label>
            <input className="bb-input" type="number" value={form.rent} onChange={e => setForm(f => ({ ...f, rent: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>Electricity (₹)</label>
            <input className="bb-input" type="number" placeholder="Not logged" value={form.electricity} onChange={e => setForm(f => ({ ...f, electricity: e.target.value }))} />
          </div>
        </div>
        {Number(payment.late_fee) > 0 && (
          <div style={{ fontSize: 12, color: forgiven ? '#34d399' : '#fbbf24', marginTop: -8, marginBottom: 14 }}>
            Late fee {formatCurrency(payment.late_fee)}{forgiven ? ' - forgiven' : ' - use "Forgive Fee" on the row to waive it'}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>Total received (₹)</label>
            <input className="bb-input" type="number" value={form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>Date received</label>
            <input className="bb-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
        </div>

        <ReceivedByField value={receivedBy} onChange={setReceivedBy} admins={admins} currentAdminId={currentAdminId} />

        <div style={{ marginBottom: 16 }}>
          <label style={fieldLabel}>Payment mode</label>
          <select className="bb-input" value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
            <option value="upi">UPI / GPay</option><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={fieldLabel}>Notes</label>
          <textarea className="bb-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: 18, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {payment.payment_screenshot_path && !screenshot && (
            <button type="button" className="bb-btn-secondary" style={{ fontSize: 12 }} onClick={viewProof}><Eye size={13} /> View screenshot</button>
          )}
          <label className="bb-btn-secondary" style={{ fontSize: 12, cursor: 'pointer' }}>
            <Upload size={13} /> {screenshot ? screenshot.name : payment.payment_screenshot_path ? 'Replace screenshot' : 'Add screenshot'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setScreenshot(e.target.files?.[0] || null)} />
          </label>
        </div>

        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', marginBottom: 18, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Total due</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(preview.total_amount)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={{ color: 'var(--text-muted)' }}>Balance</span><span style={{ color: preview.balance > 0 ? '#f87171' : '#34d399', fontWeight: 700 }}>{preview.balance > 0 ? formatCurrency(preview.balance) : 'Cleared'}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={{ color: 'var(--text-muted)' }}>Status</span><span style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{preview.status}</span></div>
          {preview.amount_paid > preview.total_amount && <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 6 }}>⚠ {formatCurrency(preview.amount_paid - preview.total_amount)} more than what's due - double check.</div>}
        </div>

        {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{error}</div>}
        <button className="bb-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={save}>
          {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
