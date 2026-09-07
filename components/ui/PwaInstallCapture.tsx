'use client'

// Renders nothing - just guarantees lib/pwaInstall's module-level
// `beforeinstallprompt` listener attaches as early as possible on every
// page, by being mounted directly in the root layout.
import '@/lib/pwaInstall'

export default function PwaInstallCapture() {
  return null
}
