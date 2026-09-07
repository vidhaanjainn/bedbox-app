import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Resident-gated: issues a signed upload URL for a payment screenshot. Keyed
// by resident + month/year rather than an existing rent_payments row, so a
// resident can attach proof even before an admin has generated that month's
// bill - the report-payment route creates the row on demand if needed.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { month, year } = await req.json()
  if (!month || !year) return NextResponse.json({ error: 'month and year are required.' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: resident } = await admin.from('residents').select('id').eq('portal_user_id', user.id).single()
  if (!resident) return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })

  const path = `payments/${resident.id}/${year}-${month}-${Date.now()}`
  const { data, error } = await admin.storage.from('resident-docs').createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: 'Could not prepare upload.' }, { status: 500 })

  return NextResponse.json({ path: data.path, uploadToken: data.token })
}
