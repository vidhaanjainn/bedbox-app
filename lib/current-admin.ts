import { SupabaseClient } from '@supabase/supabase-js'

export type CurrentAdmin = { id: string; name: string; email: string | null }

// Resolves the signed-in admin's own `admins` row - used to stamp who did what
// (collected a payment, onboarded a resident) when multiple admins share the console.
export async function getCurrentAdmin(supabase: SupabaseClient): Promise<CurrentAdmin | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('admins')
    .select('id, name, email')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  return data
}
