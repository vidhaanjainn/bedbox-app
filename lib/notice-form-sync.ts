import { createClient } from '@supabase/supabase-js'

// Syncs the owner's external "Notice to Vacate" Google Form (response sheet is
// public via the CSV export URL - no service account needed) into a review queue.
// Deliberately NOT auto-applied to residents: the sheet contains repeat/old
// submissions from residents who are still currently active (people who gave
// notice and then stayed), so blindly trusting it would wrongly flag paying
// residents as vacating. An admin confirms each match on the Notices page instead.

const SHEET_ID = '19_90YxWLHBZBk3zSG7dWPHkyU-p1Lb-gmosD4Lzks7M'
const GID = '1748432272'
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`

// Minimal RFC4180-ish CSV parser: handles quoted fields with embedded commas,
// newlines, and doubled-quote escapes - enough for a real Google Forms export.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// Parses the sheet's "dd/mm/yyyy HH:MM:SS" timestamp into a real Date, or null.
function parseTimestamp(raw?: string): Date | null {
  const m = raw?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  const [, d, mo, y] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  return isNaN(dt.getTime()) ? null : dt
}

// This form has years of history (back to 2022), almost all already resolved -
// only surface genuinely recent submissions for admin review; older rows are
// still imported (so nothing is lost / it's searchable) but pre-marked
// 'dismissed' so they don't clutter the active queue.
const REVIEW_WINDOW_MONTHS = 6

export async function syncNoticeFormSubmissions() {
  const res = await fetch(CSV_URL, { cache: 'no-store' })
  if (!res.ok) return { error: `Could not fetch the form sheet (status ${res.status}). It may no longer be publicly viewable.` }
  const text = await res.text()
  const rows = parseCsv(text)
  if (rows.length < 2) return { error: 'Sheet returned no data.' }

  const dataRows = rows.slice(1) // skip header
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - REVIEW_WINDOW_MONTHS)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let imported = 0
  let archived = 0
  for (const r of dataRows) {
    const [submittedAt, email, , name, roomNumber, reason, lastDayRaw, agreementDayRaw] = r
    if (!name?.trim() && !email?.trim()) continue
    const dedupeKey = `${submittedAt?.trim()}|${email?.trim()}`.toLowerCase()
    const ts = parseTimestamp(submittedAt)
    const isRecent = ts ? ts >= cutoff : true // no parseable date -> err on the side of surfacing it

    const { error } = await supabase.from('notice_form_submissions').insert({
      submitted_at: submittedAt?.trim() || null,
      email: email?.trim() || null,
      name: name?.trim() || null,
      room_number: roomNumber?.trim() || null,
      reason: reason?.trim() || null,
      last_day_raw: lastDayRaw?.trim() || null,
      agreement_day_raw: agreementDayRaw?.trim() || null,
      dedupe_key: dedupeKey,
      review_status: isRecent ? 'pending' : 'dismissed',
    })
    // Unique violation on dedupe_key just means we already have this row - expected, not an error.
    if (!error) { imported++; if (!isRecent) archived++ }
  }

  return { imported, archived, totalRows: dataRows.length }
}
