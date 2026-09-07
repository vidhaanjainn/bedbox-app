'use client'

// `beforeinstallprompt` fires once, as soon as the browser decides the
// current page is installable - it does NOT refire on a client-side route
// change (Next.js Link navigation) within the same document lifecycle.
// A component that only starts listening once it mounts (e.g. InstallPrompt
// rendered inside /portal's layout) can easily mount *after* the event
// already fired on an earlier page in the same session (e.g. the landing
// page) and miss it entirely. This module is imported once from the root
// layout - the very first thing on every page - so the listener attaches
// before anything else has a chance to, and any component can ask for the
// captured event later regardless of when it mounts.

type BIPEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> }

let captured: BIPEvent | null = null
const listeners = new Set<(e: BIPEvent) => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    captured = e as BIPEvent
    listeners.forEach((fn) => fn(captured!))
  })
}

export function getCapturedInstallPrompt() {
  return captured
}

export function onInstallPromptCaptured(fn: (e: BIPEvent) => void) {
  listeners.add(fn)
  if (captured) fn(captured)
  return () => { listeners.delete(fn) }
}

export function clearCapturedInstallPrompt() {
  captured = null
}
