import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail, emailShell } from '@/lib/notify'

// Admin-gated: emails a resident their self-onboarding link directly, instead
// of the admin having to copy/paste it into WhatsApp themselves. Non-fatal -
// the admin still sees the raw link on the resident page as a manual fallback
// (no email on file, or the send fails).
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: callerAdmin } = await admin.from('admins').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!callerAdmin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { residentId, link } = await req.json()
  if (!residentId || !link) return NextResponse.json({ error: 'residentId and link are required.' }, { status: 400 })

  const { data: resident } = await admin.from('residents').select('name, email').eq('id', residentId).single()
  if (!resident) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })
  if (!resident.email) return NextResponse.json({ error: 'No email on file for this resident.' }, { status: 400 })

  const result = await sendEmail({
    to: resident.email,
    subject: `Welcome to TheBedBox, ${resident.name.split(' ')[0]} - complete your onboarding`,
    html: emailShell('Complete your onboarding', `
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
        Hi ${resident.name.split(' ')[0]}, you're moving into TheBedBox! Please complete a short
        onboarding form - your details, ID, and digital agreement - so we can get your room ready.
      </p>
      <a href="${link}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#00d4c8,#0099ff);color:#070d1a;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px;margin-bottom:20px">
        Start Onboarding →
      </a>
      <p style="color:#94a3b8;font-size:12px;margin:0">This link expires in 7 days and can only be used once. Questions? Call +91 79995 46362.</p>
    `),
  })
  if ('error' in result) return NextResponse.json({ error: 'Could not send email.' }, { status: 500 })

  return NextResponse.json({ success: true, email: resident.email })
}
