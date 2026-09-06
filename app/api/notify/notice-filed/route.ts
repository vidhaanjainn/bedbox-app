import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail, emailShell, formatDateLong } from '@/lib/notify'
import { sendPushToAdmins } from '@/lib/push'

// Called whenever a notice to vacate becomes active — from the resident's
// own self-file (app/portal/notice), an admin applying a Google Form
// submission, or an admin manually adding one (app/admin/notices). Verifies
// the caller is EITHER that resident themselves OR an active admin before
// sending anything — a resident can only trigger this for their own notice,
// an admin can trigger it for anyone's.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { residentId, lastDayOfStay, lastDayPerAgreement, noticeDate } = await req.json()
  if (!residentId) return NextResponse.json({ error: 'residentId is required.' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: resident } = await admin
    .from('residents')
    .select('id, name, email, room_number, portal_user_id')
    .eq('id', residentId)
    .single()
  if (!resident) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })

  const isSelf = resident.portal_user_id === user.id
  if (!isSelf) {
    const { data: callerAdmin } = await admin.from('admins').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!callerAdmin) return NextResponse.json({ error: 'Not authorized for this resident.' }, { status: 403 })
  }

  const roomLabel = resident.room_number ? `Room ${resident.room_number}` : 'Room not on file'
  const lastDay = lastDayOfStay || lastDayPerAgreement
  const lastDayLabel = lastDay ? formatDateLong(lastDay) : 'to be confirmed'
  const agreementLabel = lastDayPerAgreement ? formatDateLong(lastDayPerAgreement) : null
  const showAgreementNote = agreementLabel && lastDayOfStay && lastDayPerAgreement !== lastDayOfStay
  const noticeDateLabel = noticeDate ? formatDateLong(noticeDate) : formatDateLong(new Date().toISOString())

  const { data: admins } = await admin.from('admins').select('email').eq('is_active', true).not('email', 'is', null)
  const adminEmails = (admins || []).map(a => a.email!).filter(Boolean)

  const tasks: Promise<any>[] = [
    sendPushToAdmins({
      title: 'Notice to vacate filed',
      body: `${resident.name} (${roomLabel}) — leaving ${lastDayLabel}`,
      url: '/admin/notices',
    }),
  ]

  for (const to of adminEmails) {
    tasks.push(sendEmail({
      to,
      subject: `📋 ${resident.name} filed notice to vacate`,
      html: emailShell('Notice to vacate filed', `
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px">
          <strong style="color:#0f172a">${resident.name}</strong> (${roomLabel}) has filed a notice to vacate, effective <strong>${lastDayLabel}</strong>.
        </p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Notice filed</span><span style="font-weight:600;color:#0f172a">${noticeDateLabel}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Last day of stay</span><span style="font-weight:700;color:#0f172a">${lastDayLabel}</span></div>
        </div>
      `),
    }))
  }

  if (resident.email) {
    tasks.push(sendEmail({
      to: resident.email,
      subject: 'Your notice to vacate — TheBedBox',
      html: emailShell('Notice to Vacate Confirmed', `
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
          Dear ${resident.name.split(' ')[0]}, this confirms we have received your notice to vacate
          <strong style="color:#0f172a">${roomLabel}</strong>, filed on <strong style="color:#0f172a">${noticeDateLabel}</strong>.
        </p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:20px">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Last day of stay</div>
          <div style="font-size:20px;font-weight:700;color:#0f172a">${lastDayLabel}</div>
          ${showAgreementNote ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9;font-size:12.5px;color:#64748b;line-height:1.6">Note: your tenancy agreement's formal notice period runs through <strong>${agreementLabel}</strong>. Rent applies through whichever date is later, per your agreement.</div>` : ''}
        </div>
        <div style="font-size:13px;color:#334155;line-height:1.9;margin-bottom:20px">
          <div>• Rent and applicable electricity charges continue to apply through your last day of stay.</div>
          <div>• Please return all keys and access cards to management on or before your last day.</div>
          <div>• Kindly leave the room, furniture, and fixtures in their original condition — our team will inspect before processing your security deposit.</div>
          <div>• If you wish to reconsider or extend your stay, please let us know within 30 days of this notice.</div>
        </div>
        <p style="color:#94a3b8;font-size:12px;margin:0">Questions? Call TheBedBox at <a href="tel:+917999546362" style="color:#00a89d">+91 79995 46362</a>.</p>
      `),
    }))
  }

  await Promise.all(tasks)

  return NextResponse.json({ success: true })
}
