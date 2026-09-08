import type { Metadata, Viewport } from 'next'
import PwaInstallCapture from '@/components/ui/PwaInstallCapture'
import { APP_URL } from '@/lib/config'
import './globals.css'

// Resident portal is the default manifest/icon for every route that doesn't
// override it (app/admin/layout.tsx and app/login/page.tsx set their own).
// Rendered server-side via the Metadata API so "Add to Home Screen" always
// sees the correct tags in the very first HTML response - no client-side
// swap, no timing race (see app/admin/layout.tsx for the full story).
//
// openGraph/twitter matter here specifically because residents are handed
// this exact domain's links constantly (portal login, onboarding invites)
// over WhatsApp - with nothing set, that preview fell back to whatever a
// chat app could scrape on its own (a bare black box), not a good first
// impression for "here's how you log into your account."
const TITLE = 'TheBedBox | Property Management'
const DESCRIPTION = 'Premium PG & Co-living Management System'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: '/manifest.json',
  icons: { apple: '/icons/icon-192.png' },
  appleWebApp: { title: 'BedBox', statusBarStyle: 'black-translucent' },
  openGraph: {
    type: 'website',
    siteName: 'TheBedBox',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
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
        <PwaInstallCapture />
        {children}
      </body>
    </html>
  )
}
