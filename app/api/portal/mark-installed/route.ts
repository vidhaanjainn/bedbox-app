import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Resident-gated: stamps pwa_installed_at the first time this resident's
// browser reports the app as actually installed (either the `appinstalled`
// event firing, or the app being opened already in standalone display mode).
// This is the one place that field is ever set, so admins get a real
// "who has the app installed" answer instead of guessing from who's
// dismissed the install banner.
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
    .select('id, pwa_installed_at')
    .eq('portal_user_id', user.id)
    .maybeSingle()
  if (!resident) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })

  if (!resident.pwa_installed_at) {
    await admin.from('residents').update({ pwa_installed_at: new Date().toISOString() }).eq('id', resident.id)
  }

  return NextResponse.json({ success: true })
}
