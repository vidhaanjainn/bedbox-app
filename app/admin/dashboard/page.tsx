'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, getStatusColor, getNoticeDaysRemaining } from '@/lib/utils'
import { useIsMobile } from '@/lib/useIsMobile'
import Link from 'next/link'
import {
  Bed, Users, TrendingUp, AlertCircle, Wrench,
  Clock, Zap, ChevronRight, ArrowUpRight, RefreshCw, UserCheck
} from 'lucide-react'

interface DashboardData {
  totalBeds: number
  occupiedBeds: number
  availableBeds: number
  occupancyRate: number
  monthlyIncome: number
  pendingRent: number
  activeNotices: number
  openMaintenance: number
  recentResidents: any[]
  activeNoticesList: any[]
  openMaintenanceList: any[]
  unpaidRent: any[]
  pendingApprovals: any[]
  pendingSettlements: any[]
  missingDeposits: any[]
  prorataReviews: any[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()
  const isMobile = useIsMobile()

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const [
        { data: beds },
        { data: residents },
        { data: notices },
        { data: maintenance },
        { data: rentPayments },
        { data: pendingApprovals },
        { data: pendingSettlements },
        { data: missingDeposits },
        { data: prorataReviews },
      ] = await Promise.all([
        supabase.from('beds').select('*, room:rooms(room_number)'),
        supabase.from('residents').select('*, bed:beds(bed_number, room:rooms(room_number))').eq('status', 'active').order('created_at', { ascending: false }).limit(5),
        supabase.from('notice_periods').select('*, resident:residents(name, room_number)').eq('status', 'active'),
        supabase.from('maintenance_requests').select('*, resident:residents(name)').in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(5),
        supabase.from('rent_payments').select('*, resident:residents(name, room_number, is_test_account, status)'),
        supabase.from('residents').select('id, name, room_number, agreement_signed_at').eq('onboarding_status', 'submitted').order('agreement_signed_at', { ascending: true }),
        // Every vacated resident who hasn't had their deposit settled yet -
        // this is the "close it out" step that used to have nowhere to
        // surface at all once the initial archive click was done, so it was
        // easy to just... forget about, indefinitely.
        supabase.from('residents').select('id, name, room_number, vacated_at, move_out_ready_notified_at').eq('status', 'vacated').is('security_deposit_refund_at', null).order('vacated_at', { ascending: true }),
        // The other end of the same problem, at move-in instead of move-out -
        // an active resident with an actual agreed deposit that's never
        // been marked as received. This is exactly what let Dhanendra's
        // deposit go unrecorded: nothing ever asked, and nothing ever
        // surfaced that it hadn't been answered.
        supabase.from('residents').select('id, name, room_number, security_deposit').eq('status', 'active').gt('security_deposit', 0).is('security_deposit_received_at', null),
        // Residents who joined well into a month but paid a full month's
        // rent at signing (see lib/prorata.ts) - the credit is computed,
        // but never applied without an admin actually choosing to.
        supabase.from('residents').select('id, name, room_number, date_of_joining, prorata_unused_days, prorata_credit_amount').eq('status', 'active').eq('prorata_status', 'pending_review').order('date_of_joining', { ascending: true }),
      ])

      const totalBeds = beds?.length || 0
      const occupiedBeds = beds?.filter(b => b.status === 'occupied').length || 0

      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()

      // The review/test resident account should never skew real financial
      // totals - excluded from every rent-derived number on this page. A
      // vacated resident's stale unpaid row is excluded too: their balance
      // is a final-dues figure the move-out settlement flow owns, not
      // something that should keep counting as "outstanding rent to chase"
      // or showing up in the Rent Due list indefinitely after they've left.
      const realRentPayments = (rentPayments || []).filter((r: any) => !r.resident?.is_test_account && r.resident?.status !== 'vacated')

      // "Monthly Income Collected" means this month, not every payment ever
      // made - the previous version summed every 'paid' row across all of
      // history, which happened to still include this month's collections
      // (so it never looked obviously wrong) but wasn't actually what the
      // label said. Counts partial payments too - money received this
      // month is money received this month, whether or not the invoice is
      // fully settled yet.
      const monthlyIncome = realRentPayments
        .filter((r: any) => r.month === currentMonth && r.year === currentYear)
        .reduce((sum: number, r: any) => sum + Number(r.amount_paid || 0), 0)

      // Only rows with an actual outstanding balance count as "pending" -
      // the raw rentPayments array includes fully-paid rows too, which
      // contribute ₹0 to the total (so the amount looked right) but were
      // still being counted (so "N pending" and the table below were wrong).
      const unpaidRent = realRentPayments
        .filter((r: any) => Number(r.total_amount) - Number(r.amount_paid || 0) > 0)
        .sort((a: any, b: any) => (Number(b.total_amount) - Number(b.amount_paid || 0)) - (Number(a.total_amount) - Number(a.amount_paid || 0)))
      const pendingRent = unpaidRent.reduce((sum: number, r: any) => sum + (Number(r.total_amount) - Number(r.amount_paid || 0)), 0)

      setData({
        totalBeds,
        occupiedBeds,
        availableBeds: totalBeds - occupiedBeds,
        occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        monthlyIncome,
        pendingRent,
        activeNotices: notices?.length || 0,
        openMaintenance: maintenance?.length || 0,
        recentResidents: residents || [],
        activeNoticesList: notices || [],
        openMaintenanceList: maintenance || [],
        unpaidRent,
        pendingApprovals: pendingApprovals || [],
        pendingSettlements: pendingSettlements || [],
        missingDeposits: missingDeposits || [],
        prorataReviews: prorataReviews || [],
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDashboard() }, [])

  const [decidingProrata, setDecidingProrata] = useState<string | null>(null)
  const decideProrata = async (residentId: string, action: 'apply' | 'decline') => {
    setDecidingProrata(residentId)
    try {
      const res = await fetch('/api/admin/prorata-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId, action }),
      })
      if (res.ok) await fetchDashboard()
      else { const d = await res.json(); alert(d.error || 'Could not save this decision.') }
    } catch {
      alert('Something went wrong. Please try again.')
    }
    setDecidingProrata(null)
  }

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} color="var(--teal-500)" style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{
            fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: '700',
            color: 'var(--text-primary)', margin: '0 0 6px'
          }}>
            {greeting}, Vidhaan 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            {formatDate(new Date().toISOString())} · TheBedBox, Bhopal
          </p>
        </div>
        <button onClick={fetchDashboard} className="bb-btn-secondary" style={{ gap: '8px' }}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Pending approvals - onboarded residents waiting on you, front and
          center since these are time-sensitive (a resident with no portal
          access yet) rather than something to notice buried in a list. */}
      {data!.pendingApprovals.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
          padding: '16px 20px', borderRadius: '14px', marginBottom: '24px',
          background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserCheck size={20} color="#34d399" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#34d399' }}>
                {data!.pendingApprovals.length} resident{data!.pendingApprovals.length > 1 ? 's' : ''} waiting on your approval
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {data!.pendingApprovals.slice(0, 3).map((r: any) => r.name).join(', ')}{data!.pendingApprovals.length > 3 ? ` +${data!.pendingApprovals.length - 3} more` : ''}
              </div>
            </div>
          </div>
          <Link href={`/admin/residents/${data!.pendingApprovals[0].id}`} className="bb-btn-primary" style={{ fontSize: '13px' }}>
            Review Now <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Pending settlements - a vacated resident with no deposit refund
          recorded yet. This used to have nowhere to surface once the
          initial "mark vacated" click was done - now it stays visible here
          until someone actually closes it out. */}
      {data!.pendingSettlements.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
          padding: '16px 20px', borderRadius: '14px', marginBottom: '24px',
          background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} color="#fbbf24" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#fbbf24' }}>
                {data!.pendingSettlements.length} vacated resident{data!.pendingSettlements.length > 1 ? 's' : ''} awaiting deposit settlement
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {data!.pendingSettlements.slice(0, 3).map((r: any) => `${r.name}${r.move_out_ready_notified_at ? ' (ready)' : ''}`).join(', ')}{data!.pendingSettlements.length > 3 ? ` +${data!.pendingSettlements.length - 3} more` : ''}
              </div>
            </div>
          </div>
          <Link href={`/admin/residents/${data!.pendingSettlements[0].id}`} className="bb-btn-secondary" style={{ fontSize: '13px' }}>
            Settle Now <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* The move-in mirror of the settlement banner above - an active
          resident with a real agreed deposit that's never been marked
          received. Nothing used to ask about this at all, so it was
          entirely possible to onboard someone, collect their deposit in
          person, and have the system never know. */}
      {data!.missingDeposits.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
          padding: '16px 20px', borderRadius: '14px', marginBottom: '24px',
          background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} color="#a78bfa" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#a78bfa' }}>
                {data!.missingDeposits.length} resident{data!.missingDeposits.length > 1 ? 's' : ''} with no security deposit recorded
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {data!.missingDeposits.slice(0, 3).map((r: any) => r.name).join(', ')}{data!.missingDeposits.length > 3 ? ` +${data!.missingDeposits.length - 3} more` : ''}
              </div>
            </div>
          </div>
          <Link href={`/admin/residents/${data!.missingDeposits[0].id}`} className="bb-btn-secondary" style={{ fontSize: '13px' }}>
            Review <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* A resident who joined well into a month but paid a full month's
          rent at signing has overpaid for the days before they moved in -
          that credit is computed but deliberately never auto-applied.
          Someone joining a couple of days in isn't worth this at all
          (lib/prorata.ts skips them entirely); past that, it's a genuine
          judgment call this banner exists to make once, not something the
          system should silently decide either way. */}
      {data!.prorataReviews.length > 0 && (
        <div style={{ padding: '16px 20px', borderRadius: '14px', marginBottom: '24px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <AlertCircle size={20} color="#38bdf8" />
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8' }}>
              {data!.prorataReviews.length} resident{data!.prorataReviews.length > 1 ? 's' : ''} joined mid-month - pro-rata decision needed
            </div>
          </div>
          {data!.prorataReviews.map((r: any) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '10px 0', borderTop: '1px solid rgba(56,189,248,0.15)' }}>
              <div>
                <Link href={`/admin/residents/${r.id}`} style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '13px', textDecoration: 'none' }}>{r.name}</Link>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Joined {formatDate(r.date_of_joining)} · {r.prorata_unused_days} unused day{r.prorata_unused_days === 1 ? '' : 's'} · credit {formatCurrency(r.prorata_credit_amount)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => decideProrata(r.id, 'apply')} disabled={decidingProrata === r.id} className="bb-btn-primary" style={{ fontSize: '12px' }}>
                  Apply {formatCurrency(r.prorata_credit_amount)} Credit
                </button>
                <button onClick={() => decideProrata(r.id, 'decline')} disabled={decidingProrata === r.id} className="bb-btn-secondary" style={{ fontSize: '12px' }}>
                  Charge Full Month
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        {/* Occupancy */}
        <div className="stat-card" onClick={() => router.push('/admin/rooms')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'rgba(0,212,200,0.1)', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Bed size={18} color="var(--teal-500)" />
            </div>
            <span style={{
              fontSize: '11px', fontWeight: '700',
              color: data!.occupancyRate >= 80 ? '#34d399' : data!.occupancyRate >= 60 ? '#fbbf24' : '#f87171',
              background: data!.occupancyRate >= 80 ? 'rgba(52,211,153,0.1)' : data!.occupancyRate >= 60 ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)',
              padding: '3px 8px', borderRadius: '999px'
            }}>
              {data!.occupancyRate}% full
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
            {data!.occupiedBeds}<span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: '400' }}>/{data!.totalBeds}</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Beds Occupied</div>
          <div className="bb-progress" style={{ marginTop: '12px' }}>
            <div className="bb-progress-bar" style={{ width: `${data!.occupancyRate}%` }} />
          </div>
        </div>

        {/* Monthly Income */}
        <div className="stat-card" onClick={() => router.push('/admin/rent')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'rgba(52,211,153,0.1)', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <TrendingUp size={18} color="#34d399" />
            </div>
            <ArrowUpRight size={16} color="#34d399" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
            {formatCurrency(data!.monthlyIncome)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Monthly Income Collected</div>
        </div>

        {/* Pending Rent */}
        <div className="stat-card" onClick={() => router.push('/admin/rent')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'rgba(251,191,36,0.1)', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <AlertCircle size={18} color="#fbbf24" />
            </div>
            {data!.pendingRent > 0 && (
              <span style={{
                fontSize: '11px', fontWeight: '700', color: '#fbbf24',
                background: 'rgba(251,191,36,0.1)', padding: '3px 8px', borderRadius: '999px'
              }}>
                {data!.unpaidRent.length} pending
              </span>
            )}
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: data!.pendingRent > 0 ? '#fbbf24' : 'var(--text-primary)', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
            {formatCurrency(data!.pendingRent)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Rent Outstanding</div>
        </div>

        {/* Active Notices */}
        <div className="stat-card" onClick={() => router.push('/admin/notices')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'rgba(249,115,22,0.1)', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Clock size={18} color="#f97316" />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
            {data!.activeNotices}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Active Notice Periods</div>
        </div>

        {/* Maintenance */}
        <div className="stat-card" onClick={() => router.push('/admin/maintenance')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'rgba(139,92,246,0.1)', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Wrench size={18} color="#a78bfa" />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
            {data!.openMaintenance}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Open Maintenance Tasks</div>
        </div>

        {/* Available Beds */}
        <div className="stat-card" onClick={() => router.push('/admin/rooms')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'rgba(0,212,200,0.1)', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Bed size={18} color="var(--teal-500)" />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--teal-500)', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
            {data!.availableBeds}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Beds Available</div>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="bb-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Active Notices */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              Notice Periods
            </h3>
            <a href="/admin/notices" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--teal-500)', textDecoration: 'none' }}>
              View all <ChevronRight size={12} />
            </a>
          </div>
          {data!.activeNoticesList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '14px' }}>
              No active notice periods 🎉
            </div>
          ) : (
            data!.activeNoticesList.map((notice: any) => {
              const daysLeft = getNoticeDaysRemaining(notice) ?? 0
              return (
                <div key={notice.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px', borderRadius: '10px',
                  background: 'var(--surface-2)', marginBottom: '8px'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {notice.resident?.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Room {notice.resident?.room_number} · Noticed {formatDate(notice.notice_date)}
                    </div>
                  </div>
                  <div style={{
                    textAlign: 'right', flexShrink: 0, marginLeft: '10px',
                    background: daysLeft <= 14 ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.1)',
                    border: `1px solid ${daysLeft <= 14 ? 'rgba(239,68,68,0.3)' : 'rgba(249,115,22,0.3)'}`,
                    borderRadius: '8px', padding: '6px 10px'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: daysLeft <= 14 ? '#f87171' : '#f97316', fontFamily: 'Syne, sans-serif' }}>
                      {daysLeft}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>days left</div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Open Maintenance */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              Maintenance Tasks
            </h3>
            <a href="/admin/maintenance" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--teal-500)', textDecoration: 'none' }}>
              View all <ChevronRight size={12} />
            </a>
          </div>
          {data!.openMaintenanceList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '14px' }}>
              No open maintenance tasks 🎉
            </div>
          ) : (
            data!.openMaintenanceList.map((task: any) => (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', borderRadius: '10px',
                background: 'var(--surface-2)', marginBottom: '8px'
              }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: task.priority === 'urgent' ? '#f87171' : task.priority === 'high' ? '#f97316' : task.priority === 'medium' ? '#fbbf24' : '#64748b'
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {task.resident?.name || 'Admin'} · {task.category}
                  </div>
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: '700', padding: '3px 8px',
                  borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.06em',
                  background: task.status === 'in_progress' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                  color: task.status === 'in_progress' ? '#60a5fa' : '#f87171',
                  border: `1px solid ${task.status === 'in_progress' ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'}`
                }}>
                  {task.status === 'in_progress' ? 'In Progress' : 'Open'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Pending Rent */}
        <div className="glass-card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              Rent Due
            </h3>
            <a href="/admin/rent" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--teal-500)', textDecoration: 'none' }}>
              View all <ChevronRight size={12} />
            </a>
          </div>
          {data!.unpaidRent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '14px' }}>
              All rents collected 🎉
            </div>
          ) : isMobile ? (
            <div>
              {data!.unpaidRent.slice(0, 8).map((payment: any) => (
                <div key={payment.id} className="bb-row-card">
                  <div className="bb-row-card-top">
                    <div>
                      <div className="bb-row-card-title">{payment.resident?.name}</div>
                      <div className="bb-row-card-sub">
                        Room {payment.resident?.room_number} · {new Date(payment.year, payment.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <span className="status-badge" style={{
                      background: payment.status === 'partial' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
                      color: payment.status === 'partial' ? '#fbbf24' : '#f87171',
                      borderColor: payment.status === 'partial' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'
                    }}>
                      {payment.status}
                    </span>
                  </div>
                  <div className="bb-row-card-amount">
                    <span className="bb-row-card-amount-value">{formatCurrency(payment.total_amount - payment.amount_paid)}</span>
                    <span className="bb-row-card-amount-label">Due{payment.late_fee > 0 ? ` (incl. ${formatCurrency(payment.late_fee)} late fee)` : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Room</th>
                  <th>Month</th>
                  <th>Rent</th>
                  <th>Late Fee</th>
                  <th>Total Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data!.unpaidRent.slice(0, 8).map((payment: any) => (
                  <tr key={payment.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                      {payment.resident?.name}
                    </td>
                    <td>Room {payment.resident?.room_number}</td>
                    <td>{new Date(payment.year, payment.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                    <td>{formatCurrency(payment.rent_amount)}</td>
                    <td style={{ color: payment.late_fee > 0 ? (payment.late_fee_forgiven_at ? 'var(--text-muted)' : '#fbbf24') : 'var(--text-muted)' }}>
                      {payment.late_fee > 0 ? `${formatCurrency(payment.late_fee)}${payment.late_fee_forgiven_at ? ' (forgiven)' : ''}` : '-'}
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                      {formatCurrency(payment.total_amount - payment.amount_paid)}
                    </td>
                    <td>
                      <span className="status-badge" style={{
                        background: payment.status === 'partial' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
                        color: payment.status === 'partial' ? '#fbbf24' : '#f87171',
                        borderColor: payment.status === 'partial' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'
                      }}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
