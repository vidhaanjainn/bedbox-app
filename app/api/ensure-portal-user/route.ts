import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { mobile } = await request.json()

    if (!mobile) {
      return NextResponse.json({ error: 'Mobile number is required.' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      // Fallback: if service role key not configured, just look up email
      // OTP will work for residents already in auth.users
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: resident, error } = await supabase
        .from('residents')
        .select('email, onboarding_status')
        .eq('mobile', mobile)
        .single()

      if (error || !resident) {
        return NextResponse.json({ error: 'No resident found with this mobile. Contact TheBedBox.' }, { status: 404 })
      }
      if (resident.onboarding_status !== 'active') {
        return NextResponse.json({ error: 'Your account is not yet active. Contact TheBedBox.' }, { status: 403 })
      }
      return NextResponse.json({ email: resident.email })
    }

    // Use service role key — bypasses RLS, can create auth users
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Look up resident by mobile
    const { data: resident, error: fetchError } = await supabaseAdmin
      .from('residents')
      .select('id, email, onboarding_status, portal_user_id')
      .eq('mobile', mobile)
      .single()

    if (fetchError || !resident) {
      return NextResponse.json({ error: 'No resident found with this mobile. Contact TheBedBox.' }, { status: 404 })
    }

    if (resident.onboarding_status !== 'active') {
      return NextResponse.json({ error: 'Your account is not yet active. Contact TheBedBox.' }, { status: 403 })
    }

    if (!resident.email) {
      return NextResponse.json({ error: 'No email on file for this resident. Contact TheBedBox.' }, { status: 400 })
    }

    // If portal_user_id is null, the resident has no auth.users entry — create one
    if (!resident.portal_user_id) {
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: resident.email,
        email_confirm: true, // skip email confirmation — we'll OTP them
      })

      if (createError) {
        // If user already exists in auth.users (but portal_user_id not linked), find them
        if (createError.message?.toLowerCase().includes('already been registered') ||
            createError.message?.toLowerCase().includes('already exists')) {
          // Fetch existing auth user by email
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
          const existingUser = listData?.users?.find(u => u.email === resident.email)
          if (existingUser) {
            await supabaseAdmin
              .from('residents')
              .update({ portal_user_id: existingUser.id })
              .eq('id', resident.id)
          }
        } else {
          console.error('Error creating auth user:', createError)
          // Non-fatal — OTP send may still work if user exists
        }
      } else if (authData?.user) {
        // Link the new auth user to the resident record
        await supabaseAdmin
          .from('residents')
          .update({ portal_user_id: authData.user.id })
          .eq('id', resident.id)
      }
    }

    return NextResponse.json({ email: resident.email })
  } catch (err) {
    console.error('ensure-portal-user error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
