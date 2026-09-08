'use client'

import { useEffect, useState } from 'react'
import { onInstallPromptCaptured, clearCapturedInstallPrompt } from '@/lib/pwaInstall'

// Shared by InstallGuideSheet and the post-approval welcome walkthrough, so
// browser/OS detection and the native-install handshake exist in exactly
// one place instead of being copy-pasted between "install from a banner"
// and "install as part of first-run setup."

export type InstallPlatform =
  | 'checking' | 'installed' | 'chromium'
  | 'ios-safari' | 'ios-chrome' | 'ios-firefox' | 'ios-edge' | 'ios-other'
  | 'android-other' | 'desktop'

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent)
}
export function isStandaloneDisplay(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

// Every iOS browser reports "iPhone/iPad" and even carries a legacy
// "Safari/..." token for compatibility, so plain Safari can only be told
// apart by the ABSENCE of every other browser's own token - checked first.
function detectIOSBrowser(): 'safari' | 'chrome' | 'firefox' | 'edge' | 'other' {
  const ua = navigator.userAgent
  if (/CriOS/i.test(ua)) return 'chrome'
  if (/FxiOS/i.test(ua)) return 'firefox'
  if (/EdgiOS/i.test(ua)) return 'edge'
  if (/OPiOS|UCBrowser/i.test(ua)) return 'other'
  return 'safari'
}

export function androidBrowserName(): string {
  const ua = navigator.userAgent
  if (/firefox/i.test(ua)) return 'Firefox'
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet'
  if (/edga/i.test(ua)) return 'Edge'
  if (/opr\//i.test(ua)) return 'Opera'
  return 'your browser'
}

function detectFallbackPlatform(): InstallPlatform {
  if (isIOS()) {
    const b = detectIOSBrowser()
    if (b === 'chrome') return 'ios-chrome'
    if (b === 'firefox') return 'ios-firefox'
    if (b === 'edge') return 'ios-edge'
    if (b === 'other') return 'ios-other'
    return 'ios-safari'
  }
  if (isAndroid()) return 'android-other'
  return 'desktop'
}

export function useInstallPlatform(active: boolean) {
  const [platform, setPlatform] = useState<InstallPlatform>('checking')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (!active) return
    if (isStandaloneDisplay()) { setPlatform('installed'); return }

    const unsub = onInstallPromptCaptured((e) => {
      setDeferredPrompt(e)
      setPlatform('chromium')
    })
    const timer = setTimeout(() => {
      setPlatform((p) => (p === 'checking' ? detectFallbackPlatform() : p))
    }, 400)

    return () => { unsub(); clearTimeout(timer) }
  }, [active])

  const triggerNativeInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable'
    deferredPrompt.prompt()
    try {
      const choice = await deferredPrompt.userChoice
      clearCapturedInstallPrompt()
      setDeferredPrompt(null)
      if (choice.outcome === 'accepted') { setPlatform('installed'); return 'accepted' }
      return 'dismissed'
    } catch {
      return 'dismissed'
    }
  }

  return { platform, triggerNativeInstall }
}
