import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { residentId, reason, reasonNotes, depositStatus, wouldReAdmit, finalElectricityReading } = await request.json()

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
      .select('id, name, email, mobile, room_number, rent_amount, date_of_joining, hometown, occupation, bed_id, initial_electricity_reading')
      .eq('id', residentId)
      .single()

    if (fetchError || !resident) {
      return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })
    }

    // 1. Archive the resident - this exit-interview data (reason, notes,
    // deposit status, re-admit call) used to be collected carefully in the
    // admin UI and then discarded entirely, never written anywhere except
    // the (disabled) Google Sheets block below. Persisted properly now, and
    // vacated_at anchors both the 7-day extended portal window and the
    // post-vacate portal view.
    const nowIso = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('residents')
      .update({
        status: 'vacated',
        onboarding_status: 'archived',
        vacated_at: nowIso,
        vacate_reason: reason || null,
        vacate_reason_notes: reasonNotes || null,
        deposit_refund_status: depositStatus || null,
        would_readmit: wouldReAdmit,
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

    // 2b. Electricity reconciliation - the actual point of asking for a
    // final meter reading at move-out. If given, log one last reading
    // covering whatever's been used since the last logged month, then
    // compare total units billed over the whole stay against total units
    // actually consumed (final - move-in baseline) and flag any month
    // that has a reading on file but was never folded into rent - both
    // are real ways a resident could end up having paid less than they
    // consumed. "Sharing coherence" across roommates on one meter isn't
    // checked here - each resident has their own reading trail in this
    // model, not a shared one, so that comparison isn't meaningful yet.
    let electricityReconciliation: any = null
    const { data: allReadings } = await supabase
      .from('electricity_readings')
      .select('month, year, current_reading, bill_amount, added_to_rent')
      .eq('resident_id', residentId)
      .order('year', { ascending: true })
      .order('month', { ascending: true })

    if (finalElectricityReading != null && resident.date_of_joining) {
      const now = new Date()
      const lastRow = (allReadings || [])[((allReadings || []).length || 1) - 1]
      const previousReading = lastRow ? Number(lastRow.current_reading) : Number(resident.initial_electricity_reading || 0)
      const finalReading = Number(finalElectricityReading)

      if (finalReading >= previousReading) {
        const { data: finalRow } = await supabase.from('electricity_readings').insert({
          resident_id: residentId,
          bed_id: resident.bed_id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          previous_reading: previousReading,
          current_reading: finalReading,
          submitted_by: 'admin',
          reading_date: now.toISOString().split('T')[0],
        }).select().single()
        if (finalRow) allReadings?.push(finalRow)
      }
    }

    if (allReadings?.length) {
      const totalBilled = allReadings.reduce((s, r) => s + Number(r.bill_amount || 0), 0)
      const unbilledMonths = allReadings.filter(r => !r.added_to_rent).map(r => `${r.month}/${r.year}`)
      const finalReadingValue = allReadings[allReadings.length - 1]?.current_reading
      const totalUnitsOverStay = finalReadingValue != null
        ? Number(finalReadingValue) - Number(resident.initial_electricity_reading || 0)
        : null

      electricityReconciliation = {
        totalReadingsLogged: allReadings.length,
        totalBilled,
        totalUnitsOverStay,
        unbilledMonths,
        note: unbilledMonths.length > 0
          ? `${unbilledMonths.length} logged reading(s) were never added to rent - review before finalizing the deposit.`
          : 'All logged readings were billed.',
      }
    }

    // 3. Close any active notice period
    await supabase
      .from('notice_periods')
      .update({ status: 'completed' })
      .eq('resident_id', residentId)
      .eq('status', 'active')

    // 4. Google Sheets - push leaver row
    // TO ENABLE: run `npm install googleapis` then uncomment the block below.
    // Setup: Google Cloud Console → enable Sheets API → create service account
    //        → download JSON key → share your "TheBedBox - Leavers Log" sheet with
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

    return NextResponse.json({ success: true, electricityReconciliation })
  } catch (err) {
    console.error('archive-resident error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
