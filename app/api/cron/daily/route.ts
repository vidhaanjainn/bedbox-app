import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, emailShell, moneyINR } from '@/lib/notify'
import { syncNoticeFormSubmissions } from '@/lib/notice-form-sync'
import { sendPushToAdmins, sendPushToResident } from '@/lib/push'

// AUTO-01 + AUTO-02 + AUTO-03 (daily): runs once a day via Vercel Cron (see vercel.json).
//   1. Ensures every active resident has a rent_payments row for the current month.
//   2. Sends rent reminder emails on a tiered schedule (upcoming -> due -> overdue),
//      capped at 4 reminders per invoice, tracked via last_reminded_at/reminder_count.
// Idempotent and safe to re-run. Set REMINDERS_DRY_RUN=1 to log instead of sending.

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function dueDayFor(dateOfJoining: string | null): number {
  if (!dateOfJoining) return 5
  const day = new Date(dateOfJoining).getUTCDate()
  return Math.min(Math.max(day, 1), 28) // clamp so it exists in every month
}

async function ensureCurrentMonthRows(supabase: ReturnType<typeof adminClient>, dryRun: boolean) {
  const now = new Date()
  const month = now.getUTCMonth() + 1
  const year = now.getUTCFullYear()

  const { data: residents, error } = await supabase
    .from('residents')
    .select('id, rent_amount')
    .eq('status', 'active')
  if (error || !residents) return { created: 0, error }

  let created = 0
  for (const r of residents) {
    const { data: existing } = await supabase
      .from('rent_payments')
      .select('id')
      .eq('resident_id', r.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()
    if (existing) continue
    if (dryRun) { created++; continue }
    const rent = Number(r.rent_amount) || 0
    const { error: insertError } = await supabase.from('rent_payments').insert({
      resident_id: r.id,
      month,
      year,
      rent_amount: rent,
      electricity_amount: 0,
      late_fee: 0,
      total_amount: rent,
      amount_paid: 0,
      status: 'pending',
    })
    if (!insertError) created++
  }
  return { created }
}

async function sendReminders(supabase: ReturnType<typeof adminClient>, dryRun: boolean) {
  const { data: rows, error } = await supabase
    .from('rent_payments')
    .select('id, resident_id, total_amount, amount_paid, status, reminder_count, last_reminded_at, created_at, residents(name, email, date_of_joining, room_number)')
    .in('status', ['pending', 'partial'])
  if (error || !rows) return { sent: 0, error }

  const today = new Date()
  let sent = 0

  for (const row of rows as any[]) {
    const resident = row.residents
    if (!resident?.email) continue
    if ((row.reminder_count || 0) >= 4) continue

    const dueDay = dueDayFor(resident.date_of_joining)
    const dueDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), dueDay))
    const daysFromDue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000)

    // Send at: T-3 (upcoming), T0 (due today), then every 3 days while overdue (max 4 total)
    const shouldSend = daysFromDue === -3 || daysFromDue === 0 || (daysFromDue > 0 && daysFromDue % 3 === 0)
    if (!shouldSend) continue

    // Don't double-send same day if the cron runs more than once
    if (row.last_reminded_at) {
      const lastSent = new Date(row.last_reminded_at)
      if (lastSent.toDateString() === today.toDateString()) continue
    }

    const outstanding = Number(row.total_amount) - Number(row.amount_paid || 0)
    const tone = daysFromDue < 0 ? 'Upcoming rent' : daysFromDue === 0 ? 'Rent due today' : 'Rent overdue'

    if (dryRun) {
      console.log(`[DRY RUN] would remind ${resident.email} - ${tone} - ${moneyINR(outstanding)}`)
      sent++
      continue
    }

    const pushBody = daysFromDue < 0
      ? `Coming up in ${Math.abs(daysFromDue)} day${Math.abs(daysFromDue) === 1 ? '' : 's'} - ${moneyINR(outstanding)}`
      : daysFromDue === 0
        ? `Due today - ${moneyINR(outstanding)}`
        : `${daysFromDue} day${daysFromDue === 1 ? '' : 's'} overdue - ${moneyINR(outstanding)}`

    const [result] = await Promise.all([
      sendEmail({
        to: resident.email,
        subject: `${tone} - ${moneyINR(outstanding)} ${resident.room_number ? `(Room ${resident.room_number})` : ''}`.trim(),
        html: emailShell(tone, `
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
            Hi ${resident.name?.split(' ')[0] || 'there'}, ${daysFromDue < 0
              ? `your rent is coming up in ${Math.abs(daysFromDue)} day${Math.abs(daysFromDue) === 1 ? '' : 's'}.`
              : daysFromDue === 0
                ? 'your rent is due today.'
                : `your rent is ${daysFromDue} day${daysFromDue === 1 ? '' : 's'} overdue.`}
          </p>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Outstanding</span><span style="font-weight:700;color:#0f172a">${moneyINR(outstanding)}</span></div>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:0">Already paid? Please ignore this and let TheBedBox know so we can update your record.</p>
        `),
      }),
      sendPushToResident(row.resident_id, { title: tone, body: pushBody, url: '/portal/home' }),
    ])

    if (!('skipped' in result) && !('error' in result)) {
      await supabase.from('rent_payments').update({
        last_reminded_at: new Date().toISOString(),
        reminder_count: (row.reminder_count || 0) + 1,
      }).eq('id', row.id)
      sent++
    }
  }
  return { sent }
}

