import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Resident-gated: issues a signed upload URL for a payment screenshot, the
// same pattern as onboarding document uploads — no open storage policy
// needed, the token itself authorizes one write to one path.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { rentPaymentId } = await req.json()
  if (!rentPaymentId) return NextResponse.json({ error: 'rentPaymentId is required.' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: payment } = await admin
    .from('rent_payments')
    .select('id, resident_id, residents(portal_user_id)')
    .eq('id', rentPaymentId)
    .single()
  if (!payment || (payment as any).residents?.portal_user_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized for this payment.' }, { status: 403 })
  }

  const path = `payments/${payment.resident_id}/${rentPaymentId}-${Date.now()}`
  const { data, error } = await admin.storage.from('resident-docs').createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: 'Could not prepare upload.' }, { status: 500 })

  return NextResponse.json({ path: data.path, uploadToken: data.token })
}
