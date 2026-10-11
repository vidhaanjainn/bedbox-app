import { computeTotalAmount } from '@/lib/prorata'

// The one place an invoice's money fields are derived from its inputs, so the
// Log Payment flow, the Edit flow and any future path can't disagree.
// Payments are applied rent first, then electricity, then late fee.
export function deriveInvoice(i: {
  rent: number
  electricity: number
  lateFee: number
  lateFeeForgiven: boolean
  prorataCredit: number
  paid: number
}) {
  const lateFee = i.lateFeeForgiven ? 0 : Number(i.lateFee || 0)
  const total = computeTotalAmount(i.rent, i.electricity, lateFee, i.prorataCredit)
  const paid = Math.max(0, Number(i.paid || 0))
  const rent_paid = Math.min(paid, Number(i.rent))
  const electricity_paid = Math.max(Math.min(paid - Number(i.rent), Number(i.electricity)), 0)
  const late_fee_paid = Math.max(Math.min(paid - Number(i.rent) - Number(i.electricity), lateFee), 0)
  const status: 'paid' | 'partial' | 'pending' = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : (total === 0 ? 'paid' : 'pending')
  return { total_amount: total, amount_paid: paid, rent_paid, electricity_paid, late_fee_paid, status, balance: Math.max(0, total - paid) }
}

// "Who has the money" for display: an app admin's name, or the free-text name
// recorded for someone who isn't an app user.
export function receivedByLabel(p: { collected_admin?: { name?: string | null } | null; received_by_name?: string | null }): string | null {
  return p.collected_admin?.name || p.received_by_name || null
}

// <input type="date"> value (local date) <-> timestamptz, kept at local noon so
// the date never shifts a day across time zones.
export const toDateInput = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const fromDateInput = (v: string) => new Date(`${v}T12:00:00`).toISOString()