// AUTO-07: admin-facing digest, days 1-6 of the month only - reminds the owner
// (not residents) to chase rent collection and pay staff/vendors. Sent once
// per day in that window, to every active admin with an email on file.
async function sendAdminMonthlyDigest(supabase: ReturnType<typeof adminClient>, dryRun: boolean) {
  const today = new Date()
  const day = today.getUTCDate()
  if (day < 1 || day > 6) return { sent: 0, skipped: 'outside 1st-6th window' }

  const month = today.getUTCMonth() + 1
  const year = today.getUTCFullYear()
  const todayStr = today.toISOString().split('T')[0]

  // Dedupe - a manually re-triggered cron (e.g. testing) shouldn't re-send the
  // same day's digest to every admin again.
  const { data: lastSentSetting } = await supabase.from('settings').select('value').eq('key', 'last_admin_digest_sent_date').maybeSingle()
  if (lastSentSetting?.value === todayStr) return { sent: 0, skipped: 'already sent today' }

  const [{ data: admins }, { data: rentRows }, { data: staffRows }, { data: payouts }] = await Promise.all([
    supabase.from('admins').select('email, name').eq('is_active', true).not('email', 'is', null),
    supabase.from('rent_payments').select('status, total_amount, amount_paid, residents(is_test_account)').eq('month', month).eq('year', year),
    supabase.from('staff').select('id, name, monthly_salary').eq('is_active', true),
    supabase.from('staff_payouts').select('staff_id, status').eq('month', month).eq('year', year),
  ])
  if (!admins?.length) return { sent: 0, error: 'no active admin emails on file' }

  // The review/test resident account never counts toward real collection totals.
  const realRentRows = (rentRows || []).filter((r: any) => !r.residents?.is_test_account)
  const paidCount = realRentRows.filter(r => r.status === 'paid').length
  const totalCount = realRentRows.length
  const outstanding = realRentRows.reduce((s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.amount_paid || 0)), 0)

  const paidStaffIds = new Set((payouts || []).filter(p => p.status === 'paid').map(p => p.staff_id))
  const unpaidStaff = (staffRows || []).filter(s => !paidStaffIds.has(s.id))

  const subject = `Monthly reminder: rent + staff payouts (${paidCount}/${totalCount} rent collected)`
  const html = emailShell('Monthly Admin Reminder', `
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">It's the 1st–6th of the month - time to chase rent and settle staff/vendor payouts.</p>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:16px">
      <div style="font-weight:700;color:#0f172a;margin-bottom:8px">Rent collection</div>
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Collected</span><span>${paidCount} / ${totalCount} residents</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Outstanding</span><span style="font-weight:700">${moneyINR(outstanding)}</span></div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px">
      <div style="font-weight:700;color:#0f172a;margin-bottom:8px">Staff & vendor payouts not yet marked paid</div>
      ${unpaidStaff.length === 0
        ? '<div style="color:#64748b;font-size:13px">All caught up ✓</div>'
        : unpaidStaff.map(s => `<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="font-size:13px">${s.name}</span><span>${moneyINR(Number(s.monthly_salary))}</span></div>`).join('')}
    </div>
  `)

  if (dryRun) {
    console.log(`[DRY RUN] admin digest to ${admins.length} admin(s): ${subject}`)
    return { sent: admins.length }
  }

  await sendPushToAdmins({
    title: 'Monthly rent + payouts reminder',
    body: `${paidCount}/${totalCount} rent collected · ${unpaidStaff.length} payout(s) pending`,
    url: '/admin/rent',
  })

  let sent = 0
  for (const admin of admins) {
    const result = await sendEmail({ to: admin.email!, subject, html })
    if (!('skipped' in result) && !('error' in result)) sent++
  }
  if (sent > 0) await supabase.from('settings').upsert({ key: 'last_admin_digest_sent_date', value: todayStr }, { onConflict: 'key' })
  return { sent }
}

