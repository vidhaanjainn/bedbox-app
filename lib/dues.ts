// The single definition of "what's pending" and "what was actually received",
// shared by the dashboard, Rent Tracker, resident page, portal and reports so
// the same number can never be computed two different ways on two screens.
//
// Pending for a resident = this month's unpaid invoice
//                        + unpaid invoices from earlier months ("past months")
//                        + outstanding old dues (see old_dues table: carried
//                          forward balances from before the app, tracked as an
//                          original amount minus dated payments).
//
// Cash received in a month = amount actually collected on that month's
// invoices + any old-due payments whose paid_at falls inside the month.

export type OldDue = { id: string; resident_id: string; original_amount: number | string; reason?: string | null; created_at?: string }
export type OldDuePayment = { id: string; old_due_id: string; resident_id: string; amount: number | string; paid_at: string; payment_mode?: string | null; notes?: string | null }

// Exactly one invoice per resident per month. If the table ever holds more
// than one (a double "Generate Monthly" click, an old cron bug), keep the one
// with money on it (highest amount_paid, then the earliest created) and ignore
// the rest - so a ₹0 duplicate can never show up as rent owed. Callers must
// pass ALL of a resident's rows for a month, not just unpaid ones, or the paid
// original won't be there to win.
export function dedupeInvoices<T extends { id: string; resident_id: string; month: number; year: number; amount_paid?: number | string | null; created_at?: string | null }>(rows: T[]): T[] {
  const best = new Map<string, T>()
  for (const r of rows) {
    const key = `${r.resident_id}:${r.year}:${r.month}`
    const cur = best.get(key)
    if (!cur) { best.set(key, r); continue }
    const rp = Number(r.amount_paid || 0), cp = Number(cur.amount_paid || 0)
    if (rp > cp || (rp === cp && (r.created_at || '') < (cur.created_at || ''))) best.set(key, r)
  }
  const keep = new Set(Array.from(best.values()).map(r => r.id))
  return rows.filter(r => keep.has(r.id))
}

export function invoiceBalance(r: { total_amount: number | string; amount_paid?: number | string | null }): number {
  return Math.max(0, Number(r.total_amount) - Number(r.amount_paid || 0))
}

export function isBefore(r: { month: number; year: number }, month: number, year: number): boolean {
  return r.year < year || (r.year === year && r.month < month)
}

// Per-due balance with its payments attached.
export function oldDueBalances(dues: OldDue[], payments: OldDuePayment[]) {
  return dues.map(d => {
    const paid = payments.filter(p => p.old_due_id === d.id).reduce((s, p) => s + Number(p.amount), 0)
    const original = Number(d.original_amount)
    return { ...d, original, paid, balance: Math.max(0, original - paid) }
  })
}

// resident_id -> outstanding old-dues balance (only residents who owe something).
export function oldDueOutstandingByResident(dues: OldDue[], payments: OldDuePayment[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of oldDueBalances(dues, payments)) {
    if (d.balance > 0) out[d.resident_id] = (out[d.resident_id] || 0) + d.balance
  }
  return out
}

export function oldDueCashInMonth(payments: OldDuePayment[], month: number, year: number): number {
  return payments
    .filter(p => {
      const d = new Date(p.paid_at)
      return d.getMonth() + 1 === month && d.getFullYear() === year
    })
    .reduce((s, p) => s + Number(p.amount), 0)
}
