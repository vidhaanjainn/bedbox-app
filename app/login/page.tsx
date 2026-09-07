import type { Metadata } from 'next'
import LoginPageClient from './LoginPageClient'

// See app/admin/layout.tsx for why this has to be a Server Component export
// rather than the previous client-side ManifestSwitcher approach.
export const metadata: Metadata = {
  title: 'TheBedBox Admin Console',
  manifest: '/manifest-admin.json',
  icons: { apple: '/icons/icon-admin-192.png' },
  appleWebApp: { title: 'BedBox Admin' },
}

export default function LoginPage() {
  return <LoginPageClient />
}
