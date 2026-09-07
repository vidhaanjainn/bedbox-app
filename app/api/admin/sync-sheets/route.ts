import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { syncResidentsSheet } from '@/lib/sheets'

// Admin-gated: pushes a full, fresh snapshot of every resident to the
// "Residents" tab of the configured Google Sheet. Called automatically after
// create/approve/edit (fire-and-forget, non-fatal), and available here for a
// manual "Sync Now" button so the owner can always force an up-to-date copy.
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

  const result = await syncResidentsSheet(admin)
  if ('skipped' in result) return NextResponse.json({ error: 'Google Sheets isn\'t set up yet - see Settings for the one-time setup steps.' }, { status: 400 })
  if ('error' in result) return NextResponse.json({ error: 'Sync failed. Please try again.' }, { status: 500 })
  return NextResponse.json(result)
}
