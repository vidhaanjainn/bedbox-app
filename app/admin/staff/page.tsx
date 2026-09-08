'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Users, Wallet, Plus, X, Loader2, CheckCircle, Receipt, Pencil, ArrowDownLeft } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'

export default function StaffPage() {
  const supabase = createClient()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<'staff' | 'expenses' | 'refunds'>('staff')
  const [staff, setStaff] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [depositRefunds, setDepositRefunds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())

  const [showStaffModal, setShowStaffModal] = useState(false)
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [staffForm, setStaffForm] = useState({ name: '', phone: '', role: '', monthly_salary: '', is_active: true })

  const [payoutTarget, setPayoutTarget] = useState<any>(null)
  const [payoutForm, setPayoutForm] = useState({ amount: '', type: 'salary', payment_mode: 'cash' })

  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ category: 'maintenance', vendor: '', description: '', amount: '' })
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'paid' | 'unpaid'>('all')

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  useEffect(() => { fetchAll() }, [monthFilter, yearFilter])

  const fetchAll = async () => {
    setLoading(true)
    // Deposit refunds are dated by security_deposit_refund_at (a real
    // timestamp, not month/year columns like everything else here), so
    // this month's window is computed as a plain date range instead.
    const monthStart = `${yearFilter}-${String(monthFilter).padStart(2, '0')}-01`
    const nextMonth = monthFilter === 12 ? 1 : monthFilter + 1
    const nextYear = monthFilter === 12 ? yearFilter + 1 : yearFilter
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    const [{ data: staffData }, { data: payoutData }, { data: expenseData }, { data: refundData }] = await Promise.all([
      supabase.from('staff').select('*').order('is_active', { ascending: false }).order('name'),
      supabase.from('staff_payouts').select('*, staff(name)').eq('month', monthFilter).eq('year', yearFilter),
      supabase.from('expenses').select('*').eq('month', monthFilter).eq('year', yearFilter).order('expense_date', { ascending: false }),
      supabase.from('residents').select('id, name, room_number, security_deposit, security_deposit_refund_amount, security_deposit_refund_at, security_deposit_refund_notes')
        .gte('security_deposit_refund_at', monthStart).lt('security_deposit_refund_at', monthEnd)
        .order('security_deposit_refund_at', { ascending: false }),
    ])
    setStaff(staffData || [])
    setPayouts(payoutData || [])
    setExpenses(expenseData || [])
    setDepositRefunds(refundData || [])
    setLoading(false)
  }

  const openAddStaff = () => {
    setEditingStaffId(null)
    setStaffForm({ name: '', phone: '', role: '', monthly_salary: '', is_active: true })
    setShowStaffModal(true)
  }

  const openEditStaff = (s: any) => {
    setEditingStaffId(s.id)
    setStaffForm({ name: s.name || '', phone: s.phone || '', role: s.role || '', monthly_salary: String(s.monthly_salary || ''), is_active: s.is_active })
    setShowStaffModal(true)
  }

  const saveStaff = async () => {
    if (!staffForm.name.trim()) return
    const payload = {
      name: staffForm.name.trim(),
      phone: staffForm.phone.trim() || null,
      role: staffForm.role.trim() || null,
      monthly_salary: parseFloat(staffForm.monthly_salary) || 0,
      is_active: staffForm.is_active,
    }
    if (editingStaffId) {
      await supabase.from('staff').update(payload).eq('id', editingStaffId)
    } else {
      await supabase.from('staff').insert(payload)
    }
    setShowStaffModal(false)
    fetchAll()
  }

  const payoutFor = (staffId: string) => payouts.find(p => p.staff_id === staffId)

  const logPayout = async () => {
    if (!payoutTarget || !payoutForm.amount) return
    const existing = payoutFor(payoutTarget.id)
    if (existing) {
      await supabase.from('staff_payouts').update({
        amount: parseFloat(payoutForm.amount), type: payoutForm.type, payment_mode: payoutForm.payment_mode,
        status: 'paid', paid_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('staff_payouts').insert({
        staff_id: payoutTarget.id, month: monthFilter, year: yearFilter,
        amount: parseFloat(payoutForm.amount), type: payoutForm.type, payment_mode: payoutForm.payment_mode,
        status: 'paid', paid_at: new Date().toISOString(),
      })
    }
    setPayoutTarget(null)
    setPayoutForm({ amount: '', type: 'salary', payment_mode: 'cash' })
    fetchAll()
  }

  const addExpense = async () => {
    if (!expenseForm.amount) return
    await supabase.from('expenses').insert({
      category: expenseForm.category, vendor: expenseForm.vendor.trim() || null,
      description: expenseForm.description.trim() || null, amount: parseFloat(expenseForm.amount),
      month: monthFilter, year: yearFilter,
    })
    setExpenseForm({ category: 'maintenance', vendor: '', description: '', amount: '' })
    setShowExpenseModal(false)
    fetchAll()
  }

  const activeStaff = staff.filter(s => s.is_active)
  const totalSalaryDue = activeStaff.reduce((sum, s) => sum + Number(s.monthly_salary || 0), 0)
  const totalPaidOut = payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalDepositRefunds = depositRefunds.reduce((sum, r) => sum + Number(r.security_deposit_refund_amount || 0), 0)
  // Every category of real money leaving the business this month, in one
  // figure - staff payouts, other expenses, and deposit refunds (a refund
  // is real cash out, same as any other outflow, even though it's not an
  // "expense" in the accounting sense - it's returning money that was
  // never revenue to begin with).
  const totalOutflows = totalPaidOut + totalExpenses + totalDepositRefunds
  const pendingStaffCount = activeStaff.filter(s => !payoutFor(s.id) || payoutFor(s.id)?.status !== 'paid').length
  const isPaid = (s: any) => payoutFor(s.id)?.status === 'paid'
  const filteredStaff = staff.filter(s => payoutFilter === 'all' || (payoutFilter === 'paid' ? isPaid(s) : !isPaid(s)))

  return (
    <div style={{ padding: '32px' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>Staff & Expenses</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Every outflow this month - payouts, expenses, and deposit refunds</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
          {(['staff', 'expenses', 'refunds'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize', background: tab === t ? 'var(--teal-500)' : 'transparent', color: tab === t ? 'var(--navy-900)' : 'var(--text-muted)' }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Month selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
          {months.map((m, i) => (
            <button key={m} onClick={() => setMonthFilter(i + 1)} style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: monthFilter === i + 1 ? 'var(--teal-500)' : 'transparent', color: monthFilter === i + 1 ? 'var(--navy-900)' : 'var(--text-muted)' }}>{m}</button>
          ))}
        </div>
        <select className="bb-input" style={{ width: 'auto' }} value={yearFilter} onChange={e => setYearFilter(parseInt(e.target.value))}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Outflows This Month', value: formatCurrency(totalOutflows), color: '#f87171' },
          { label: 'Monthly Salary Total', value: formatCurrency(totalSalaryDue), color: '#00d4c8' },
          { label: 'Paid Out', value: formatCurrency(totalPaidOut), color: '#34d399' },
          { label: 'Payouts Pending', value: `${pendingStaffCount} staff`, color: pendingStaffCount > 0 ? '#f87171' : '#34d399' },
          { label: 'Expenses This Month', value: formatCurrency(totalExpenses), color: '#fbbf24' },
          { label: 'Deposit Refunds This Month', value: formatCurrency(totalDepositRefunds), color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: s.color, fontFamily: 'Syne, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {tab === 'staff' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
              {([
                { key: 'all', label: 'All', count: staff.length },
                { key: 'unpaid', label: 'Not Paid', count: staff.filter(s => !isPaid(s)).length },
                { key: 'paid', label: '✓ Paid', count: staff.filter(isPaid).length },
              ] as const).map(f => (
                <button key={f.key} onClick={() => setPayoutFilter(f.key)} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', background: payoutFilter === f.key ? 'var(--teal-500)' : 'transparent', color: payoutFilter === f.key ? 'var(--navy-900)' : 'var(--text-muted)' }}>
                  {f.label}{f.count > 0 ? ` (${f.count})` : ''}
                </button>
              ))}
            </div>
            <button onClick={openAddStaff} className="bb-btn-secondary"><Plus size={14} /> Add Staff</button>
          </div>
          {loading ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : isMobile ? (
            <div>
              {filteredStaff.map(s => {
                const payout = payoutFor(s.id)
                return (
                  <div key={s.id} className="bb-row-card">
                    <div className="bb-row-card-top">
                      <div>
                        <div className="bb-row-card-title">{s.name} {!s.is_active && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(inactive)</span>}</div>
                        <div className="bb-row-card-sub" style={{ textTransform: 'capitalize' }}>{s.role || '-'}{s.phone ? ` · ${s.phone}` : ''}</div>
                      </div>
                      {payout ? (
                        <span className="status-badge" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }}>✓ Paid</span>
                      ) : (
                        <span className="status-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>Not paid</span>
                      )}
                    </div>
                    <div className="bb-row-card-amount">
                      <span className="bb-row-card-amount-value">{formatCurrency(payout ? payout.amount : s.monthly_salary)}</span>
                      <span className="bb-row-card-amount-label">{payout ? `Paid (${payout.type})` : 'Monthly salary'}</span>
                    </div>
                    <div className="bb-row-card-actions">
                      <button onClick={() => { setPayoutTarget(s); setPayoutForm({ amount: payout ? String(payout.amount) : String(s.monthly_salary), type: 'salary', payment_mode: 'cash' }) }}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(0,212,200,0.3)', background: 'rgba(0,212,200,0.08)', color: 'var(--teal-500)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                        {payout ? 'Edit Payout' : 'Pay'}
                      </button>
                      <button onClick={() => openEditStaff(s)} className="bb-icon-btn" style={{ width: 30, height: 30, minWidth: 30, minHeight: 30 }} aria-label="Edit staff details">
                        <Pencil size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
              {filteredStaff.length === 0 && <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>{staff.length === 0 ? 'No staff added yet. Tap "Add Staff" to get started.' : `No ${payoutFilter === 'unpaid' ? 'unpaid' : 'paid'} staff this month.`}</div>}
            </div>
          ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="bb-table">
                  <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Monthly Salary</th><th>This Month</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredStaff.map(s => {
                      const payout = payoutFor(s.id)
                      return (
                        <tr key={s.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{s.name} {!s.is_active && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(inactive)</span>}</td>
                          <td style={{ textTransform: 'capitalize' }}>{s.role || '-'}</td>
                          <td>{s.phone || '-'}</td>
                          <td>{formatCurrency(s.monthly_salary)}</td>
                          <td>
                            {payout ? (
                              <span className="status-badge" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }}>✓ {formatCurrency(payout.amount)} ({payout.type})</span>
                            ) : (
                              <span className="status-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>Not paid</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => { setPayoutTarget(s); setPayoutForm({ amount: payout ? String(payout.amount) : String(s.monthly_salary), type: 'salary', payment_mode: 'cash' }) }}
                                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(0,212,200,0.3)', background: 'rgba(0,212,200,0.08)', color: 'var(--teal-500)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                                {payout ? 'Edit Payout' : 'Pay'}
                              </button>
                              <button onClick={() => openEditStaff(s)} className="bb-icon-btn" style={{ width: 30, height: 30, minWidth: 30, minHeight: 30 }} aria-label="Edit staff details">
                                <Pencil size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filteredStaff.length === 0 && <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>{staff.length === 0 ? 'No staff added yet. Click "Add Staff" to get started.' : `No ${payoutFilter === 'unpaid' ? 'unpaid' : 'paid'} staff this month.`}</div>}
              </div>
          </div>
          )}
        </>
      ) : tab === 'expenses' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={() => setShowExpenseModal(true)} className="bb-btn-secondary"><Plus size={14} /> Log Expense</button>
          </div>
          {loading ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : isMobile ? (
            <div>
              {expenses.map(e => (
                <div key={e.id} className="bb-row-card">
                  <div className="bb-row-card-top">
                    <div>
                      <div className="bb-row-card-title" style={{ textTransform: 'capitalize' }}>{e.category}</div>
                      <div className="bb-row-card-sub">{e.vendor || 'No vendor noted'}{e.description ? ` · ${e.description}` : ''}</div>
                    </div>
                  </div>
                  <div className="bb-row-card-amount">
                    <span className="bb-row-card-amount-value">{formatCurrency(e.amount)}</span>
                    <span className="bb-row-card-amount-label">{e.expense_date ? new Date(e.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}</span>
                  </div>
                </div>
              ))}
              {expenses.length === 0 && <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No expenses logged for this month.</div>}
            </div>
          ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="bb-table">
                  <thead><tr><th>Category</th><th>Vendor</th><th>Description</th><th>Amount</th><th>Date</th></tr></thead>
                  <tbody>
                    {expenses.map(e => (
                      <tr key={e.id}>
                        <td style={{ textTransform: 'capitalize', fontWeight: '600', color: 'var(--text-primary)' }}>{e.category}</td>
                        <td>{e.vendor || '-'}</td>
                        <td>{e.description || '-'}</td>
                        <td style={{ fontWeight: '700' }}>{formatCurrency(e.amount)}</td>
                        <td>{e.expense_date ? new Date(e.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {expenses.length === 0 && <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No expenses logged for this month.</div>}
              </div>
          </div>
          )}
        </>
      ) : (
        // Read-only here on purpose - settling a deposit happens on the
        // resident's own page (where the checklist and full context live),
        // this is just where it shows up once it's done, alongside every
        // other outflow for the month.
        <>
          {loading ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : depositRefunds.length === 0 ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No deposit refunds recorded this month.</div>
          ) : isMobile ? (
            <div>
              {depositRefunds.map(r => (
                <div key={r.id} className="bb-row-card">
                  <div className="bb-row-card-top">
                    <div>
                      <div className="bb-row-card-title">{r.name}{r.room_number ? ` · Room ${r.room_number}` : ''}</div>
                      <div className="bb-row-card-sub">Deposit was {formatCurrency(r.security_deposit)}</div>
                    </div>
                  </div>
                  <div className="bb-row-card-amount">
                    <span className="bb-row-card-amount-value">{formatCurrency(r.security_deposit_refund_amount)}</span>
                    <span className="bb-row-card-amount-label">{new Date(r.security_deposit_refund_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  {r.security_deposit_refund_notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>{r.security_deposit_refund_notes}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="bb-table">
                  <thead><tr><th>Resident</th><th>Room</th><th>Deposit Agreed</th><th>Refunded</th><th>Date</th><th>Notes</th></tr></thead>
                  <tbody>
                    {depositRefunds.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{r.name}</td>
                        <td>{r.room_number || '-'}</td>
                        <td>{formatCurrency(r.security_deposit)}</td>
                        <td style={{ fontWeight: '700', color: '#a78bfa' }}>{formatCurrency(r.security_deposit_refund_amount)}</td>
                        <td>{new Date(r.security_deposit_refund_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.security_deposit_refund_notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Staff Modal */}
      {showStaffModal && (
        <Modal onClose={() => setShowStaffModal(false)} title={editingStaffId ? 'Edit Staff' : 'Add Staff'}>
          <FormField label="Name *" value={staffForm.name} onChange={v => setStaffForm(f => ({ ...f, name: v }))} />
          <FormField label="Role (cook, cleaner, security...)" value={staffForm.role} onChange={v => setStaffForm(f => ({ ...f, role: v }))} />
          <FormField label="Phone" value={staffForm.phone} onChange={v => setStaffForm(f => ({ ...f, phone: v }))} />
          <FormField label="Monthly Salary (₹)" value={staffForm.monthly_salary} onChange={v => setStaffForm(f => ({ ...f, monthly_salary: v }))} type="number" />
          {editingStaffId && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={staffForm.is_active} onChange={e => setStaffForm(f => ({ ...f, is_active: e.target.checked }))} />
              Active
            </label>
          )}
          <button onClick={saveStaff} className="bb-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }} disabled={!staffForm.name.trim()}>
            <CheckCircle size={14} /> {editingStaffId ? 'Save Changes' : 'Add Staff'}
          </button>
        </Modal>
      )}

      {/* Log Payout Modal */}
      {payoutTarget && (
        <Modal onClose={() => setPayoutTarget(null)} title={`Pay ${payoutTarget.name}`}>
          <FormField label="Amount (₹)" value={payoutForm.amount} onChange={v => setPayoutForm(f => ({ ...f, amount: v }))} type="number" />
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Type</label>
            <select className="bb-input" value={payoutForm.type} onChange={e => setPayoutForm(f => ({ ...f, type: e.target.value }))}>
              <option value="salary">Salary</option><option value="advance">Advance</option><option value="bonus">Bonus</option>
            </select>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Payment Mode</label>
            <select className="bb-input" value={payoutForm.payment_mode} onChange={e => setPayoutForm(f => ({ ...f, payment_mode: e.target.value }))}>
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>
          <button onClick={logPayout} className="bb-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!payoutForm.amount}>
            <Wallet size={14} /> Confirm Payout
          </button>
        </Modal>
      )}

      {/* Log Expense Modal */}
      {showExpenseModal && (
        <Modal onClose={() => setShowExpenseModal(false)} title="Log Expense">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Category</label>
            <select className="bb-input" value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}>
              {['maintenance', 'utilities', 'groceries', 'staff', 'vendor', 'supplies', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <FormField label="Vendor (optional)" value={expenseForm.vendor} onChange={v => setExpenseForm(f => ({ ...f, vendor: v }))} />
          <FormField label="Description (optional)" value={expenseForm.description} onChange={v => setExpenseForm(f => ({ ...f, description: v }))} />
          <FormField label="Amount (₹)" value={expenseForm.amount} onChange={v => setExpenseForm(f => ({ ...f, amount: v }))} type="number" />
          <button onClick={addExpense} className="bb-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }} disabled={!expenseForm.amount}>
            <Receipt size={14} /> Log Expense
          </button>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>{label}</label>
      <input className="bb-input" type={type} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
