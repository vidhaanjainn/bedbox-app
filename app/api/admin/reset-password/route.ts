import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail, emailShell } from '@/lib/notify'

// Emergency unblock for the invite flow: this app has no page to consume
// Supabase's invite-confirmation link (no /auth/callback / set-password
// route exists), so an invited admin who clicks "Set up your account" has
// nowhere to actually land and set a password. Rather than depend on that
// broken flow, this directly sets a temp password on the target admin's
// existing auth user and emails it to them — same result, works today.
// Caller must be an active admin; cannot be used to touch non-admin users.
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

  const { adminId } = await req.json()
  if (!adminId) return NextResponse.json({ error: 'adminId is required.' }, { status: 400 })

  const { data: targetAdmin } = await admin.from('admins').select('id, name, email, user_id').eq('id', adminId).single()
  if (!targetAdmin || !targetAdmin.user_id) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 })

  const tempPassword = `TheBedBox${Math.floor(100000 + Math.random() * 900000)}!`
  const { error: pwError } = await admin.auth.admin.updateUserById(targetAdmin.user_id, {
    password: tempPassword,
    email_confirm: true,
  })
  if (pwError) return NextResponse.json({ error: pwError.message || 'Could not reset password.' }, { status: 500 })

  let emailed = false
  if (targetAdmin.email) {
    const result = await sendEmail({
      to: targetAdmin.email,
      subject: 'Your TheBedBox Admin Console access',
      html: emailShell('Your Admin Console access', `
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
          Hi ${targetAdmin.name.split(' ')[0]}, here's how to sign in to the TheBedBox Admin Console.
        </p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Email</span><span style="font-weight:600;color:#0f172a">${targetAdmin.email}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Temporary password</span><span style="font-weight:700;color:#0f172a">${tempPassword}</span></div>
        </div>
        <a href="https://bedbox-app-alpha.vercel.app/login" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#00d4c8,#0099ff);color:#070d1a;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px;margin-bottom:20px">
          Log in to Admin Console →
        </a>
        <p style="color:#94a3b8;font-size:12px;margin:0">You can change this password from Settings once you're signed in.</p>
      `),
    })
    emailed = !('error' in result) && !('skipped' in result)
  }

  return NextResponse.json({ success: true, tempPassword, emailed })
}
