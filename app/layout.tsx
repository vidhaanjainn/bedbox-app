import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