// AUTO-08: warns admins 3 days before any resident's last day of stay, once
// per notice (expiry_alerted_at dedupes across multiple daily cron runs).
async function sendNoticeExpiryAlerts(supabase: ReturnType<typeof adminClient>, dryRun: boolean) {
  const target = new Date()
  target.setUTCDate(target.getUTCDate() + 3)
  const targetStr = target.toISOString().split('T')[0]

  // Matched in JS against last_day_of_stay falling back to
  // last_day_per_agreement - a notice with no actual vacate date filed yet
  // (last_day_of_stay left blank) would otherwise never trigger this alert.
  const { data: allActive } = await supabase
    .from('notice_periods')
    .select('id, last_day_of_stay, last_day_per_agreement, residents(name, room_number)')
    .eq('status', 'active')
    .is('expiry_alerted_at', null)

  const notices = (allActive || []).filter(n => (n.last_day_of_stay || n.last_day_per_agreement) === targetStr)

  if (!notices?.length) return { alerted: 0 }
  if (dryRun) {
    console.log(`[DRY RUN] would alert admins about ${notices.length} resident(s) leaving ${targetStr}`)
    return { alerted: notices.length }
  }

  for (const n of notices as any[]) {
    const resident = n.residents
    const roomLabel = resident?.room_number ? `Room ${resident.room_number}` : ''
    await Promise.all([
      sendPushToAdmins({
        title: 'Move-out in 3 days',
        body: `${resident?.name || 'A resident'} ${roomLabel} - last day ${targetStr}`,
        url: '/admin/residents',
      }),
      sendEmail({
        to: process.env.ADMIN_NOTIFY_EMAIL || 'thebedbox.in@gmail.com',
        subject: `⏳ ${resident?.name || 'A resident'} moves out in 3 days`,
        html: emailShell('Move-out in 3 days', `
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0">
            <strong style="color:#0f172a">${resident?.name || 'A resident'}</strong> ${roomLabel ? `(${roomLabel}) ` : ''}is due to move out on <strong>${targetStr}</strong>. Plan the deposit settlement and room turnover.
          </p>
        `),
      }),
    ])
    await supabase.from('notice_periods').update({ expiry_alerted_at: new Date().toISOString() }).eq('id', n.id)
  }
  return { alerted: notices.length }
}

// AUTO-09: from the 1st to the 10th of the month, nudges any active
// resident who hasn't logged this month's electricity reading yet - once
// per day per resident (last_electricity_reminded_at dedupes re-runs).
async function sendElectricityReminders(supabase: ReturnType<typeof adminClient>, dryRun: boolean) {
  const today = new Date()
  const day = today.getUTCDate()
  if (day < 1 || day > 10) return { sent: 0, skipped: 'outside 1st-10th window' }

  const month = today.getUTCMonth() + 1
  const year = today.getUTCFullYear()

  const { data: residents } = await supabase
    .from('residents')
    .select('id, name, portal_user_id, last_electricity_reminded_at')
    .eq('status', 'active')
    .not('portal_user_id', 'is', null)
  if (!residents?.length) return { sent: 0 }

  const { data: loggedRows } = await supabase
    .from('electricity_readings')
    .select('resident_id')
    .eq('month', month).eq('year', year)
  const logged = new Set((loggedRows || []).map(r => r.resident_id))

  const todayStr = today.toISOString().split('T')[0]
  let sent = 0

  for (const r of residents) {
    if (logged.has(r.id)) continue
    if (r.last_electricity_reminded_at && new Date(r.last_electricity_reminded_at).toISOString().split('T')[0] === todayStr) continue

    if (dryRun) { sent++; continue }
    await sendPushToResident(r.id, {
      title: 'Log your electricity reading',
      body: "Takes 10 seconds - snap the meter and enter today's reading.",
      url: '/portal/electricity',
    })
    await supabase.from('residents').update({ last_electricity_reminded_at: new Date().toISOString() }).eq('id', r.id)
    sent++
  }
  return { sent }
}

