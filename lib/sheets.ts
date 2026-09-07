import { google } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'

// Shared Google Sheets helper (extracted from the booking-form route so any
// feature can push a snapshot to a sheet with one call). Non-fatal by design -
// Supabase is always the source of truth; Sheets is a one-way mirror (D-005).

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY
  if (!email || !key) return null

  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

// Overwrites a tab's contents with a fresh snapshot (header + rows). Simple and
// predictable for a "click to sync" button - no partial-update bookkeeping needed.
export async function syncSheetSnapshot(opts: {
  spreadsheetId?: string
  tabName: string
  header: string[]
  rows: (string | number)[][]
}) {
  const sheets = sheetsClient()
  const spreadsheetId = opts.spreadsheetId || process.env.GOOGLE_SHEET_ID
  if (!sheets || !spreadsheetId) {
    return { skipped: true, reason: 'Google Sheets not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SHEET_ID)' }
  }

  try {
    // Ensure the tab exists (ignore error if it already does)
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: opts.tabName } } }] },
      })
    } catch {}

    // Clear then write fresh - avoids stale rows lingering after residents move out etc.
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${opts.tabName}!A:Z` })
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${opts.tabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [opts.header, ...opts.rows] },
    })
    return { ok: true, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` }
  } catch (err) {
    console.error('syncSheetSnapshot failed:', err)
    return { error: true }
  }
}

// AUTO-04, "Residents" tab: a full, always-current mirror of every resident -
// the owner's own independent backup outside Supabase entirely, so nothing
// about "did the app lose my data" is a question that needs the app itself
// to answer. One row per resident, full refresh each call (see
// syncSheetSnapshot above) - simple and predictable rather than a partial
// upsert that could drift. Non-fatal: skips quietly if Sheets isn't
// configured, same as everything else that touches this file.
export async function syncResidentsSheet(supabase: SupabaseClient) {
  const { data: residents, error } = await supabase
    .from('residents')
    .select('*, onboarded_by_admin:admins!residents_onboarded_by_fkey(name)')
    .order('created_at', { ascending: false })
  if (error || !residents) return { error: true }

  const header = [
    'Resident ID', 'Name', 'Mobile', 'Email', 'Room', 'Monthly Rent', 'Security Deposit',
    'Date of Joining', 'Stay Type', 'Status', 'Onboarding Status',
    'Emergency Contact Name', 'Emergency Contact Phone', 'Hometown', 'Institution', 'Occupation',
    'Agreement Signed At', 'Agreement IP', 'Agreement Version',
    'Aadhaar On File', 'Signature On File',
    'Onboarded By', 'Onboarded At', 'Notes', 'Record Created At', 'Last Synced At',
  ]
  const syncedAt = new Date().toISOString()
  const rows = residents.map((r: any) => [
    r.id, r.name, r.mobile || '', r.email || '', r.room_number || '', r.rent_amount || '', r.security_deposit || '',
    r.date_of_joining || '', r.stay_type || '', r.status || '', r.onboarding_status || '',
    r.emergency_contact_name || '', r.emergency_contact_phone || r.emergency_contact_number || '', r.hometown || '', r.institution || '', r.occupation || '',
    r.agreement_signed_at || '', r.agreement_ip || '', r.agreement_version || '',
    (r.aadhaar_front_url || r.aadhaar_back_url) ? 'Yes' : 'No', r.signature_path ? 'Yes' : 'No',
    r.onboarded_by_admin?.name || '', r.onboarded_at || '', r.notes || '', r.created_at || '', syncedAt,
  ])

  return syncSheetSnapshot({ tabName: 'Residents', header, rows })
}
