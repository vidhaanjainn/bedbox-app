import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Server-only. Self-hosted browser push via VAPID — no third-party account or
// per-message cost, works on installed PWAs (Android Chrome + iOS 16.4+ Home
// Screen). Every send is non-fatal: a missing key or dead subscription never
// throws for the caller, it just skips/cleans up and moves on.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:thebedbox.in@gmail.com'

let configured = false
function ensureConfigured() {
  if (configured || !VAPID_PUBLIC || !VAPID_PRIVATE) return
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type PushPayload = { title: string; body: string; url?: string }
type Sub = { id: string; endpoint: string; p256dh: string; auth_key: string }

async function sendToSubscriptions(subs: Sub[], payload: PushPayload) {
  const supabase = adminClient()
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify(payload)
      )
    } catch (err: any) {
      // 404/410 = the browser subscription is gone (uninstalled, permission
      // revoked, etc.) — clean it up so we stop trying every time.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('push send failed:', err?.body || err?.message || err)
      }
    }
  }))
}

export async function sendPushToAdmins(payload: PushPayload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { skipped: true }
  ensureConfigured()
  const supabase = adminClient()
  const { data: admins } = await supabase.from('admins').select('user_id').eq('is_active', true)
  const userIds = (admins || []).map(a => a.user_id).filter(Boolean) as string[]
  if (!userIds.length) return { sent: 0 }
  const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth_key').in('user_id', userIds)
  if (!subs?.length) return { sent: 0 }
  await sendToSubscriptions(subs as Sub[], payload)
  return { sent: subs.length }
}

export async function sendPushToResident(residentId: string, payload: PushPayload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { skipped: true }
  ensureConfigured()
  const supabase = adminClient()
  const { data: resident } = await supabase.from('residents').select('portal_user_id').eq('id', residentId).maybeSingle()
  if (!resident?.portal_user_id) return { sent: 0 }
  const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth_key').eq('user_id', resident.portal_user_id)
  if (!subs?.length) return { sent: 0 }
  await sendToSubscriptions(subs as Sub[], payload)
  return { sent: subs.length }
}
