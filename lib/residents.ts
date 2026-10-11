// One rule for "who counts" across the whole admin app.
//
// Current resident = living here: status 'active' or 'notice' (someone on
// notice still lives here and still owes rent). These are the only people in
// resident lists, counts, pending-rent totals and pickers.
//
// Vacated = shown only in the separate "Past residents" view and on their own
// page. They never count anywhere, EXCEPT as a pending close-out action while
// something is still open (deposit not settled, unpaid invoices, old dues) and
// the admin hasn't hidden it (residents.closeout_hidden_at).
//
// Test/review accounts never count anywhere.

export const CURRENT_STATUSES = ['active', 'notice'] as const

type R = { status?: string | null; is_test_account?: boolean | null } | null | undefined

export const isCurrentResident = (r: R) => !!r && !r.is_test_account && (r.status === 'active' || r.status === 'notice')
export const isVacated = (r: R) => r?.status === 'vacated'
// Counts toward lists/totals: anyone real who hasn't left (includes 'pending' onboarding).
export const isCountable = (r: R) => !!r && !r.is_test_account && r.status !== 'vacated'

export type CloseoutResident = {
  id: string
  status?: string | null
  security_deposit_refund_at?: string | null
  closeout_hidden_at?: string | null
}

// What is still open for a vacated resident. `owed` = their unpaid invoice
// balance + outstanding old dues (computed by the caller via lib/dues.ts).
export function closeoutItems(r: CloseoutResident, owed: number): string[] {
  if (r.status !== 'vacated') return []
  const items: string[] = []
  if (!r.security_deposit_refund_at) items.push('Deposit not settled')
  if (owed > 0) items.push(`₹${Math.round(owed).toLocaleString('en-IN')} dues unpaid`)
  return items
}

export const needsCloseout = (r: CloseoutResident, owed: number) => !r.closeout_hidden_at && closeoutItems(r, owed).length > 0
