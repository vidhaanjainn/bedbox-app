import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, emailShell } from '@/lib/notify'
import { sendPushToAdmins } from '@/lib/push'

// Called by a resident right after they submit their own notice to vacate
// (app/portal/notice/page.tsx). Verifies the caller IS that resident before
// alerting admins — a resident can only trigger this for their own notice.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { residentId, lastDay } = await req.json()
  if (!residentId || !lastDay) return NextResponse.json({ error: 'residentId and lastDay are required.' }, { status: 400 })

  const { data: resident } = await supabase
    .from('residents')
    .select('id, name, room_number, portal_user_id')
    .eq('id', residentId)
    .single()
  if (!resident || resident.portal_user_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized for this resident.' }, { status: 403 })
  }

  const lastDayLabel = new Date(lastDay).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const roomLabel = resident.room_number ? `Room ${resident.room_number}` : 'Room not on file'

  await Promise.all([
    sendPushToAdmins({
      title: 'Notice to vacate filed',
      body: `${resident.name} (${roomLabel}) — leaving ${lastDayLabel}`,
      url: '/admin/notices',
    }),
    sendEmail({
      to: process.env.ADMIN_NOTIFY_EMAIL || 'thebedbox.in@gmail.com',
      subject: `📋 ${resident.name} filed notice to vacate`,
      html: emailShell('Notice to vacate filed', `
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px">
          <strong style="color:#0f172a">${resident.name}</strong> (${roomLabel}) has filed a notice to vacate.
        </p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Last day of stay</span><span style="font-weight:700;color:#0f172a">${lastDayLabel}</span></div>
        </div>
      `),
    }),
  ])

  return NextResponse.json({ success: true })
}
