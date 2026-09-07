import { NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, emailShell } from '@/lib/notify'
import { sendPushToAdmins } from '@/lib/push'
import { APP_URL } from '@/lib/config'

// Secure self-onboarding API (SEC-01 / SEC-02).
// All token validation happens server-side with the service-role key, so no
// anon RLS policies on `residents` or open storage-upload policies are needed.

function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type TokenCheck =
  | { resident: { id: string; name: string; email: string | null; mobile: string | null } }
  | { error: string; status: number }

async function residentForToken(supabase: SupabaseClient, token: string): Promise<TokenCheck> {
  if (!token || token.length < 32) return { error: 'This link is invalid.', status: 400 }

  const { data, error } = await supabase
    .from('residents')
    .select('id, name, email, mobile, onboard_token_used, onboard_token_expires_at')
    .eq('onboard_token', token)
    .single()

  if (error || !data) return { error: 'This link is invalid or has expired.', status: 404 }
  if (data.onboard_token_used) {
    return { error: 'This onboarding link has already been used. Contact TheBedBox if you need help.', status: 410 }
  }
  if (!data.onboard_token_expires_at || new Date(data.onboard_token_expires_at) < new Date()) {
    return { error: 'This link has expired. Please contact TheBedBox for a new link.', status: 410 }
  }
  return { resident: { id: data.id, name: data.name, email: data.email, mobile: data.mobile } }
}

// GET /api/onboard/[token] - validate token, return only what the wizard displays
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    const check = await residentForToken(adminClient(), token)
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })
    const { name, email, mobile } = check.resident
    return NextResponse.json({ resident: { name, email, mobile } })
  } catch (err) {
    console.error('onboard GET error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

// POST /api/onboard/[token]
//   { action: 'upload-url', side: 'front' | 'back' }  → signed upload URL for Aadhaar image
//   { action: 'submit', ...whitelisted fields }        → save details, mark token used
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    const supabase = adminClient()
    const check = await residentForToken(supabase, token)
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })
    const resident = check.resident

    const body = await req.json()

    if (body.action === 'upload-url') {
      const side = body.side === 'back' ? 'back' : body.side === 'signature' ? 'signature' : 'front'
      const prefix = side === 'signature' ? 'signature' : `aadhaar-${side}`
      const path = `onboarding/${resident.id}/${prefix}-${Date.now()}`
      const { data, error } = await supabase.storage
        .from('resident-docs')
        .createSignedUploadUrl(path)
      if (error || !data) {
        console.error('onboard upload-url error:', error)
        return NextResponse.json({ error: 'Could not prepare upload. Please try again.' }, { status: 500 })
      }
      return NextResponse.json({ path: data.path, uploadToken: data.token })
    }

    if (body.action === 'submit') {
      const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
      const docPath = (v: unknown) => {
        const p = str(v, 300)
        // Only accept paths this API issued for this resident
        return p.startsWith(`onboarding/${resident.id}/`) ? p : ''
      }

      if (body.agreement_agreed !== true) {
        return NextResponse.json({ error: 'You must accept the agreement to continue.' }, { status: 400 })
      }
      const emergencyName = str(body.emergency_contact_name)
      const emergencyPhone = str(body.emergency_contact_phone, 20)
      if (!emergencyName || !emergencyPhone) {
        return NextResponse.json({ error: 'Emergency contact details are required.' }, { status: 400 })
      }
      const aadhaarNumber = str(body.aadhaar_number, 12).replace(/\D/g, '')
      if (aadhaarNumber.length !== 12) {
        return NextResponse.json({ error: 'A valid 12-digit Aadhaar number is required.' }, { status: 400 })
      }
      const signaturePath = docPath(body.signature_path)
      if (!signaturePath) {
        return NextResponse.json({ error: 'Please sign the agreement before submitting.' }, { status: 400 })
      }

      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'

      const { error: updateError } = await supabase
        .from('residents')
        .update({
          emergency_contact_name: emergencyName,
          // Both columns exist in the schema and different parts of the app
          // read one or the other - keep them in sync, same as the admin's
          // own manual-onboarding form already does.
          emergency_contact_phone: emergencyPhone,
          emergency_contact_number: emergencyPhone,
          hometown: str(body.hometown),
          institution: str(body.institution),
          occupation: str(body.occupation, 50),
          aadhaar_number: aadhaarNumber,
          aadhaar_front_url: docPath(body.aadhaar_front_path),
          aadhaar_back_url: docPath(body.aadhaar_back_path),
          signature_path: signaturePath,
          agreement_signed_at: new Date().toISOString(),
          agreement_ip: ip,
          agreement_version: str(body.agreement_version, 40) || null,
          onboarding_status: 'submitted',
          onboard_token_used: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resident.id)
        .eq('onboard_token_used', false) // guard against double submit races

      if (updateError) {
        console.error('onboard submit error:', updateError)
        return NextResponse.json({ error: 'Could not save your details. Please try again.' }, { status: 500 })
      }

      // Notify admins server-side, right here - not as a client-side
      // fire-and-forget after redirect, which could get lost if the
      // resident closes the tab a moment too early.
      await Promise.all([
        sendPushToAdmins({
          title: 'New onboarding submitted',
          body: `${resident.name} completed onboarding - needs your approval`,
          url: '/admin/residents',
        }),
        sendEmail({
          to: process.env.ADMIN_NOTIFY_EMAIL || 'thebedbox.in@gmail.com',
          subject: `✅ ${resident.name} has completed onboarding - approval needed`,
          html: emailShell('New onboarding submission', `
            <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
              <strong style="color:#0f172a">${resident.name}</strong> has completed their onboarding
              and is waiting for your approval before their portal access activates.
            </p>
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:20px">
              <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Mobile</span><span style="font-weight:600;color:#0f172a">${resident.mobile || '-'}</span></div>
              <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b;font-size:13px">Email</span><span style="font-weight:600;color:#0f172a">${resident.email || '-'}</span></div>
            </div>
            <a href="${APP_URL}/admin/residents/${resident.id}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#00d4c8,#0099ff);color:#070d1a;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px">
              Review &amp; Approve →
            </a>
          `),
        }),
      ])

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    console.error('onboard POST error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
