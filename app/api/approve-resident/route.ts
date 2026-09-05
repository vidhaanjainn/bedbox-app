import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

// Admin-gated: activates a resident (onboarding_status -> 'active'), stamps who
// approved them (for the multi-admin attribution trail), and sends the resident
// their "you're approved, here's how to log in" email — this used to be dead
// code that nothing ever called, so residents never actually got this email.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: callerAdmin } = await admin.from('admins').select('id, name').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!callerAdmin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { residentId } = await req.json()
  if (!residentId) return NextResponse.json({ error: 'residentId is required.' }, { status: 400 })

  const { data: resident, error: fetchError } = await admin
    .from('residents')
    .select('id, name, email, mobile')
    .eq('id', residentId)
    .single()
  if (fetchError || !resident) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })

  const nowIso = new Date().toISOString()
  const { error: updateError } = await admin.from('residents').update({
    onboarding_status: 'active',
    status: 'active',
    onboarded_by: callerAdmin.id,
    onboarded_at: nowIso,
  }).eq('id', residentId)
  if (updateError) return NextResponse.json({ error: 'Could not activate resident.' }, { status: 500 })

  if (resident.email) {
    try {
      await resend.emails.send({
        from: 'TheBedBox <onboarding@resend.dev>',
        to: resident.email,
        subject: `Welcome to TheBedBox, ${resident.name.split(' ')[0]}! 🎉`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #070d1a; border-radius: 12px; color: #fff;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #00d4c8, #0099ff); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #070d1a; margin-bottom: 24px;">B</div>
            <h2 style="margin: 0 0 8px; font-size: 22px;">You're approved, ${resident.name.split(' ')[0]}! 🎉</h2>
            <p style="color: rgba(255,255,255,0.6); margin: 0 0 28px; line-height: 1.6;">Your onboarding is complete and your room at TheBedBox is ready. You can now log into your resident portal.</p>
            <a href="https://bedbox-app-alpha.vercel.app/portal" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #00d4c8, #0099ff); color: #070d1a; font-weight: 700; text-decoration: none; border-radius: 10px; font-size: 15px; margin-bottom: 24px;">
              Log into Portal →
            </a>
            <div style="background: rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; margin-bottom: 24px;">
              <div style="font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">How to log in</div>
              <div style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.8;">
                1. Open the portal link above<br/>
                2. Enter your mobile number: <strong style="color: #fff;">${resident.mobile}</strong><br/>
                3. We'll email a 6-digit code to <strong style="color: #fff;">this email address</strong> — check your inbox (and spam folder)<br/>
                4. Enter the code and you're in
              </div>
            </div>
            <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">Questions? Call us on <a href="tel:+917999546362" style="color: #00d4c8;">+91 79995 46362</a></p>
          </div>
        `,
      })
    } catch (err) {
      console.error('approve-resident email failed:', err)
      // Non-fatal — activation already succeeded; admin can resend by other means.
    }
  }

  return NextResponse.json({ success: true, onboarded_by: callerAdmin.name, onboarded_at: nowIso })
}
