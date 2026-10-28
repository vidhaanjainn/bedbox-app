import { createBrowserClient } from '@supabase/ssr'
import { resilientFetch } from './net'

// Every browser-side call goes through resilientFetch (timeouts + automatic
// fallback route + UI signalling) - see lib/supabase/net.ts.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: resilientFetch } }
  )
}
