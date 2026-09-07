import type { Metadata, Viewport } from 'next'
import './globals.css'

// Resident portal is the default manifest/icon for every route that doesn't
// override it (app/admin/layout.tsx and app/login/page.tsx set their own).
// Rendered server-side via the Metadata API so "Add to Home Screen" always
// sees the correct tags in the very first HTML response - no client-side
// swap, no timing race (see app/admin/layout.tsx for the full story).
export const metadata: Metadata = {
  title: 'TheBedBox | Property Management',
  description: 'Premium PG & Co-living Management System',
  manifest: '/manifest.json',
  icons: { apple: '/icons/icon-192.png' },
  appleWebApp: { title: 'BedBox', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  themeColor: '#00d4c8',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
