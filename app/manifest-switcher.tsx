'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// "Add to Home Screen" on iOS/Android reads whichever <link rel="manifest"> is
// in the DOM right now — there's no way to have two manifests active at once,
// so this swaps it based on the current section. Add to Home Screen from
// /login or any /admin/* page → installs an "Admin" icon (opens straight to
// /login). Add to Home Screen from /portal or its login → installs the
// resident portal icon (opens straight to /portal), same as before.
//
// iOS Safari specifically uses <link rel="apple-touch-icon">, NOT the
// manifest's icons array, when adding to home screen — so that has to be
// swapped too or the admin install would still show the resident icon.
function setLink(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href)
}

function setMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }
  if (meta.getAttribute('content') !== content) meta.setAttribute('content', content)
}

export default function ManifestSwitcher() {
  const pathname = usePathname()

  useEffect(() => {
    const isAdminArea = pathname === '/login' || pathname.startsWith('/admin')
    setLink('manifest', isAdminArea ? '/manifest-admin.json' : '/manifest.json')
    setLink('apple-touch-icon', isAdminArea ? '/icons/icon-admin-192.png' : '/icons/icon-192.png')
    setMeta('apple-mobile-web-app-title', isAdminArea ? 'BedBox Admin' : 'BedBox')
  }, [pathname])

  return null
}
