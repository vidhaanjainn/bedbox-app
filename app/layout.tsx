import type { Metadata } from 'next'
import './globals.css'
import ManifestSwitcher from './manifest-switcher'

export const metadata: Metadata = {
  title: 'TheBedBox | Property Management',
  description: 'Premium PG & Co-living Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Default manifest for the very first paint; ManifestSwitcher below
            swaps it per-route before any "Add to Home Screen" tap can occur. */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00d4c8" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BedBox" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <ManifestSwitcher />
        {children}
      </body>
    </html>
  )
}
