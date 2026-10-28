'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSessionSafe } from '@/lib/supabase/safe-session'
import NotificationPrompt from '@/components/ui/NotificationPrompt'
import InstallPrompt from '@/components/ui/InstallPrompt'
import ConnectionBanner from '@/components/ui/ConnectionBanner'
import {
  LayoutDashboard, Users, BookOpen, Hotel, Bed,
  CreditCard, Zap, Bell, Wrench, BarChart3,
  Receipt, Settings, LogOut, Menu, X, Building2, ChevronRight, Wallet, Star
} from 'lucide-react'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/residents', label: 'Residents', icon: Users },
  { href: '/admin/bookings', label: 'Bookings', icon: BookOpen },
  { href: '/admin/short-stays', label: 'Short Stays', icon: Hotel },
  { href: '/admin/rooms', label: 'Rooms & Beds', icon: Bed },
  { href: '/admin/rent', label: 'Rent Tracker', icon: CreditCard },
  { href: '/admin/staff', label: 'Staff & Expenses', icon: Wallet },
  { href: '/admin/electricity', label: 'Electricity', icon: Zap },
  { href: '/admin/notices', label: 'Notice Periods', icon: Bell },
  { href: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/receipts', label: 'Receipts', icon: Receipt },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  // Signed in, but not as an admin (e.g. a resident-portal account autofilled
  // by the browser): the database then correctly shows an empty app. Say so
  // instead of leaving the user staring at zeros.
  const [notAdminEmail, setNotAdminEmail] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Below 900px the sidebar becomes an off-canvas drawer (see .admin-sidebar
  // in globals.css) instead of the desktop collapse-to-icons behavior, so
  // labels should always render inside it regardless of the desktop
  // sidebarOpen toggle's last state.
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const showLabels = isMobile ? true : sidebarOpen

  // Close the drawer automatically on navigation - otherwise it stays open
  // over the new page after tapping a nav link.
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Navigation guard: a sidebar tap normally swaps the page in well under a
  // second. If it hasn't happened after 4s (a stalled client-side route
  // fetch), force a normal full page load instead of leaving the user stuck.
  const navTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(navTimer.current), [pathname])
  const guardNav = (href: string) => {
    if (href === pathname) return
    clearTimeout(navTimer.current)
    navTimer.current = setTimeout(() => window.location.assign(href), 4000)
  }

  // No persisted session (e.g. never logged in on this device, or explicitly
  // logged out) - send to login instead of rendering an empty dashboard.
  useEffect(() => {
    getSessionSafe(supabase).then(session => {
      if (!session) { router.replace('/login'); return }
      setCheckingSession(false)
      // Only an explicit `false` blocks. A failed/slow check never locks an
      // admin out - the connection banner covers that case.
      supabase.rpc('is_admin').then(({ data, error }) => {
        if (!error && data === false) setNotAdminEmail(session.user.email ?? 'this account')
      })
    })
  }, [])

  // Service worker registration now happens once, site-wide, in
  // PwaInstallCapture (root layout) - no need to duplicate it here.

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (notAdminEmail) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--navy-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, color: 'var(--text-primary)', margin: '0 0 12px' }}>This isn&apos;t an admin account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 8px' }}>
            You&apos;re signed in as <strong style={{ color: 'var(--text-primary)' }}>{notAdminEmail}</strong>, which doesn&apos;t have admin access, so no residents or rent data can be shown.
            Your data is safe - sign out and sign in with your admin account.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 20px' }}>Tip: your browser may have auto-filled a different saved login.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleLogout} className="bb-btn-primary">Sign out and switch account</button>
            <Link href="/portal" className="bb-btn-secondary">Go to resident portal</Link>
          </div>
        </div>
      </div>
    )
  }

  if (checkingSession) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--navy-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--navy-900)' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 150, display: 'block'
          }}
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar${mobileOpen ? ' mobile-open' : ''}`} style={{
        width: sidebarOpen ? '240px' : '68px',
        minHeight: '100vh',
        background: 'var(--surface-1)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'hidden',
        flexShrink: 0,
        zIndex: 30
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minHeight: '70px'
        }}>
          <div style={{
            width: '36px', height: '36px', flexShrink: 0,
            background: 'rgba(0,212,200,0.1)',
            border: '1px solid rgba(0,212,200,0.2)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Building2 size={18} color="var(--teal-500)" />
          </div>
          {showLabels && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '15px', fontWeight: '700',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap'
              }}>TheBedBox</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Admin Panel
              </div>
            </div>
          )}
          {isMobile ? (
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              style={{
                marginLeft: 'auto', flexShrink: 0,
                background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-muted)',
                padding: '4px', borderRadius: '6px',
                display: 'flex', alignItems: 'center'
              }}
            >
              <X size={18} />
            </button>
          ) : (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                marginLeft: 'auto', flexShrink: 0,
                background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-muted)',
                padding: '4px', borderRadius: '6px',
                display: 'flex', alignItems: 'center'
              }}
            >
              <ChevronRight size={16} style={{
                transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s ease'
              }} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 8px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => guardNav(item.href)}
                style={{
                  marginBottom: '2px',
                  justifyContent: showLabels ? 'flex-start' : 'center',
                  padding: showLabels ? '10px 14px' : '10px',
                  position: 'relative'
                }}
                title={!showLabels ? item.label : undefined}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {showLabels && (
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{item.label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLogout}
            className="nav-item"
            style={{
              width: '100%',
              justifyContent: showLabels ? 'flex-start' : 'center',
              padding: showLabels ? '10px 14px' : '10px',
              background: 'none', border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {showLabels && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        <div className="admin-mobile-topbar" style={{
          position: 'sticky', top: 0, zIndex: 60,
          alignItems: 'center', gap: '12px',
          padding: '14px 16px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)',
        }}>
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', padding: '4px' }}>
            <Menu size={22} />
          </button>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>TheBedBox</span>
        </div>
        <ConnectionBanner />
        <div className="bb-page">
          <div style={{ padding: '20px 32px 0' }}>
            <InstallPrompt dark={false} />
            <NotificationPrompt dark={false} />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
