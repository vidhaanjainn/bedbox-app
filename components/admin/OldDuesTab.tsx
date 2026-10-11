'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { oldDueBalances, OldDue, OldDuePayment } from '@/lib/dues'
import { Plus, X, Loader2, MessageCircle } from 'lucide-react'

type ResidentLite = { id: string; name: string; room_number: string; mobile?: string | null; status?: string }

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' } as const

function waLink(r: ResidentLite, balance: number) {
  const digits = (r.mobile || '').replace(/\D/g, '')
  const phone = digits.length === 10 ? `91${digits}` : digits
  const msg = `Hi ${r.name.split(' ')[0]},\n\nYou have ${formatCurrency(balance)} of old dues still pending. Clearing soon?`
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
}

// "Old dues" = balances carried forward from before the app. Each is an
// original amount plus dated payments, so what's still pending shows on the
// resident's own record and what was received counts as cash for the month it
// actually came in (see lib/dues.ts).
export function OldDuesTab({
  dues, payments, residents, adminId, monthLabel, cashThisMonth, onChanged,
}: {
  dues: OldDue[]
  payments: OldDuePayment[]
  residents: ResidentLite[]
  adminId?: string | null
  monthLabel: string
  cashThisMonth: number
  onChanged: () => void
}) {
  const supabase = createClient()
  const [showCleared, setShowCleared] = useState(false)
  const [payFor, setPayFor] = useState<any | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', mode: 'upi', notes: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ resident_id: '', amount: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const byId = useMemo(() => Object.fromEntries(residents.map(r => [r.id, r])), [residents])
  const rows = useMemo(() => oldDueBalances(dues, payments)
    .filter(d => showCleared || d.balance > 0)
    .sort((a, b) => b.balance - a.balance), [dues, payments, showCleared])
  const totalPending = oldDueBalances(dues, payments).reduce((s, d) => s + d.balance, 0)

  const savePayment = async () => {
    const amount = parseFloat(payForm.amount)
    if (!payFor || !amount || amount <= 0) { setError('Enter a valid amount.'); return }
    if (amount > payFor.balance) { setError(`That's more than the ${formatCurrency(payFor.balance)} still pending.`); return }
    setBusy(true); setError('')
    const { error: err } = await supabase.from('old_due_payments').insert({
      old_due_id: payFor.id, resident_id: payFor.resident_id, amount,
      payment_mode: payForm.mode, notes: payForm.notes || null, collected_by: adminId || null,
    })
    setBusy(false)
    if (err) { setError('Could not save the payment.'); return }
    setPayFor(null); setPayForm({ amount: '', mode: 'upi', notes: '' }); onChanged()
  }

  const saveDue = async () => {
    const amount = parseFloat(addForm.amount)
    if (!addForm.resident_id || !amount || amount <= 0) { setError('Pick a resident and enter the amount.'); return }
    setBusy(true); setError('')
    const { error: err } = await supabase.from('old_dues').insert({ resident_id: addForm.resident_id, original_amount: amount, reason: addForm.reason || null })
    setBusy(false)
    if (err) { setError('Could not save the due.'); return }
    setShowAdd(false); setAddForm({ resident_id: '', amount: '', reason: '' }); onChanged()
  }

  const modal = (title: string, onClose: () => void, children: React.ReactNode) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        {children}
        {error && <div style={{ fontSize: 12, color: '#f87171', marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="stat-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f87171', fontFamily: 'Syne, sans-serif' }}>{formatCurrency(totalPending)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Old dues pending</div>
        </div>
        <div className="stat-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399', fontFamily: 'Syne, sans-serif' }}>{formatCurrency(cashThisMonth)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Old dues received in {monthLabel}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="bb-btn-secondary" onClick={() => { setError(''); setShowAdd(true) }}><Plus size={14} /> Add old due</button>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showCleared} onChange={e => setShowCleared(e.target.checked)} /> Show cleared
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No pending old dues 🎉</div>
      ) : rows.map(d => {
        const r = byId[d.resident_id]
        const history = payments.filter(p => p.old_due_id === d.id).sort((a, b) => +new Date(b.paid_at) - +new Date(a.paid_at))
        return (
          <div key={d.id} className="glass-card" style={{ padding: 18, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{r?.name || 'Unknown resident'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Room {r?.room_number}{d.reason ? ` · ${d.reason}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: d.balance > 0 ? '#f87171' : '#34d399', fontFamily: 'Syne, sans-serif' }}>{d.balance > 0 ? formatCurrency(d.balance) : 'Cleared'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>of {formatCurrency(d.original)} · paid {formatCurrency(d.paid)}</div>
              </div>
            </div>
            {history.length > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                {history.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', padding: '2px 0' }}>
                    <span>{formatDate(p.paid_at)}{p.payment_mode ? ` · ${p.payment_mode.replace('_', ' ')}` : ''}</span>
                    <span style={{ color: '#34d399' }}>+ {formatCurrency(Number(p.amount))}</span>
                  </div>
                ))}
              </div>
            )}
            {d.balance > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button onClick={() => { setError(''); setPayFor(d); setPayForm({ amount: String(d.balance), mode: 'upi', notes: '' }) }}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,212,200,0.3)', background: 'rgba(0,212,200,0.08)', color: 'var(--teal-500)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Log payment
                </button>
                {r?.mobile && (
                  <a href={waLink(r, d.balance)} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#34d399', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    <MessageCircle size={12} /> WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        )
      })}

      {payFor && modal('Log old-dues payment', () => setPayFor(null), (
        <>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface-2)', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{byId[payFor.resident_id]?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Pending: {formatCurrency(payFor.balance)}</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Amount received (₹) *</label>
            <input className="bb-input" type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Payment mode</label>
            <select className="bb-input" value={payForm.mode} onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))}>
              <option value="upi">UPI / GPay</option><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option>
            </select>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Notes</label>
            <input className="bb-input" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <button className="bb-btn-primary" style={{ width: '100%' }} disabled={busy} onClick={savePayment}>
            {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save payment'}
          </button>
        </>
      ))}

      {showAdd && modal('Add old due', () => setShowAdd(false), (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Resident *</label>
            <select className="bb-input" value={addForm.resident_id} onChange={e => setAddForm(f => ({ ...f, resident_id: e.target.value }))}>
              <option value="">Select…</option>
              {residents.map(r => <option key={r.id} value={r.id}>{r.room_number} · {r.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Amount owed (₹) *</label>
            <input className="bb-input" type="number" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>What is it for?</label>
            <input className="bb-input" placeholder="e.g. old rent, damages" value={addForm.reason} onChange={e => setAddForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <button className="bb-btn-primary" style={{ width: '100%' }} disabled={busy} onClick={saveDue}>
            {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save'}
          </button>
        </>
      ))}
    </div>
  )
}
