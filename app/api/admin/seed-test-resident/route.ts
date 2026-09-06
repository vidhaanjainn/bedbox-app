import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// One-click, idempotent setup for a password-login test resident account, so
// the owner can review the resident portal UX repeatedly without the OTP
// round-trip. Admin-only — reuses the caller's own session, same pattern as
// /api/admin/invite. Safe to click more than once (upserts, doesn't duplicate).
const TEST_NAME = 'Vidhaan (Review Account)'
const TEST_MOBILE = '7999546362'
const TEST_EMAIL = 'vidhaanj29@gmail.com'
const TEST_PASSWORD = 'admin'

export async function POST() {
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

  // 1. Find-or-create the auth user, then force-set the known password either way
  //    (covers the case where it already exists with a different password).
  let authUserId: string | undefined
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true,
  })
  if (createError) {
    if (!createError.message?.toLowerCase().includes('already') && !createError.message?.toLowerCase().includes('registered')) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
    const { data: list } = await admin.auth.admin.listUsers()
    const existing = list?.users?.find(u => u.email === TEST_EMAIL)
    if (!existing) return NextResponse.json({ error: 'Could not resolve existing auth user.' }, { status: 500 })
    authUserId = existing.id
    await admin.auth.admin.updateUserById(existing.id, { password: TEST_PASSWORD })
  } else {
    authUserId = created.user?.id
  }
  if (!authUserId) return NextResponse.json({ error: 'Could not create or resolve the auth user.' }, { status: 500 })

  // 2. Find-or-create the resident row, linked to that auth user.
  const { data: existingResident } = await admin.from('residents').select('id').eq('mobile', TEST_MOBILE).maybeSingle()

  if (existingResident) {
    await admin.from('residents').update({ portal_user_id: authUserId, email: TEST_EMAIL, name: TEST_NAME, is_test_account: true }).eq('id', existingResident.id)
  } else {
    await admin.from('residents').insert({
      name: TEST_NAME,
      mobile: TEST_MOBILE,
      email: TEST_EMAIL,
      portal_user_id: authUserId,
      rent_amount: 8000,
      status: 'active',
      onboarding_status: 'active',
      is_test_account: true,
      date_of_joining: new Date().toISOString().split('T')[0],
      notes: '🧪 Admin review account — used to test the resident portal UX. Not a real resident; no bed occupied. Excluded from all admin financial totals. Log in at /portal via the "Sign in with password" link (email: vidhaanj29@gmail.com / password: admin).',
    })
  }

  return NextResponse.json({ success: true, email: TEST_EMAIL, password: TEST_PASSWORD })
}
