import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Any signed-in user (admin or resident — both are Supabase Auth users) can
// register their own browser for push. RLS on push_subscriptions restricts
// each row to its own user_id regardless, this just resolves who "own" is.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { endpoint, keys } = await req.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription.' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth_key: keys.auth,
  }, { onConflict: 'endpoint' })

  if (error) return NextResponse.json({ error: 'Could not save subscription.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
