'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, getDaysRemaining } from '@/lib/utils'
import { ArrowLeft, Phone, Mail, MapPin, Building, Calendar, Zap, CreditCard, Clock, Wrench, Edit, Shield, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function ResidentDetailPage() {
  const { id } = useParams()
  const [resident, setResident] = useState<any>(null)
  const [rentPayments, setRentPayments] = useState<any[]>([])
  const [electricityReadings, setElectricityReadings] = useState<any[]>([])
  const [maintenance, setMaintenance] = useState<any[]>([])
  const [notice, setNotice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [id])

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: res },
      { data: rent },
      { data: elec },
      { data: maint },
      { data: noticeData },
    ] = await Promise.all([
      supabase.from('residents').select('*, bed:beds(bed_number, room:rooms(room_number, type, floor))').eq('id', id).single(),
      supabase.from('rent_payments').select('*').eq('resident_id', id).order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('electricity_readings').select('*').eq('resident_id', id).order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('maintenance_requests').select('*').eq('resident_id', id).order('created_at', { ascending: false }),
      supabase.from('notice_periods').select('*').eq('resident_id', id).eq('status', 'active').maybeSingle(),
    ])
    setResident(res)
    setRentPayments(rent || [])
    setElectricityReadings(elec || [])
    setMaintenance(maint || [])
    setNotice(noticeData)
    setLoading(false)
  }

  const updateStatus = async (status: string) => {
    await supabase.from('residents').update({ status }).eq('id', id)
    setResident((r: any) => ({ ...r, status }))
  }

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
  )
  if (!resident) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Resident not found.</div>
  )

  const statusColors: Record<string, any> = {
    active: { bg: 'rgba(52,211,153,0.1)', color: '#34d399', border: 'rgba(52,211,153,0.3)' },
    pending: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
    notice: { bg: 'rgba(249,115,22,0.1)', color: '#f97316', border: 'rgba(249,115,22,0.3)' },
    vacated: { bg: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
  }
  const sc = statusColors[resident.status] || statusColors.active

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }} className="animate-fade-in">
      {/* Back */}
      <Link href="/admin/residents" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', marginBottom: '24px' }}>
        <ArrowLeft size={14} /> Back to Residents
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'rgba(0,212,200,0.1)', border: '2px solid rgba(0,212,200,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: '700', color: 'var(--teal-500)',
            fontFamily: 'Syne, sans-serif'
          }}>
            {resident.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>
              {resident.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span className="status-badge" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>
                {resident.status}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Room {resident.room_number} · Joined {formatDate(resident.date_of_joining)}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {resident.status !== 'vacated' && (
            <select
              className="bb-input"
              style={{ width: 'auto', fontSize: '12px' }}
              value={resident.status}
              onChange={e => updateStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="notice">On Notice</option>
              <option value="vacated">Vacated</option>
            </select>
          )}
          <Link href={`/admin/residents/${id}/edit`} className="bb-btn-secondary">
            <Edit size={14} /> Edit
          </Link>
        </div>
      </div>

      {/* Notice Alert */}
      {notice && (
        <div style={{
          padding: '16px 20px', borderRadius: '12px', marginBottom: '24px',
          background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <AlertTriangle size={18} color="#f97316" />
          <div style={{ flex: 1 }}>
            <span style={{ color: '#f97316', fontWeight: '600', fontSize: '14px' }}>
              Active Notice Period
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '8px' }}>
              Last day per agreement: {formatDate(notice.last_day_per_agreement)} ·{' '}
              <strong style={{ color: getDaysRemaining(notice.last_day_per_agreement) <= 14 ? '#f87171' : '#f97316' }}>
                {getDaysRemaining(notice.last_day_per_agreement)} days remaining
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Contact */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Contact
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <InfoRow icon={<Phone size={14} />} label="Mobile" value={resident.mobile} />
            <InfoRow icon={<Mail size={14} />} label="Email" value={resident.email || '—'} />
            <InfoRow icon={<MapPin size={14} />} label="Hometown" value={resident.hometown || '—'} />
            <InfoRow icon={<Building size={14} />} label="Institution" value={resident.institution || '—'} />
            <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Emergency Contact</div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{resident.emergency_contact_name || '—'}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{resident.emergency_contact_number || ''}</div>
            </div>
          </div>
        </div>

        {/* Stay */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Stay Details
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <InfoRow icon={<Building size={14} />} label="Room" value={`${resident.room_number || '—'} (${resident.bed?.room?.type || ''})`} />
            <InfoRow icon={<Calendar size={14} />} label="Joined" value={formatDate(resident.date_of_joining)} />
            <InfoRow icon={<Calendar size={14} />} label="Duration" value={resident.expected_duration || '—'} />
            <InfoRow icon={<CreditCard size={14} />} label="Monthly Rent" value={formatCurrency(resident.rent_amount)} highlight />
            <InfoRow icon={<Shield size={14} />} label="Security Deposit" value={formatCurrency(resident.security_deposit)} />
            <InfoRow icon={<Zap size={14} />} label="Initial Electricity" value={`${resident.initial_electricity_reading} units`} />
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Documents (Admin Only)
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <DocBadge label="Aadhaar Front" uploaded={!!resident.aadhaar_front_path} residentId={id as string} path={resident.aadhaar_front_path} />
          <DocBadge label="Aadhaar Back" uploaded={!!resident.aadhaar_back_path} residentId={id as string} path={resident.aadhaar_back_path} />
          <DocBadge label="T&C Agreed" uploaded={!!resident.tc_agreed_at} note={resident.tc_agreed_at ? formatDate(resident.tc_agreed_at) : undefined} />
          <DocBadge label="Agreement PDF" uploaded={!!resident.agreement_path} />
        </div>
      </div>

      {/* Rent History */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Rent History
        </h3>
        {rentPayments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No rent records yet.</p>
        ) : (
          <table className="bb-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Rent</th>
                <th>Electricity</th>
                <th>Late Fee</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rentPayments.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.year, p.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                  <td>{formatCurrency(p.rent_amount)}</td>
                  <td>{p.electricity_amount > 0 ? formatCurrency(p.electricity_amount) : '—'}</td>
                  <td style={{ color: p.late_fee > 0 ? '#fbbf24' : 'inherit' }}>
                    {p.late_fee > 0 ? formatCurrency(p.late_fee) : '—'}
                  </td>
                  <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(p.total_amount)}</td>
                  <td style={{ color: '#34d399' }}>{formatCurrency(p.amount_paid)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.payment_mode?.replace('_', ' ') || '—'}</td>
                  <td>
                    <span className="status-badge" style={{
                      background: p.status === 'paid' ? 'rgba(52,211,153,0.1)' : p.status === 'partial' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
                      color: p.status === 'paid' ? '#34d399' : p.status === 'partial' ? '#fbbf24' : '#f87171',
                      borderColor: p.status === 'paid' ? 'rgba(52,211,153,0.3)' : p.status === 'partial' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)',
                    }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Electricity */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Electricity Readings
        </h3>
        {electricityReadings.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No electricity readings yet.</p>
        ) : (
          <table className="bb-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Previous</th>
                <th>Current</th>
                <th>Units</th>
                <th>Bill</th>
                <th>Added to Rent</th>
              </tr>
            </thead>
            <tbody>
              {electricityReadings.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.year, r.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                  <td>{r.previous_reading}</td>
                  <td>{r.current_reading}</td>
                  <td style={{ color: 'var(--teal-500)', fontWeight: '600' }}>{r.units_consumed}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(r.bill_amount)}</td>
                  <td>
                    <span style={{
                      fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '999px',
                      background: r.added_to_rent ? 'rgba(52,211,153,0.1)' : 'rgba(100,116,139,0.1)',
                      color: r.added_to_rent ? '#34d399' : '#94a3b8',
                    }}>
                      {r.added_to_rent ? 'Yes' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Maintenance */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Maintenance Requests
        </h3>
        {maintenance.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No maintenance requests.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {maintenance.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '10px', background: 'var(--surface-2)'
              }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: m.priority === 'urgent' ? '#f87171' : m.priority === 'high' ? '#f97316' : m.priority === 'medium' ? '#fbbf24' : '#64748b'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{m.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.category} · {formatDate(m.created_at)}</div>
                </div>
                <span className="status-badge" style={{
                  background: m.status === 'resolved' ? 'rgba(52,211,153,0.1)' : m.status === 'in_progress' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                  color: m.status === 'resolved' ? '#34d399' : m.status === 'in_progress' ? '#60a5fa' : '#f87171',
                  borderColor: m.status === 'resolved' ? 'rgba(52,211,153,0.3)' : m.status === 'in_progress' ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)',
                }}>
                  {m.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, highlight }: { icon: React.ReactNode, label: string, value: string, highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: '14px', fontWeight: highlight ? '700' : '500', color: highlight ? 'var(--teal-500)' : 'var(--text-primary)' }}>
          {value}
        </span>
      </div>
    </div>
  )
}

function DocBadge({ label, uploaded, note, residentId, path }: { label: string, uploaded: boolean, note?: string, residentId?: string, path?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 14px', borderRadius: '8px',
      background: uploaded ? 'rgba(52,211,153,0.08)' : 'var(--surface-2)',
      border: `1px solid ${uploaded ? 'rgba(52,211,153,0.25)' : 'var(--border)'}`,
    }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: uploaded ? '#34d399' : 'var(--text-muted)'
      }} />
      <span style={{ fontSize: '12px', color: uploaded ? '#34d399' : 'var(--text-muted)', fontWeight: '500' }}>
        {label}
      </span>
      {note && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({note})</span>}
    </div>
  )
}
