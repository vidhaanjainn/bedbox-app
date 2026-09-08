import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail, emailShell, moneyINR } from '@/lib/notify'
import { sendPushToAdmins } from '@/lib/push'
import { computeTotalAmount } from '@/lib/prorata'

// Resident-gated: lets a resident log their own meter reading each month,
// exactly like the admin's "Add Reading" flow (electricity_readings.units_consumed
// and .bill_amount are DB-generated from previous/current reading, so this
// just needs to insert the row correctly) - then folds the bill straight
// into that month's rent_payments the same way the admin flow does.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { month, year, currentReading, photoPath } = await req.json()
  if (!month || !year || currentReading == null) {
    return NextResponse.json({ error: 'month, year, and currentReading are required.' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: resident } = await admin
    .from('residents')
    .select('id, name, room_number, bed_id, initial_electricity_reading')
    .eq('portal_user_id', user.id)
    .single()
  if (!resident) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })

  const { data: existing } = await admin
    .from('electricity_readings')
    .select('id')
    .eq('resident_id', resident.id)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'You have already logged a reading for this month.' }, { status: 409 })

  // Previous reading = last month's current_reading, or the move-in
  // baseline if this is their first-ever reading - same fallback the
  // admin's own "Add Reading" flow uses.
  const prevDate = new Date(year, month - 2)
  const { data: prevRow } = await admin
    .from('electricity_readings')
    .select('current_reading')
    .eq('resident_id', resident.id)
    .eq('month', prevDate.getMonth() + 1)
    .eq('year', prevDate.getFullYear())
    .maybeSingle()
  const previousReading = prevRow?.current_reading ?? resident.initial_electricity_reading ?? 0

  const current = Number(currentReading)
  if (current < previousReading) {
    return NextResponse.json({ error: `Current reading can't be less than the last recorded reading (${previousReading}).` }, { status: 400 })
  }

  const { data: reading, error: insertError } = await admin.from('electricity_readings').insert({
    resident_id: resident.id,
    bed_id: resident.bed_id,
    month, year,
    previous_reading: previousReading,
    current_reading: current,
    reading_photo_path: photoPath || null,
    submitted_by: 'resident',
    reading_date: new Date().toISOString().split('T')[0],
  }).select().single()
  if (insertError || !reading) return NextResponse.json({ error: 'Could not save your reading.' }, { status: 500 })

  // Fold straight into this month's rent, same as the admin flow.
  let { data: rentPayment } = await admin
    .from('rent_payments')
    .select('id, rent_amount, late_fee, prorata_credit_applied')
    .eq('resident_id', resident.id)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (!rentPayment) {
    const { data: created } = await admin.from('rent_payments').insert({
      resident_id: resident.id, month, year,
      rent_amount: 0, total_amount: 0, amount_paid: 0, status: 'pending',
    }).select('id, rent_amount, late_fee, prorata_credit_applied').single()
    rentPayment = created || null
  }

  if (rentPayment) {
    await admin.from('rent_payments').update({
      electricity_amount: reading.bill_amount,
      total_amount: computeTotalAmount(rentPayment.rent_amount, reading.bill_amount, rentPayment.late_fee, rentPayment.prorata_credit_applied),
      electricity_logged_at: new Date().toISOString(),
    }).eq('id', rentPayment.id)
    await admin.from('electricity_readings').update({ added_to_rent: true }).eq('id', reading.id)
  }

  const monthLabel = new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const roomLabel = resident.room_number ? `Room ${resident.room_number}` : 'Room not on file'

  await Promise.all([
    sendPushToAdmins({
      title: 'Electricity reading logged',
      body: `${resident.name} (${roomLabel}) logged ${reading.units_consumed} units for ${monthLabel} - ${moneyINR(reading.bill_amount)}`,
      url: '/admin/electricity',
    }),
    sendEmail({
      to: process.env.ADMIN_NOTIFY_EMAIL || 'thebedbox.in@gmail.com',
      subject: `⚡ ${resident.name} logged their electricity reading`,
      html: emailShell('Electricity reading logged by resident', `
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px">
          <strong style="color:#0f172a">${resident.name}</strong> (${roomLabel}) logged a reading of
          <strong>${current}</strong> for <strong>${monthLabel}</strong> (previous: ${previousReading}).
        </p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Units consumed</span><span style="font-weight:700;color:#0f172a">${reading.units_consumed}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Bill (₹10/unit)</span><span style="font-weight:700;color:#0f172a">${moneyINR(reading.bill_amount)}</span></div>
        </div>
      `),
    }),
  ])

  return NextResponse.json({ success: true, unitsConsumed: reading.units_consumed, billAmount: reading.bill_amount })
}
