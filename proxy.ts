import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16 renamed `middleware` to `proxy` (same mechanism, new name/file).
// This refreshes the Supabase session on every navigation via a real
// Set-Cookie response header, instead of relying solely on the browser
// client's own document.cookie writes. That matters a lot for the PWA on
// iOS: Safari's Intelligent Tracking Prevention aggressively caps the
// lifetime of cookies set via script (document.cookie), which is all a
// pure client component can do — cookies set by an actual server response
// aren't subject to that cap. Without this, a home-screen PWA that gets
// fully suspended/reopened by the OS was effectively getting logged out
// because its auth cookie had been silently expired by ITP, not because the
// underlying Supabase session (refresh token) was actually gone.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // Do not add logic between createServerClient and getUser() — this call
  // is what actually triggers the refresh-and-recookie side effect above.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Skip static assets, images, and the service worker/manifest — no
    // auth-cookie refresh needed for those, and it avoids extra latency on
    // every single asset request.
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.*\\.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
