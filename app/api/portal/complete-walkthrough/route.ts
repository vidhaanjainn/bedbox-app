import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Resident-gated: stamps the one-time post-approval welcome walkthrough as
// done (finished or skipped - both count, since every step in it is
// optional by design) so it never shows again for this resident.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: resident } = await admin
    .from('residents')
    .select('id, onboarding_walkthrough_completed_at')
    .eq('portal_user_id', user.id)
    .maybeSingle()
  if (!resident) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })

  if (!resident.onboarding_walkthrough_completed_at) {
    await admin.from('residents').update({ onboarding_walkthrough_completed_at: new Date().toISOString() }).eq('id', resident.id)
  }

  return NextResponse.json({ success: true })
}
