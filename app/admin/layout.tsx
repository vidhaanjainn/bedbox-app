'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, BookOpen, Hotel, Bed,
  CreditCard, Zap, Bell, Wrench, BarChart3,
  Settings, LogOut, Menu, X, Building2, ChevronRight
} from 'lucide-react'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/residents', label: 'Residents', icon: Users },
  { href: '/admin/bookings', label: 'Bookings', icon: BookOpen },
  { href: '/admin/short-stays', label: 'Short Stays', icon: Hotel },
  { href: '/admin/rooms', label: 'Rooms & Beds', icon: Bed },
  { href: '/admin/rent', label: 'Rent Tracker', icon: CreditCard },
  { href: '/admin/electricity', label: 'Electricity', icon: Zap },
  { href: '/admin/notices', label: 'Notice Periods', icon: Bell },
  { href: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--navy-900)' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 40, display: 'block'
          }}
          className="lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside style={{
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
          {sidebarOpen && (
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
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 8px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`}
                style={{
                  marginBottom: '2px',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  padding: sidebarOpen ? '10px 14px' : '10px',
                  position: 'relative'
                }}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {sidebarOpen && (
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
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              padding: sidebarOpen ? '10px 14px' : '10px',
              background: 'none', border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
