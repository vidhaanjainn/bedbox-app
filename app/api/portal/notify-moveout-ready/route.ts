import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushToAdmins } from '@/lib/push'

// Resident-gated: called from the vacated portal view whenever the client
// thinks all three move-out steps look done - but every condition is
// re-verified here server-side against the resident's own row rather than
// trusted from the request body, since this is what decides whether the
// admin gets pinged. Safe to call repeatedly: move_out_ready_notified_at
// makes the actual notification fire exactly once.
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
    .select('id, name, room_number, status, vacated_at, checklist_final_video_done_at, move_out_ready_notified_at')
    .eq('portal_user_id', user.id)
    .maybeSingle()
  if (!resident) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })
  if (resident.status !== 'vacated' || !resident.vacated_at) {
    return NextResponse.json({ error: 'Not applicable - resident has not vacated.' }, { status: 400 })
  }
  if (resident.move_out_ready_notified_at) {
    return NextResponse.json({ ok: true, alreadyNotified: true })
  }

  const { data: finalReading } = await admin
    .from('electricity_readings')
    .select('id')
    .eq('resident_id', resident.id)
    .gte('created_at', resident.vacated_at)
    .limit(1)
    .maybeSingle()

  const { data: unpaidRows } = await admin
    .from('rent_payments')
    .select('total_amount, amount_paid')
    .eq('resident_id', resident.id)
    .neq('status', 'paid')
  const totalOwed = (unpaidRows || []).reduce((s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.amount_paid || 0)), 0)

  const allDone = !!finalReading && !!resident.checklist_final_video_done_at && totalOwed <= 0
  if (!allDone) return NextResponse.json({ ok: true, allDone: false })

  const nowIso = new Date().toISOString()
  await admin.from('residents').update({ move_out_ready_notified_at: nowIso }).eq('id', resident.id)

  await sendPushToAdmins({
    title: 'Ready for move-out settlement',
    body: `${resident.name}${resident.room_number ? ` (Room ${resident.room_number})` : ''} has cleared all move-out steps - verify and settle their deposit.`,
    url: '/admin/residents',
  })

  return NextResponse.json({ ok: true, allDone: true })
}
