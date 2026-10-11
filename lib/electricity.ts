// Electricity billing rule, in one place:
//   - A resident's FIRST reading ever is only a baseline - no units, no bill.
//   - Every later reading is billed as (this reading - last recorded reading) x rate.
// The DB stores a baseline row with previous_reading = current_reading, so its
// generated units_consumed / bill_amount are already 0; these helpers make the
// UI say "starting reading" instead of a misleading ₹0 or a dial-value x 10.

export const ELECTRICITY_RATE = 10 // ₹ per unit - matches the generated bill_amount column

export function previewBill(current: number | null | undefined, lastRecorded: number | null | undefined) {
  if (current == null || isNaN(current)) return null
  if (lastRecorded == null) return { baseline: true as const, units: 0, amount: 0 }
  const units = Math.max(0, current - lastRecorded)
  return { baseline: false as const, units, amount: units * ELECTRICITY_RATE }
}

type Reading = { id: string; resident_id: string; month: number; year: number }

// True when no earlier reading exists for the same resident in `all`.
export function isBaselineReading(r: Reading, all: Reading[]): boolean {
  return !all.some(o => o.resident_id === r.resident_id && o.id !== r.id && (o.year < r.year || (o.year === r.year && o.month < r.month)))
}
