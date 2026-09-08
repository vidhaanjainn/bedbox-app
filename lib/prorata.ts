// Fair reconciliation for a resident who joins mid-month but pays a full
// month's rent at signing (the normal, simplest thing to collect at
// move-in) - they've overpaid for the days before they moved in, and that
// overpayment should come back to them as a credit against next month's
// invoice rather than silently vanishing.
//
// Example: joins the 14th of a 30-day month. Days 1-13 (13 days) weren't
// lived in but were paid for. Per-day rate = rent / 30. Credit = 13 * that
// rate, taken off next month's total so the two months together add up to
// exactly what was actually owed for the days actually lived.
//
// Below a small threshold this isn't worth the admin's time or the
// resident's confusion over a few hundred rupees - someone joining on the
// 5th just pays full rent, no argument, no review needed. Only joins past
// PRORATA_REVIEW_THRESHOLD_DAYS of the month surface for a decision.

export const PRORATA_REVIEW_THRESHOLD_DAYS = 7 // unused days strictly greater than this trigger a review

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
}

// The one place total_amount is ever derived from its parts. A rent_payments
// row that already has a pro-rata credit applied (see the daily cron) has
// that credit baked into its own total_amount at creation time - but rent,
// electricity, and late fee are each recomputed and rewritten independently
// afterward (logging a payment, logging an electricity reading, forgiving a
// late fee, the daily late-fee accrual), and every one of those used to
// rebuild total_amount from scratch as rent + electricity + late fee,
// silently erasing the credit the moment any of them ran. Routing every
// such recompute through this one function is what keeps that from
// happening again anywhere.
export function computeTotalAmount(rentAmount: number, electricityAmount: number, lateFee: number, prorataCreditApplied: number): number {
  return Math.max(0, Number(rentAmount || 0) + Number(electricityAmount || 0) + Number(lateFee || 0) - Number(prorataCreditApplied || 0))
}

export function computeProrata(dateOfJoining: string | null | undefined, rentAmount: number): { unusedDays: number; creditAmount: number } | null {
  if (!dateOfJoining || !rentAmount) return null
  const d = new Date(dateOfJoining)
  if (isNaN(d.getTime())) return null

  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() // 0-indexed
  const joinDay = d.getUTCDate()
  const unusedDays = joinDay - 1
  if (unusedDays <= PRORATA_REVIEW_THRESHOLD_DAYS) return null

  const totalDays = daysInMonth(year, month)
  const perDayRate = rentAmount / totalDays
  const creditAmount = Math.round(perDayRate * unusedDays)
  return { unusedDays, creditAmount }
}
