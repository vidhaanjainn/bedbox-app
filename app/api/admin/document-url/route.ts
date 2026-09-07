import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Admin-gated: mints a short-lived signed URL for any object in the private
// resident-docs bucket (electricity photos, payment screenshots, aadhaar,
// etc.) so the admin console can view them without the bucket being public.
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

  const { path } = await req.json()
  if (!path) return NextResponse.json({ error: 'path is required.' }, { status: 400 })

  const { data, error } = await admin.storage.from('resident-docs').createSignedUrl(path, 300)
  if (error || !data) return NextResponse.json({ error: 'Could not open this file.' }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl })
}
