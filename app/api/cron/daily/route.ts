import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, emailShell, moneyINR } from '@/lib/notify'
import { syncNoticeFormSubmissions } from '@/lib/notice-form-sync'

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
      console.log(`[DRY RUN] would remind ${resident.email} — ${tone} — ${moneyINR(outstanding)}`)
      sent++
      continue
    }

    const result = await sendEmail({
      to: resident.email,
      subject: `${tone} — ${moneyINR(outstanding)} ${resident.room_number ? `(Room ${resident.room_number})` : ''}`.trim(),
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
    })

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

  return NextResponse.json({
    dryRun,
    rentRowsCreated: rowsResult.created,
    remindersSent: reminderResult.sent,
    noticeFormRowsImported: 'imported' in noticeFormResult ? noticeFormResult.imported : 0,
  })
}
