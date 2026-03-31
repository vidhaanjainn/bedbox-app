'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, getStatusColor, getDaysRemaining } from '@/lib/utils'
import {
  Bed, Users, TrendingUp, AlertCircle, Wrench,
  Clock, Zap, ChevronRight, ArrowUpRight, RefreshCw
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
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const [
        { data: beds },
        { data: residents },
        { data: notices },
        { data: maintenance },
        { data: rentPayments },
      ] = await Promise.all([
        supabase.from('beds').select('*, room:rooms(room_number)'),
        supabase.from('residents').select('*, bed:beds(bed_number, room:rooms(room_number))').eq('status', 'active').order('created_at', { ascending: false }).limit(5),
        supabase.from('notice_periods').select('*, resident:residents(name, room_number)').eq('status', 'active'),
        supabase.from('maintenance_requests').select('*, resident:residents(name)').in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(5),
        supabase.from('rent_payments').select('*, resident:residents(name, room_number)'),
      ])

      const totalBeds = beds?.length || 0
      const occupiedBeds = beds?.filter(b => b.status === 'occupied').length || 0
      const monthlyIncome = rentPayments?.filter(r => {
        const now = new Date()
        return r.status === 'paid'
      }).reduce((sum: number, r: any) => sum + r.amount_paid, 0) || 0
      const pendingRent = rentPayments?.reduce((sum: number, r: any) => sum + (r.total_amount - r.amount_paid), 0) || 0

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
        unpaidRent: rentPayments || [],
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDashboard() }, [])

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
              const daysLeft = getDaysRemaining(notice.last_day_per_agreement)
              return (
                <div key={notice.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px', borderRadius: '10px',
                  background: 'var(--surface-2)', marginBottom: '8px'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {notice.resident?.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Room {notice.resident?.room_number} · Noticed {formatDate(notice.notice_date)}
                    </div>
                  </div>
                  <div style={{
                    textAlign: 'right',
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
          ) : (
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
                    <td style={{ color: payment.late_fee > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                      {payment.late_fee > 0 ? formatCurrency(payment.late_fee) : '—'}
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
          )}
        </div>
      </div>
    </div>
  )
}
