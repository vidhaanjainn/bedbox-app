// Single source of truth for the tenancy agreement clauses - used by the onboarding
// wizard (app/onboard/[token]/page.tsx), the admin manual-onboarding preview
// (app/admin/residents/new/page.tsx), and the admin agreement-PDF generator
// (lib/documents.ts) so all three always show the exact same terms, with the
// same room/rent/deposit/dates filled in the same way.
//
// Bump AGREEMENT_VERSION whenever the clauses below change - it's stored on the
// resident's record at signing time, so a past resident's proof-of-consent always
// reflects the exact terms they actually agreed to, even after this text is edited later.
export const AGREEMENT_VERSION = 'v2-2026-09'

// {{room}}, {{rent}}, {{deposit}}, {{term_end}} are filled in per-resident by
// renderAgreementClauses() below - never shown raw to a resident or in a PDF.
export const AGREEMENT_CLAUSES = [
  "The monthly rent for Room {{room}} is ₹{{rent}}, payable on or before the 5th of each calendar month. A penalty of ₹200 per day shall be levied for each day of delay beyond the 5th. Non-payment by the 10th gives TheBedBox the right to repossess the room and remove the tenant's belongings.",
  "The security deposit of ₹{{deposit}} paid at the time of check-in is non-adjustable against rent and is returnable without interest at the end of the tenancy, subject to deductions for unpaid dues, damages, missing items, or any other outstanding charges.",
  "Electricity charges are billed at ₹10 per unit as per the sub-meter reading, payable along with rent. TheBedBox reserves the right to revise this rate in line with revisions by the electricity distribution company.",
  "Rent shall be subject to an increase of 5-10% after the initial 11-month term (ending {{term_end}}). TheBedBox reserves the right to revise rent annually thereafter, with 30 days prior notice.",
  "A minimum of two calendar months written notice is mandatory before vacating. Failure to give adequate notice will result in forfeiture of the full security deposit. During the notice period, the tenant consents to TheBedBox showing the room to prospective tenants between 9:00 AM and 8:30 PM.",
  "If the tenant fails to vacate on the termination date, a holdover penalty of ₹1,000 per day shall be charged in addition to applicable rent, until physical possession is handed over.",
  "Upon vacating, the tenant shall return the room and all fixtures in the same condition as received (normal wear and tear accepted). Failure to do so makes the tenant liable for full replacement or repair costs.",
  "If the tenant leaves the premises locked and unoccupied for more than 30 consecutive days without prior notice, TheBedBox reserves the right to break the lock and take possession in the presence of a local authority witness. The tenant shall have no claim against this action.",
  "Alcohol, drugs, tobacco, and any intoxicating substances are strictly prohibited on the premises including rooms and all common areas. This applies to visitors as well. Violation is grounds for immediate termination and forfeiture of deposit.",
  "Ragging in any form is strictly banned. Physical, mental, or verbal harassment of co-residents or staff is grounds for immediate eviction and legal action.",
  "No gambling, firearms, ammunition, explosives, or flammable materials are permitted on the premises at any time.",
  "Political, communal, or propaganda activities are prohibited on the premises. Tenants shall not give media interviews referencing TheBedBox without prior written permission from management.",
  "Noise must be kept at a level not audible outside the room at all times. Celebrations require prior written permission and must not disturb other residents.",
  "Tenants must inform management in advance of any overnight absence or extended leave exceeding 3 days.",
  "All furniture and fixtures are property of TheBedBox. Tenants must pay the full original cost of any missing item and repair costs for willful damage beyond normal wear and tear.",
  "Tenants are prohibited from interchanging furniture between rooms. No nails, pegs, or adhesives on walls, windows, or doors. No structural alterations without prior written permission.",
  "Damage or theft of common area property will be recovered equally from tenants sharing that area. Hostel-wide damage will be recovered from all occupants proportionally.",
  "Subletting, sharing, or transferring occupancy to any unauthorized person is strictly prohibited and is grounds for immediate eviction without refund.",
  "Room changes require prior written permission. Tenants may not occupy vacant rooms without authorization.",
  "Guests are permitted only in designated common areas between 9:00 AM and 9:00 PM. Overnight guests are not permitted under any circumstances.",
  "TheBedBox reserves the right to inspect any room at any time with reasonable prior intimation, or immediately in cases of suspected rule violation.",
  "TheBedBox reserves the right to terminate tenancy immediately and forfeit the deposit for misconduct, repeated rule violations, property damage, or any act detrimental to the safety or reputation of the premises.",
  "Any false or misleading information provided during onboarding renders the tenancy void immediately. The tenant must vacate forthwith and is not entitled to any refund.",
  "TheBedBox reserves the right to revise policies, pricing, and rules at any time with 30 days prior notice.",
  "The tenant is strictly prohibited from using this premises as a registered business address or for GST registration. Any such use is a material breach entitling TheBedBox to immediate termination. The tenant is solely liable for all legal consequences and costs arising therefrom.",
  "This agreement is executed at Bhopal. All disputes are subject to the exclusive jurisdiction of courts in Bhopal, Madhya Pradesh, India.",
  "This digital agreement, executed with the tenant's explicit consent including timestamp and IP address, is legally binding under the Information Technology Act, 2000, equivalent to a physically signed contract.",
  "By digitally agreeing, the tenant confirms they have read, understood, and unconditionally accept all clauses above, and that this agreement has not been made under duress, misrepresentation, or coercion.",
]

export type AgreementVars = {
  room_number?: string | null
  rent_amount?: number | string | null
  security_deposit?: number | string | null
  date_of_joining?: string | null
}

function money(n?: number | string | null): string {
  const num = Number(n)
  return Number.isFinite(num) && num > 0 ? num.toLocaleString('en-IN') : '___'
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Fills {{room}}, {{rent}}, {{deposit}}, {{term_end}} into every clause for a
// specific resident. Falls back to sensible placeholders ("___", "this room")
// for anything not yet on file, so the preview never shows a raw {{token}}.
export function renderAgreementClauses(vars: AgreementVars): string[] {
  const replacements: Record<string, string> = {
    room: vars.room_number || 'this room',
    rent: money(vars.rent_amount),
    deposit: money(vars.security_deposit),
    term_end: vars.date_of_joining ? addMonths(vars.date_of_joining, 11) : 'the end of the 11-month term',
  }
  return AGREEMENT_CLAUSES.map((clause) =>
    clause.replace(/\{\{(\w+)\}\}/g, (_, key) => replacements[key] ?? `{{${key}}}`)
  )
}
