import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { residentId, reason, reasonNotes, depositStatus, wouldReAdmit } = await request.json()

    if (!residentId) {
      return NextResponse.json({ error: 'Resident ID is required.' }, { status: 400 })
    }

    // Use service role key to bypass RLS for admin operations
    // Falls back to anon key if not configured (will rely on admin session RLS)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch resident details (for sheets log and bed freeing)
    const { data: resident, error: fetchError } = await supabase
      .from('residents')
      .select('id, name, email, mobile, room_number, rent_amount, date_of_joining, hometown, occupation, bed_id')
      .eq('id', residentId)
      .single()

    if (fetchError || !resident) {
      return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })
    }

    // 1. Archive the resident
    const { error: updateError } = await supabase
      .from('residents')
      .update({
        status: 'vacated',
        onboarding_status: 'archived',
      })
      .eq('id', residentId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to archive resident.' }, { status: 500 })
    }

    // 2. Free up their bed
    if (resident.bed_id) {
      await supabase
        .from('beds')
        .update({ status: 'available' })
        .eq('id', resident.bed_id)
    }

    // 3. Close any active notice period
    await supabase
      .from('notice_periods')
      .update({ status: 'completed' })
      .eq('resident_id', residentId)
      .eq('status', 'active')

    // 4. Google Sheets — push leaver row
    // TO ENABLE: run `npm install googleapis` then uncomment the block below.
    // Setup: Google Cloud Console → enable Sheets API → create service account
    //        → download JSON key → share your "TheBedBox — Leavers Log" sheet with
    //          the service account email → add these env vars to Vercel:
    //   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
    //   GOOGLE_PRIVATE_KEY=...   (paste the entire private key including \n characters)
    //   GOOGLE_SHEET_ID=...      (from the sheet URL)
    //
    // import { google } from 'googleapis'
    // if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEET_ID) {
    //   try {
    //     const auth = new google.auth.JWT(
    //       process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    //       undefined,
    //       process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    //       ['https://www.googleapis.com/auth/spreadsheets']
    //     )
    //     const sheets = google.sheets({ version: 'v4', auth })
    //     const joinDate = resident.date_of_joining ? new Date(resident.date_of_joining) : null
    //     const leaveDate = new Date()
    //     const months = joinDate ? Math.round((leaveDate.getTime() - joinDate.getTime()) / (1000*60*60*24*30)) : 0
    //     const row = [
    //       resident.name, resident.email, resident.mobile, resident.room_number,
    //       resident.rent_amount, resident.date_of_joining, leaveDate.toISOString().split('T')[0],
    //       `${months} months`, resident.hometown, resident.occupation,
    //       reason, reasonNotes, depositStatus, wouldReAdmit ? 'Yes' : 'No', leaveDate.toISOString()
    //     ]
    //     await sheets.spreadsheets.values.append({
    //       spreadsheetId: process.env.GOOGLE_SHEET_ID,
    //       range: 'Sheet1!A:O', valueInputOption: 'USER_ENTERED',
    //       requestBody: { values: [row] },
    //     })
    //   } catch (sheetsErr) { console.error('Google Sheets push failed (non-fatal):', sheetsErr) }
    // }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('archive-resident error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
