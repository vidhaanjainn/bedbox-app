'use client'

// Renders nothing - just guarantees lib/pwaInstall's module-level
// `beforeinstallprompt` listener attaches as early as possible on every
// page, by being mounted directly in the root layout. Also registers the
// service worker site-wide (previously duplicated separately inside the
// portal and admin layouts, which meant the public onboarding wizard -
// /onboard/[token] - had none at all: a resident could reach the "you're
// all done" screen, be offered the install button right there, and the
// browser would have nothing backing installability since the site's own
// install-eligibility criteria expects an active service worker). One
// registration, every route, including the ones with no layout of their
// own.
import { useEffect } from 'react'
import '@/lib/pwaInstall'

export default function PwaInstallCapture() {
  useEffect(() => {
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(() => {}) }
  }, [])
  return null
}
