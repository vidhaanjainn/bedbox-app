'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Users, Plus, Search, Eye, Mail, Phone, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function ResidentsPage() {
  const [residents, setResidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const supabase = createClient()

  useEffect(() => { fetchResidents() }, [])

  const fetchResidents = async () => {
    setLoading(true)
    const { data } = await supabase.from('residents').select('*, bed:beds(bed_number, room:rooms(room_number, type))').order('created_at', { ascending: false })
    setResidents(data || [])
    setLoading(false)
  }

  const pendingApprovals = residents.filter(r => r.onboarding_status === 'submitted')

  const filtered = residents.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.mobile.includes(search) || r.room_number?.includes(search)
    if (statusFilter === 'submitted') return r.onboarding_status === 'submitted' && matchesSearch
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const counts: Record<string, number> = {
    all: residents.length,
    active: residents.filter(r => r.status === 'active').length,
    pending: residents.filter(r => r.status === 'pending').length,
    notice: residents.filter(r => r.status === 'notice').length,
    vacated: residents.filter(r => r.status === 'vacated').length,
    submitted: pendingApprovals.length,
  }

  return (
    <div style={{ padding: '32px' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>Residents</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>{counts.active} active · {counts.notice} on notice · {counts.pending} pending</p>
        </div>
        <Link href="/admin/residents/new" className="bb-btn-primary"><Plus size={16} />Add Resident</Link>
      </div>

      {/* Pending approvals banner */}
      {pendingApprovals.length > 0 && (
        <div style={{ padding: '14px 20px', borderRadius: '12px', marginBottom: '20px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={18} color="#34d399" />
            <div>
              <span style={{ color: '#34d399', fontWeight: '700', fontSize: '14px' }}>{pendingApprovals.length} resident{pendingApprovals.length > 1 ? 's' : ''} awaiting approval · </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{pendingApprovals.map(r => r.name).join(', ')}</span>
            </div>
          </div>
          <button onClick={() => setStatusFilter('submitted')} className="bb-btn-secondary" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Review →</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input className="bb-input" style={{ paddingLeft: '38px' }} placeholder="Search by name, phone, room..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
          {(['all', 'active', 'pending', 'notice', 'vacated', 'submitted'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s', background: statusFilter === s ? 'var(--teal-500)' : 'transparent', color: statusFilter === s ? 'var(--navy-900)' : s === 'submitted' && counts.submitted > 0 ? '#34d399' : 'var(--text-muted)' }}>
              {s === 'submitted' ? `✓ Approvals` : s}{counts[s] > 0 ? ` (${counts[s]})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Users size={40} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{search ? 'No residents match your search' : 'No residents yet.'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="bb-table">
              <thead><tr><th>Resident</th><th>Room</th><th>Joined</th><th>Rent</th><th>Type</th><th>Portal</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ background: r.onboarding_status === 'submitted' ? 'rgba(52,211,153,0.02)' : undefined }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: 'var(--teal-500)', flexShrink: 0 }}>{r.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }}>{r.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{r.mobile}</div>
                        </div>
                      </div>
                    </td>
                    <td><div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>{r.room_number || '—'}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.bed?.room?.type || ''}</div></td>
                    <td style={{ fontSize: '13px' }}>{formatDate(r.date_of_joining)}</td>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(r.rent_amount)}<div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>/month</div></td>
                    <td><span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '999px', textTransform: 'capitalize', background: r.occupation === 'student' ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)', color: r.occupation === 'student' ? '#818cf8' : '#34d399' }}>{r.occupation || '—'}</span></td>
                    <td>
                      <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '999px', background: r.onboarding_status === 'active' ? 'rgba(52,211,153,0.1)' : r.onboarding_status === 'submitted' ? 'rgba(52,211,153,0.15)' : 'rgba(100,116,139,0.1)', color: r.onboarding_status === 'active' ? '#34d399' : r.onboarding_status === 'submitted' ? '#34d399' : '#94a3b8' }}>
                        {r.onboarding_status === 'active' ? '✓ Active' : r.onboarding_status === 'submitted' ? '⏳ Approve' : r.onboarding_status === 'pending' ? 'Sent' : 'Not sent'}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge" style={(() => { const c: Record<string, any> = { active: { background: 'rgba(52,211,153,0.1)', color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }, pending: { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)' }, notice: { background: 'rgba(249,115,22,0.1)', color: '#f97316', borderColor: 'rgba(249,115,22,0.3)' }, vacated: { background: 'rgba(100,116,139,0.1)', color: '#94a3b8', borderColor: 'rgba(100,116,139,0.3)' } }; return c[r.status] || {} })()}>{r.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Link href={`/admin/residents/${r.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-muted)', textDecoration: 'none' }}><Eye size={13} /></Link>
                        {r.email && <a href={`mailto:${r.email}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-muted)', textDecoration: 'none' }}><Mail size={13} /></a>}
                        <a href={`tel:${r.mobile}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-muted)', textDecoration: 'none' }}><Phone size={13} /></a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
