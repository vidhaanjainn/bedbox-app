import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Admin-gated: resolves a resident's "pending_review" pro-rata flag (see
// lib/prorata.ts) one way or the other. "apply" leaves the credit amount in
// place for the daily cron to deduct off their very next rent_payments row;
// "decline" clears the credit outright so nothing can ever apply it later -
// the resident simply pays full rent every month, no reconciliation, which
// is the right call for plenty of residents and shouldn't require the admin
// to keep dismissing the same banner.
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

  const { residentId, action } = await req.json()
  if (!residentId || (action !== 'apply' && action !== 'decline')) {
    return NextResponse.json({ error: 'residentId and a valid action are required.' }, { status: 400 })
  }

  const { data: resident } = await admin
    .from('residents')
    .select('id, prorata_status')
    .eq('id', residentId)
    .maybeSingle()
  if (!resident) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })
  if (resident.prorata_status !== 'pending_review') {
    return NextResponse.json({ error: 'This resident has no pending pro-rata decision.' }, { status: 400 })
  }

  const { error } = await admin.from('residents').update({
    prorata_status: action === 'apply' ? 'applied' : 'declined',
    // Declining zeroes the credit outright so nothing can ever apply it
    // later; applying leaves the already-computed amount untouched for
    // the cron to pick up.
    ...(action === 'decline' ? { prorata_credit_amount: 0 } : {}),
    prorata_decided_at: new Date().toISOString(),
    prorata_decided_by: callerAdmin.id,
  }).eq('id', residentId)
  if (error) return NextResponse.json({ error: 'Could not save this decision.' }, { status: 500 })

  return NextResponse.json({ success: true })
}
