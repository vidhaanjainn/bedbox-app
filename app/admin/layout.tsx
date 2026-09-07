import type { Metadata } from 'next'
import AdminLayoutClient from './AdminLayoutClient'

// This must live in a Server Component - the interactive shell (sidebar,
// session check, etc.) is a Client Component and can't export metadata
// itself. Rendering the manifest/icon links server-side, in the very first
// HTML response, is the actual fix for "Add to Home Screen opens the wrong
// app": the previous approach swapped these tags via a client-side
// useEffect (ManifestSwitcher), which only ran after hydration - "Add to
// Home Screen" reads whatever the initial page load already had, so it
// could grab the default resident manifest before that effect ever fired.
export const metadata: Metadata = {
  title: 'TheBedBox Admin Console',
  manifest: '/manifest-admin.json',
  icons: { apple: '/icons/icon-admin-192.png' },
  appleWebApp: { title: 'BedBox Admin' },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
