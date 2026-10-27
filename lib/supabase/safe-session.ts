import type { Session, SupabaseClient } from '@supabase/supabase-js'

// getSession() can hang (stuck auth lock from another tab / suspended PWA) or
// throw (corrupted stored session). Callers gate their whole UI on it, so an
// unbounded wait is a permanent black screen. Resolve to null instead.
export async function getSessionSafe(supabase: SupabaseClient, timeoutMs = 6000): Promise<Session | null> {
  try {
    return await Promise.race([
      supabase.auth.getSession().then(({ data }) => data.session),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ])
  } catch {
    return null
  }
}

// Drop whatever Supabase auth state is stored in this browser so a broken
// session can't keep wedging the app; the user just signs in again.
export function clearStoredAuth() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
  } catch {}
  try {
    document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => n.startsWith('sb-'))
      .forEach(n => { document.cookie = `${n}=; Max-Age=0; path=/` })
  } catch {}
}
