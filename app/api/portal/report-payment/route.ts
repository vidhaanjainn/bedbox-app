import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail, emailShell, moneyINR } from '@/lib/notify'
import { sendPushToAdmins } from '@/lib/push'

// Resident-gated: records a payment claim (amount + mode + proof screenshot)
// for a given month. Creates that month's rent_payments row first if it
// doesn't exist yet (residents shouldn't be blocked from paying just
// because an admin hasn't run "Generate Monthly" for them). This never
// marks the invoice paid — amount_paid/status stay admin-controlled — it
// just flags the row for admin review with everything needed to verify it
// via the existing Log Payment flow.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { month, year, amount, paymentMode, screenshotPath } = await req.json()
  if (!month || !year || !amount) return NextResponse.json({ error: 'month, year, and amount are required.' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: resident } = await admin.from('residents').select('id, name, room_number, rent_amount, portal_user_id').eq('portal_user_id', user.id).single()
  if (!resident) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })

  let { data: payment } = await admin
    .from('rent_payments')
    .select('id')
    .eq('resident_id', resident.id)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (!payment) {
    const rent = Number(resident.rent_amount) || 0
    const { data: created, error: createError } = await admin.from('rent_payments').insert({
      resident_id: resident.id,
      month, year,
      rent_amount: rent,
      total_amount: rent,
      amount_paid: 0,
      status: 'pending',
    }).select('id').single()
    if (createError || !created) return NextResponse.json({ error: 'Could not create this month\'s bill.' }, { status: 500 })
    payment = created
  }

  const { error: updateError } = await admin.from('rent_payments').update({
    resident_reported_at: new Date().toISOString(),
    resident_reported_amount: amount,
    resident_payment_screenshot_path: screenshotPath || null,
    payment_mode: paymentMode || null,
  }).eq('id', payment.id)
  if (updateError) return NextResponse.json({ error: 'Could not save your payment report.' }, { status: 500 })

  const monthLabel = new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const roomLabel = resident.room_number ? `Room ${resident.room_number}` : 'Room not on file'

  await Promise.all([
    sendPushToAdmins({
      title: 'Payment reported — please verify',
      body: `${resident.name} (${roomLabel}) says they paid ${moneyINR(amount)} for ${monthLabel}`,
      url: '/admin/rent',
    }),
    sendEmail({
      to: process.env.ADMIN_NOTIFY_EMAIL || 'thebedbox.in@gmail.com',
      subject: `💳 ${resident.name} reported a payment — please verify`,
      html: emailShell('Payment reported by resident', `
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px">
          <strong style="color:#0f172a">${resident.name}</strong> (${roomLabel}) says they paid for <strong>${monthLabel}</strong>. This has NOT been marked paid yet — please verify against the screenshot and confirm in Rent Tracker.
        </p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Amount claimed</span><span style="font-weight:700;color:#0f172a">${moneyINR(amount)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Mode</span><span style="font-weight:600;color:#0f172a;text-transform:capitalize">${(paymentMode || '—').replace('_', ' ')}</span></div>
        </div>
      `),
    }),
  ])

  return NextResponse.json({ success: true })
}
