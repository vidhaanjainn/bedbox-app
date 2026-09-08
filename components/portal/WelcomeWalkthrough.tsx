'use client'

import { useEffect, useState } from 'react'
import { Bell, Receipt, Wrench, Zap, Check } from 'lucide-react'
import { useInstallPlatform } from '@/lib/useInstallPlatform'
import { InstallStepsBody, InstallCornerPointer, installCorner } from '@/components/ui/InstallStepsBody'
import { isPushSupported, getNotificationPermission, subscribeToPush } from '@/lib/push-client'

type Step = 'welcome' | 'install' | 'notifications' | 'done'

// One-time, right after a resident's very first login (see portal/home,
// gated on residents.onboarding_walkthrough_completed_at). Everything past
// this point - the install banner, the notification banner - only ever
// asks passively at the top of a page full of other things competing for
// attention; this is the one moment their attention is guaranteed and
// undivided, so it's the one place a real "get set up" push belongs.
// Every step has a visible skip - nothing here is a dead end, and nothing
// blocks them from just using the portal if they'd rather not bother.
export default function WelcomeWalkthrough({ residentName, onComplete }: { residentName: string; onComplete: (result: { installed: boolean; notificationsEnabled: boolean }) => void }) {
  const [step, setStep] = useState<Step>('welcome')
  const [installResult, setInstallResult] = useState<'installed' | 'skipped'>('skipped')
  const [notifResult, setNotifResult] = useState<'enabled' | 'skipped'>('skipped')
  const [enabling, setEnabling] = useState(false)
  const [notifError, setNotifError] = useState('')

  const installActive = step === 'install'
  const { platform, triggerNativeInstall } = useInstallPlatform(installActive)

  // Already installed (opened this very first login straight from the home
  // screen, or the admin's device happens to double as the resident's) -
  // nothing to ask, skip straight to notifications instead of showing a
  // pointless "you're already done" step.
  useEffect(() => {
    if (step === 'install' && platform === 'installed') {
      setInstallResult('installed')
      setStep('notifications')
    }
  }, [step, platform])

  const corner = step === 'install' ? installCorner(platform) : null

  const goInstallContinue = () => {
    setInstallResult(platform === 'installed' ? 'installed' : 'skipped')
    setStep('notifications')
  }

  const handleInstallClick = async () => {
    const outcome = await triggerNativeInstall()
    if (outcome === 'accepted') { setInstallResult('installed'); setStep('notifications') }
  }

  const handleEnableNotifications = async () => {
    setEnabling(true); setNotifError('')
    const result = await subscribeToPush()
    setEnabling(false)
    if (!result.ok) { setNotifError(result.error || 'Could not enable notifications.'); return }
    setNotifResult('enabled')
    setStep('done')
  }

  const skipNotifications = () => { setNotifResult('skipped'); setStep('done') }

  const finish = () => onComplete({ installed: installResult === 'installed', notificationsEnabled: notifResult === 'enabled' })

  const stepIndex = { welcome: 0, install: 1, notifications: 2, done: 3 }[step]

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: '380px', padding: '28px', textAlign: 'center', animation: 'fadeIn 0.25s ease' }}>
          {step !== 'welcome' && step !== 'done' && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 18 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ width: 24, height: 3, borderRadius: 2, background: i <= stepIndex - 1 ? '#00d4c8' : 'var(--surface-2)' }} />
              ))}
            </div>
          )}

          {step === 'welcome' && (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Welcome, {residentName.split(' ')[0]}!
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>
                Two quick things to get your portal set up right - takes about 30 seconds, and you can skip either one.
              </p>
              <button onClick={() => setStep('install')} className="bb-btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>
                Let's go
              </button>
              <button onClick={() => { setStep('done') }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                Skip, take me to my portal
              </button>
            </>
          )}

          {step === 'install' && (
            <>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                Add TheBedBox to your home screen
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
                One tap to open - your bills, notices, and complaints, without digging through a browser.
              </p>
              <InstallStepsBody platform={platform} onInstallClick={handleInstallClick} />
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button onClick={goInstallContinue} className="bb-btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                  {platform === 'chromium' ? 'Skip for now' : "I've done this - Continue"}
                </button>
              </div>
            </>
          )}

          {step === 'notifications' && (
            <>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(0,212,200,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Bell size={22} color="#00d4c8" />
              </div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                Turn on notifications
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
                Exactly three things, nothing else:
              </p>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <Receipt size={16} color="#00d4c8" style={{ flexShrink: 0 }} /> Rent due reminders, before late fees start
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <Zap size={16} color="#00d4c8" style={{ flexShrink: 0 }} /> A nudge to log your electricity reading
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <Wrench size={16} color="#00d4c8" style={{ flexShrink: 0 }} /> Updates on anything you report
                </div>
              </div>
              {!isPushSupported() ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Add the app to your home screen first (previous step) - notifications only work from the installed app on this browser.
                </div>
              ) : getNotificationPermission() === 'denied' ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Notifications are blocked for this site in your browser settings - you can turn them back on there anytime.
                </div>
              ) : notifError ? (
                <div style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 16 }}>{notifError}</div>
              ) : null}
              <div style={{ display: 'flex', gap: 8 }}>
                {isPushSupported() && getNotificationPermission() !== 'denied' && (
                  <button onClick={handleEnableNotifications} disabled={enabling} className="bb-btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                    {enabling ? 'Enabling...' : 'Enable'}
                  </button>
                )}
                <button onClick={skipNotifications} className="bb-btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                  Skip for now
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4c8,#0099ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Check size={22} color="#070d1a" strokeWidth={3} />
              </div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '19px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                You're all set
              </h2>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22, fontSize: 13, color: 'var(--text-secondary)' }}>
                <div>{installResult === 'installed' ? '✓' : '○'} App {installResult === 'installed' ? 'installed' : 'not installed yet'}</div>
                <div>{notifResult === 'enabled' ? '✓' : '○'} Notifications {notifResult === 'enabled' ? 'on' : 'off for now'}</div>
              </div>
              <button onClick={finish} className="bb-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Go to my portal
              </button>
            </>
          )}
        </div>
      </div>
      {corner && <InstallCornerPointer corner={corner} />}
    </>
  )
}
