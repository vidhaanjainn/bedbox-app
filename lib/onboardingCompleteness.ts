// Single source of truth for "what does this resident's onboarding still
// need" - used by both the resident detail page (to show what's missing and
// offer a link to fill it in) and the residents list (to filter/count them),
// so the two can never quietly disagree about who counts as incomplete.
export function missingOnboardingFields(r: any): string[] {
  const missing: string[] = []
  if (!r.mobile) missing.push('Mobile number')
  if (!r.institution) missing.push('Institution / company')
  if (!r.affiliation_proof_path) missing.push('Affiliation proof')
  if (!r.aadhaar_front_url && !r.aadhaar_front_path) missing.push('Aadhaar front')
  if (!r.aadhaar_back_url && !r.aadhaar_back_path) missing.push('Aadhaar back')
  if (!r.signature_path) missing.push('Signature')
  if (!r.agreement_signed_at) missing.push('Signed agreement')
  return missing
}

export function isOnboardingIncomplete(r: any): boolean {
  return missingOnboardingFields(r).length > 0
}
