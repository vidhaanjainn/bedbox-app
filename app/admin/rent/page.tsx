'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentAdmin, CurrentAdmin } from '@/lib/current-admin'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useIsMobile } from '@/lib/useIsMobile'
import { DocViewerModal, DocPreview } from '@/components/ui/DocViewerModal'
import { CreditCard, Plus, Search, CheckCircle, Clock, AlertCircle, Loader2, X, Upload, MessageCircle, FileSpreadsheet } from 'lucide-react'

function waReminderLink(mobile: string, name: string, room: string, outstanding: number) {
  const digits = (mobile || '').replace(/\D/g, '')
  const phone = digits.length === 10 ? `91${digits}` : digits
  const message = `Hi ${name.split(' ')[0]},\n\nYour rental and electricity charges are due for this month. Clearing today?`
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

export default function RentPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'paid'>('all')
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [showLogModal, setShowLogModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [logForm, setLogForm] = useState({ amount: '', payment_mode: 'upi', notes: '', collected_by: '', electricity: '' })
  const [logLoading, setLogLoading] = useState(false)
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null)
  const [admins, setAdmins] = useState<{ id: string; name: string }[]>([])
  const [previewDoc, setPreviewDoc] = useState<DocPreview | null>(null)
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null)
  const supabase = createClient()
  const isMobile = useIsMobile()

  useEffect(() => {
    getCurrentAdmin(supabase).then(admin => {
      setCurrentAdmin(admin)
      if (admin) setLogForm(f => ({ ...f, collected_by: admin.id }))
    })
    supabase.from('admins').select('id, name').eq('is_active', true).order('name').then(({ data }) => setAdmins(data || []))
  }, [])
  useEffect(() => { fetchPayments() }, [monthFilter, yearFilter])

  const fetchPayments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('rent_payments')
      .select('*, resident:residents(name, room_number, mobile, is_test_account), collected_admin:admins!rent_payments_collected_by_fkey(name)')
      .eq('month', monthFilter)
      .eq('year', yearFilter)
      .order('status')
    // The review/test resident account never appears in the real Rent
    // Tracker ledger or its totals - manage it from the resident's own
    // detail page instead.
    setPayments((data || []).filter((p: any) => !p.resident?.is_test_account))
    setLoading(false)
  }

  const generateMonthlyRent = async () => {
    const { data: activeResidents } = await supabase
      .from('residents')
      .select('id, rent_amount')
      .eq('status', 'active')

    if (!activeResidents?.length) return

    const existing = payments.map(p => p.resident_id)
    const toCreate = activeResidents.filter(r => !existing.includes(r.id))

    if (!toCreate.length) {
      alert('All active residents already have rent records for this month')
      return
    }

    const records = toCreate.map(r => ({
      resident_id: r.id,
      month: monthFilter,
      year: yearFilter,
      rent_amount: r.rent_amount,
      total_amount: r.rent_amount,
      status: 'pending',
    }))

    await supabase.from('rent_payments').insert(records)
    fetchPayments()
  }

  const handleLogPayment = async () => {
    if (!selectedPayment || !logForm.amount) return
    setLogLoading(true)

    let screenshotPath = null
    if (screenshot) {
      const path = `receipts/${selectedPayment.id}/${Date.now()}.${screenshot.name.split('.').pop()}`
      await supabase.storage.from('private-docs').upload(path, screenshot)
      screenshotPath = path
    }

    // Electricity is optional here - if the admin doesn't have the reading
    // yet, we leave electricity_logged_at untouched so the caution badge
    // keeps showing on this record until someone does log it (here or on
    // the Electricity page), instead of silently treating "not entered" the
    // same as "zero".
    const electricityProvided = logForm.electricity.trim() !== ''
    const electricityAmount = electricityProvided ? parseFloat(logForm.electricity) || 0 : selectedPayment.electricity_amount
    const totalAmount = Number(selectedPayment.rent_amount) + electricityAmount + Number(selectedPayment.late_fee || 0)

    const newPaid = selectedPayment.amount_paid + parseFloat(logForm.amount)
    const isFullyPaid = newPaid >= totalAmount

    await supabase.from('rent_payments').update({
      amount_paid: newPaid,
      payment_mode: logForm.payment_mode,
      payment_screenshot_path: screenshotPath,
      notes: logForm.notes || null,
      paid_at: isFullyPaid ? new Date().toISOString() : null,
      status: isFullyPaid ? 'paid' : 'partial',
      collected_by: logForm.collected_by || currentAdmin?.id || null,
      electricity_amount: electricityAmount,
      total_amount: totalAmount,
      ...(electricityProvided ? { electricity_logged_at: new Date().toISOString() } : {}),
    }).eq('id', selectedPayment.id)

    setShowLogModal(false)
    setSelectedPayment(null)
    setLogForm({ amount: '', payment_mode: 'upi', notes: '', collected_by: currentAdmin?.id || '', electricity: '' })
    setScreenshot(null)
    setLogLoading(false)
    fetchPayments()
  }

  const syncToSheets = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/sync-rent-dues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: monthFilter, year: yearFilter }),
      })
      const data = await res.json()
      if (!res.ok) { setSyncMsg(data.error || 'Sync failed.'); return }
      setSyncMsg(`✓ Synced ${data.count} rows to Sheets`)
    } catch {
      setSyncMsg('Sync failed - check your connection.')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 5000)
    }
  }

  const viewPaymentProof = async (path: string) => {
    setLoadingDoc(path)
    const { data } = await supabase.storage.from('resident-docs').createSignedUrl(path, 300)
    if (data?.signedUrl) setPreviewDoc({ url: data.signedUrl, type: 'image', label: 'Payment Screenshot' })
    setLoadingDoc(null)
  }

  const requestReceipt = async (paymentId: string) => {
    await supabase.from('rent_payments').update({ receipt_requested_at: new Date().toISOString() }).eq('id', paymentId)
    alert('Receipt request noted. You can now generate and send the receipt.')
    fetchPayments()
  }

  const filtered = payments
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => p.resident?.name?.toLowerCase().includes(search.toLowerCase()) || p.resident?.room_number?.includes(search))
    .sort((a, b) => {
      // Only impose an order when showing everything - picking a specific
      // status chip already puts exactly what you asked for "on top" (it's
      // all that's left), and re-sorting within a single status would just
      // be noise. In "All", surface what needs action first: pending, then
      // partial, then paid last.
      if (statusFilter !== 'all') return 0
      const rank: Record<string, number> = { pending: 0, partial: 1, paid: 2 }
      return (rank[a.status] ?? 3) - (rank[b.status] ?? 3)
    })

  const stats = {
    total: payments.length,
    paid: payments.filter(p => p.status === 'paid').length,
    pending: payments.filter(p => p.status === 'pending').length,
    partial: payments.filter(p => p.status === 'partial').length,
    totalCollected: payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount_paid, 0),
    totalOutstanding: payments.filter(p => p.status !== 'paid').reduce((s, p) => s + (p.total_amount - p.amount_paid), 0),
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  // Shared between the desktop table row and the mobile card so the status
  // pill and action buttons don't have to be written (and kept in sync)
  // twice.
  const statusBadge = (p: any) => (
    <>
      <span className="status-badge" style={{
        background: p.status === 'paid' ? 'rgba(52,211,153,0.1)' : p.status === 'partial' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
        color: p.status === 'paid' ? '#34d399' : p.status === 'partial' ? '#fbbf24' : '#f87171',
        borderColor: p.status === 'paid' ? 'rgba(52,211,153,0.3)' : p.status === 'partial' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)',
      }}>
        {p.status}
      </span>
      {p.resident_reported_at && p.status !== 'paid' && (
        <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 3 }}>
          <AlertCircle size={10} /> Reported {formatCurrency(p.resident_reported_amount)}
        </div>
      )}
    </>
  )

  const rowActions = (p: any) => (
    <>
      {p.status !== 'paid' && p.resident?.mobile && (
        <a
          href={waReminderLink(p.resident.mobile, p.resident.name, p.resident.room_number, p.total_amount - p.amount_paid)}
          target="_blank" rel="noopener noreferrer"
          title="Send WhatsApp reminder"
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(52,211,153,0.3)',
            background: 'rgba(52,211,153,0.08)', color: '#34d399',
            fontSize: '11px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none'
          }}
        >
          <MessageCircle size={12} /> WhatsApp
        </a>
      )}
      {p.resident_payment_screenshot_path && (
        <button
          onClick={() => viewPaymentProof(p.resident_payment_screenshot_path)}
          disabled={loadingDoc === p.resident_payment_screenshot_path}
          title="View resident's payment screenshot"
          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {loadingDoc === p.resident_payment_screenshot_path && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />} Proof
        </button>
      )}
      {p.status !== 'paid' && (
        <button
          onClick={() => { setSelectedPayment(p); setShowLogModal(true); setLogForm({ amount: String(p.resident_reported_amount || (p.total_amount - p.amount_paid)), payment_mode: p.payment_mode || 'upi', notes: '', collected_by: currentAdmin?.id || '', electricity: p.electricity_logged_at ? String(p.electricity_amount) : '' }) }}
          style={{
            padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(0,212,200,0.3)',
            background: 'rgba(0,212,200,0.08)', color: 'var(--teal-500)',
            fontSize: '11px', fontWeight: '600', cursor: 'pointer'
          }}
        >
          Log
        </button>
      )}
      {p.status === 'paid' && !p.receipt_sent_at && (
        <button
          onClick={() => requestReceipt(p.id)}
          style={{
            padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-muted)',
            fontSize: '11px', fontWeight: '600', cursor: 'pointer'
          }}
        >
          Receipt
        </button>
      )}
      {p.receipt_sent_at && (
        <span style={{ fontSize: '11px', color: '#34d399' }}>✓ Sent</span>
      )}
    </>
  )

  return (
    <div style={{ padding: '32px' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Rent Tracker
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            {months[monthFilter - 1]} {yearFilter} · {stats.paid}/{stats.total} paid · {formatCurrency(stats.totalOutstanding)} outstanding
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {syncMsg && <span style={{ fontSize: '12px', color: syncMsg.startsWith('✓') ? '#34d399' : '#f87171' }}>{syncMsg}</span>}
          <button onClick={syncToSheets} disabled={syncing} className="bb-btn-secondary">
            {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSpreadsheet size={14} />}
            Sync to Sheets
          </button>
          <button onClick={generateMonthlyRent} className="bb-btn-secondary">
            <Plus size={14} /> Generate Monthly
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="bb-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(parseInt(e.target.value))}>
          {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="bb-input" style={{ width: 'auto' }} value={yearFilter} onChange={e => setYearFilter(parseInt(e.target.value))}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Collected', value: formatCurrency(stats.totalCollected), color: '#34d399' },
          { label: 'Outstanding', value: formatCurrency(stats.totalOutstanding), color: '#fbbf24' },
          { label: 'Paid', value: `${stats.paid} residents`, color: '#34d399' },
          { label: 'Pending', value: `${stats.pending} residents`, color: '#f87171' },
          { label: 'Partial', value: `${stats.partial} residents`, color: '#fbbf24' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: s.color, fontFamily: 'Syne, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + status filter */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', maxWidth: '320px', flex: '1 1 200px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input className="bb-input" style={{ paddingLeft: '38px' }} placeholder="Search resident or room..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
          {([
            { key: 'all', label: 'All', count: stats.total },
            { key: 'pending', label: '⚠ Pending', count: stats.pending },
            { key: 'partial', label: '◐ Partial', count: stats.partial },
            { key: 'paid', label: '✓ Paid', count: stats.paid },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', background: statusFilter === f.key ? 'var(--teal-500)' : 'transparent', color: statusFilter === f.key ? 'var(--navy-900)' : 'var(--text-muted)' }}>
              {f.label}{f.count > 0 ? ` (${f.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Table (desktop) / cards (mobile) - phones get the essentials
          (resident, total due, status, actions) up front with the rent/
          electricity/late-fee/mode breakdown behind "More details" instead
          of a table too wide to fit, so nothing scrolls sideways. */}
      {loading ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : isMobile ? (
        <div>
          {filtered.map(p => (
            <div key={p.id} className="bb-row-card">
              <div className="bb-row-card-top">
                <div>
                  <div className="bb-row-card-title">{p.resident?.name}</div>
                  <div className="bb-row-card-sub">Room {p.resident?.room_number}</div>
                </div>
                {statusBadge(p)}
              </div>
              <div className="bb-row-card-amount">
                <span className="bb-row-card-amount-value">{formatCurrency(p.total_amount)}</span>
                <span className="bb-row-card-amount-label">Total Due</span>
              </div>
              <details className="bb-row-card-details">
                <summary>More details</summary>
                <div className="bb-row-card-detail-row"><span>Rent</span><span>{formatCurrency(p.rent_amount)}</span></div>
                <div className="bb-row-card-detail-row">
                  <span>Electricity</span>
                  <span>{p.electricity_logged_at ? (p.electricity_amount > 0 ? formatCurrency(p.electricity_amount) : '-') : 'Not logged'}</span>
                </div>
                <div className="bb-row-card-detail-row"><span>Late Fee</span><span>{p.late_fee > 0 ? formatCurrency(p.late_fee) : '-'}</span></div>
                <div className="bb-row-card-detail-row"><span>Paid</span><span>{formatCurrency(p.amount_paid)}</span></div>
                <div className="bb-row-card-detail-row">
                  <span>Mode</span>
                  <span style={{ textTransform: 'capitalize' }}>{p.payment_mode?.replace('_', ' ') || '-'}{p.collected_admin?.name ? ` (by ${p.collected_admin.name.split(' ')[0]})` : ''}</span>
                </div>
              </details>
              <div className="bb-row-card-actions">
                {rowActions(p)}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              {payments.length === 0 ? 'No rent records for this month. Tap "Generate Monthly" to create them.' : `No ${statusFilter} records match${search ? ' your search' : ''}.`}
            </div>
          )}
        </div>
      ) : (
      <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Room</th>
                  <th>Rent</th>
                  <th>Electricity</th>
                  <th>Late Fee</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{p.resident?.name}</td>
                    <td>Room {p.resident?.room_number}</td>
                    <td>{formatCurrency(p.rent_amount)}</td>
                    <td>
                      {p.electricity_logged_at ? (p.electricity_amount > 0 ? formatCurrency(p.electricity_amount) : '-') : (
                        <span title="Electricity reading not logged yet for this month" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#f97316' }}>
                          <AlertCircle size={12} /> Not logged
                        </span>
                      )}
                    </td>
                    <td style={{ color: p.late_fee > 0 ? '#fbbf24' : 'inherit' }}>
                      {p.late_fee > 0 ? formatCurrency(p.late_fee) : '-'}
                    </td>
                    <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(p.total_amount)}</td>
                    <td style={{ color: '#34d399', fontWeight: '600' }}>{formatCurrency(p.amount_paid)}</td>
                    <td style={{ fontSize: '12px' }}>
                      <div style={{ textTransform: 'capitalize' }}>{p.payment_mode?.replace('_', ' ') || '-'}</div>
                      {p.collected_admin?.name && <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>by {p.collected_admin.name.split(' ')[0]}</div>}
                    </td>
                    <td>{statusBadge(p)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {rowActions(p)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                {payments.length === 0 ? 'No rent records for this month. Click "Generate Monthly" to create them.' : `No ${statusFilter} records match${search ? ' your search' : ''}.`}
              </div>
            )}
          </div>
      </div>
      )}

      {/* Log Payment Modal */}
      {showLogModal && selectedPayment && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '24px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Log Payment
              </h3>
              <button onClick={() => setShowLogModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--surface-2)', marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{selectedPayment.resident?.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Room {selectedPayment.resident?.room_number} · Total due: {formatCurrency(selectedPayment.total_amount - selectedPayment.amount_paid)}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Amount Received (₹) *
              </label>
              <input className="bb-input" type="number" placeholder="Enter amount"
                value={logForm.amount} onChange={e => setLogForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Payment Mode
              </label>
              <select className="bb-input" value={logForm.payment_mode} onChange={e => setLogForm(f => ({ ...f, payment_mode: e.target.value }))}>
                <option value="upi">UPI / GPay</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Electricity this month (₹) <span style={{ textTransform: 'none', fontWeight: 400 }}>- optional</span>
              </label>
              <input className="bb-input" type="number" placeholder={selectedPayment?.electricity_logged_at ? 'Already logged' : 'Leave blank if not known yet'}
                value={logForm.electricity} onChange={e => setLogForm(f => ({ ...f, electricity: e.target.value }))} />
              {!selectedPayment?.electricity_logged_at && (
                <div style={{ fontSize: 11, color: '#f97316', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={11} /> Not logged yet - will keep showing as a caution until entered here or on the Electricity page.
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Received By
              </label>
              <select className="bb-input" value={logForm.collected_by} onChange={e => setLogForm(f => ({ ...f, collected_by: e.target.value }))}>
                {admins.map(a => (
                  <option key={a.id} value={a.id}>{a.name}{a.id === currentAdmin?.id ? ' (you)' : ''}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Payment Screenshot (optional)
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                border: `1px dashed ${screenshot ? 'rgba(0,212,200,0.4)' : 'var(--border)'}`,
                borderRadius: '10px', cursor: 'pointer',
                background: screenshot ? 'rgba(0,212,200,0.05)' : 'var(--surface-2)'
              }}>
                <Upload size={16} color={screenshot ? 'var(--teal-500)' : 'var(--text-muted)'} />
                <span style={{ fontSize: '13px', color: screenshot ? 'var(--teal-500)' : 'var(--text-muted)' }}>
                  {screenshot ? screenshot.name : 'Upload screenshot'}
                </span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setScreenshot(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Notes (optional)
              </label>
              <input className="bb-input" placeholder="Any notes..." value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowLogModal(false)} className="bb-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
              <button onClick={handleLogPayment} className="bb-btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={logLoading || !logForm.amount}>
                {logLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      <DocViewerModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  )
}
