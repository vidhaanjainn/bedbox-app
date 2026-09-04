import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { syncNoticeFormSubmissions } from '@/lib/notice-form-sync'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: adminRow } = await admin.from('admins').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!adminRow) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const result = await syncNoticeFormSubmissions()
  if ('error' in result) return NextResponse.json(result, { status: 502 })
  return NextResponse.json(result)
}