// AUTO-10: rent can be paid while the electricity portion of the same
// month's bill is left outstanding (resident pays a round number that
// covers rent but not the meter charge added later) - that balance can
// otherwise sit forgotten indefinitely since the invoice already reads
// "partial" rather than a fresh, attention-grabbing due date. Nudges every
// 3 days for as long as it stays outstanding, tracked via
// electricity_payment_reminded_at (resets naturally each month with the
// rent_payments row itself).
async function sendElectricityPaymentReminders(supabase: ReturnType<typeof adminClient>, dryRun: boolean) {
  const month = new Date().getUTCMonth() + 1
  const year = new Date().getUTCFullYear()

  const { data: rows, error } = await supabase
    .from('rent_payments')
    .select('id, resident_id, rent_amount, late_fee, electricity_amount, total_amount, amount_paid, electricity_payment_reminded_at, residents(name, email, room_number, is_test_account)')
    .eq('month', month).eq('year', year)
    .eq('status', 'partial')
    .not('electricity_logged_at', 'is', null)
  if (error || !rows) return { sent: 0, error }

  const now = new Date()
  let sent = 0

  for (const row of rows as any[]) {
    const resident = row.residents
    if (!resident || resident.is_test_account) continue

    const rentAndLateFee = Number(row.rent_amount) + Number(row.late_fee || 0)
    const outstanding = Number(row.total_amount) - Number(row.amount_paid || 0)
    // Rent (and any late fee) is fully covered - what's left owed is the
    // electricity charge specifically, not a partial rent payment.
    const isElectricityOnlyBalance = Number(row.amount_paid || 0) >= rentAndLateFee && outstanding > 0
    if (!isElectricityOnlyBalance) continue

    if (row.electricity_payment_reminded_at) {
      const daysSince = (now.getTime() - new Date(row.electricity_payment_reminded_at).getTime()) / 86400000
      if (daysSince < 3) continue
    }

    if (dryRun) { sent++; continue }

    await Promise.all([
      sendPushToResident(row.resident_id, {
        title: 'Electricity charge still due',
        body: `${moneyINR(outstanding)} outstanding for this month's electricity - your rent is settled, just this left.`,
        url: '/portal/home',
      }),
      resident.email ? sendEmail({
        to: resident.email,
        subject: `Electricity charge pending - ${moneyINR(outstanding)} ${resident.room_number ? `(Room ${resident.room_number})` : ''}`.trim(),
        html: emailShell('Electricity charge pending', `
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
            Hi ${resident.name?.split(' ')[0] || 'there'}, your rent for this month is settled - thank you! There's just the electricity charge left to clear.
          </p>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Electricity outstanding</span><span style="font-weight:700;color:#0f172a">${moneyINR(outstanding)}</span></div>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:0">Already paid? Please let TheBedBox know so we can update your record.</p>
        `),
      }) : Promise.resolve(),
    ])
    await supabase.from('rent_payments').update({ electricity_payment_reminded_at: now.toISOString() }).eq('id', row.id)
    sent++
  }
  return { sent }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = process.env.REMINDERS_DRY_RUN === '1'
  const supabase = adminClient()

  const rowsResult = await ensureCurrentMonthRows(supabase, dryRun)
  const reminderResult = await sendReminders(supabase, dryRun)
  const noticeFormResult = dryRun ? { imported: 0 } : await syncNoticeFormSubmissions().catch(() => ({ imported: 0 }))
  const digestResult = await sendAdminMonthlyDigest(supabase, dryRun)
  const expiryResult = await sendNoticeExpiryAlerts(supabase, dryRun)
  const electricityResult = await sendElectricityReminders(supabase, dryRun)
  const electricityPaymentResult = await sendElectricityPaymentReminders(supabase, dryRun)

  return NextResponse.json({
    dryRun,
    rentRowsCreated: rowsResult.created,
    remindersSent: reminderResult.sent,
    noticeFormRowsImported: 'imported' in noticeFormResult ? noticeFormResult.imported : 0,
    adminDigestSent: digestResult.sent,
    moveOutAlertsSent: expiryResult.alerted,
    electricityRemindersSent: electricityResult.sent,
    electricityPaymentRemindersSent: electricityPaymentResult.sent,
  })
}
