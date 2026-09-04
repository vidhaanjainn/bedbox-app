import { google } from 'googleapis'

// Shared Google Sheets helper (extracted from the booking-form route so any
// feature can push a snapshot to a sheet with one call). Non-fatal by design —
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
// predictable for a "click to sync" button — no partial-update bookkeeping needed.
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

    // Clear then write fresh — avoids stale rows lingering after residents move out etc.
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
