import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Invite a new admin. Only callable by an existing active admin (checked server-side —
// this is the ONLY way to add a row to `admins` now that its open RLS policies are closed).
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: callerAdmin } = await admin.from('admins').select('id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!callerAdmin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const body = await req.json()
  const email = (body.email || '').trim().toLowerCase()
  const name = (body.name || '').trim().slice(0, 100)
  const phone = (body.phone || '').trim().slice(0, 20)
  const role = body.role === 'super_admin' ? 'super_admin' : 'staff'

  if (!email || !email.includes('@')) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  const { data: existing } = await admin.from('admins').select('id').eq('email', email).maybeSingle()
  if (existing) return NextResponse.json({ error: 'This email is already an admin.' }, { status: 400 })

  // Invite via Supabase Auth — sends a real email with a set-password link.
  let userId: string | undefined
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email)
  if (inviteError) {
    if (inviteError.message?.toLowerCase().includes('already been registered') || inviteError.message?.toLowerCase().includes('already exists')) {
      const { data: listData } = await admin.auth.admin.listUsers()
      const found = listData?.users?.find(u => u.email === email)
      if (!found) return NextResponse.json({ error: inviteError.message }, { status: 400 })
      userId = found.id
    } else {
      console.error('inviteUserByEmail failed:', inviteError)
      return NextResponse.json({ error: inviteError.message || 'Could not send invite.' }, { status: 500 })
    }
  } else {
    userId = inviteData.user?.id
  }
  if (!userId) return NextResponse.json({ error: 'Could not resolve user id for invite.' }, { status: 500 })

  const { error: insertError } = await admin.from('admins').insert({
    user_id: userId,
    name,
    email,
    phone: phone || null,
    role,
    permissions: {
      view_financials: role === 'super_admin',
      delete_residents: role === 'super_admin',
      manage_rooms: true,
      log_payments: true,
      manage_maintenance: true,
    },
    is_active: true,
  })

  if (insertError) {
    console.error('admin insert failed:', insertError)
    return NextResponse.json({ error: 'Invite sent, but could not create admin record. Contact support.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// List current admins (for the Settings page). Deactivate is a separate PATCH.
export async function GET() {
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

  const { data: admins } = await admin.from('admins').select('id, name, email, phone, role, is_active, created_at').order('created_at')
  return NextResponse.json({ admins: admins || [] })
}

// PATCH /api/admin/invite — { id, is_active } to deactivate/reactivate an admin
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: callerAdmin } = await admin.from('admins').select('id, user_id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!callerAdmin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { id, is_active } = await req.json()
  if (!id || typeof is_active !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  if (id === callerAdmin.id && !is_active) return NextResponse.json({ error: "You can't deactivate your own account." }, { status: 400 })

  const { error } = await admin.from('admins').update({ is_active }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
