'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// "Add to Home Screen" on iOS/Android reads whichever <link rel="manifest"> is
// in the DOM right now — there's no way to have two manifests active at once,
// so this swaps it based on the current section. Add to Home Screen from
// /login or any /admin/* page → installs an "Admin" icon (opens straight to
// /login). Add to Home Screen from /portal or its login → installs the
// resident portal icon (opens straight to /portal), same as before.
export default function ManifestSwitcher() {
  const pathname = usePathname()

  useEffect(() => {
    const isAdminArea = pathname === '/login' || pathname.startsWith('/admin')
    const href = isAdminArea ? '/manifest-admin.json' : '/manifest.json'
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'manifest'
      document.head.appendChild(link)
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href)
  }, [pathname])

  return null
}
