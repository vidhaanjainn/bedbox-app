import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, emailShell } from '@/lib/notify'
import { sendPushToAdmins } from '@/lib/push'

// Called by a resident right after submitting a maintenance request
// (app/portal/maintenance/page.tsx). Verifies the caller IS that resident.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { residentId, category, description } = await req.json()
  if (!residentId || !category) return NextResponse.json({ error: 'residentId and category are required.' }, { status: 400 })

  const { data: resident } = await supabase
    .from('residents')
    .select('id, name, room_number, portal_user_id')
    .eq('id', residentId)
    .single()
  if (!resident || resident.portal_user_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized for this resident.' }, { status: 403 })
  }

  const roomLabel = resident.room_number ? `Room ${resident.room_number}` : 'Room not on file'
  const categoryLabel = String(category).charAt(0).toUpperCase() + String(category).slice(1)

  await Promise.all([
    sendPushToAdmins({
      title: `New complaint: ${categoryLabel}`,
      body: `${resident.name} (${roomLabel})`,
      url: '/admin/maintenance',
    }),
    sendEmail({
      to: process.env.ADMIN_NOTIFY_EMAIL || 'thebedbox.in@gmail.com',
      subject: `🔧 New maintenance request — ${resident.name}`,
      html: emailShell('New maintenance request', `
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px">
          <strong style="color:#0f172a">${resident.name}</strong> (${roomLabel}) raised a <strong>${categoryLabel}</strong> request.
        </p>
        ${description ? `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;color:#334155;font-size:13px;line-height:1.6">${String(description).slice(0, 500)}</div>` : ''}
      `),
    }),
  ])

  return NextResponse.json({ success: true })
}
