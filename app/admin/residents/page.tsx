'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import { Users, Plus, Search, Filter, Eye, Mail, Phone, ChevronDown } from 'lucide-react'
import Link from 'next/link'

export default function ResidentsPage() {
  const [residents, setResidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    fetchResidents()
  }, [])

  const fetchResidents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('residents')
      .select('*, bed:beds(bed_number, room:rooms(room_number, type))')
      .order('created_at', { ascending: false })
    setResidents(data || [])
    setLoading(false)
  }

  const filtered = residents.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.mobile.includes(search) ||
      r.room_number?.includes(search)
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusCounts = {
    all: residents.length,
    active: residents.filter(r => r.status === 'active').length,
    pending: residents.filter(r => r.status === 'pending').length,
    notice: residents.filter(r => r.status === 'notice').length,
    vacated: residents.filter(r => r.status === 'vacated').length,
  }

  return (
    <div style={{ padding: '32px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Residents
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            {statusCounts.active} active · {statusCounts.notice} on notice · {statusCounts.pending} pending onboarding
          </p>
        </div>
        <Link href="/admin/residents/new" className="bb-btn-primary">
          <Plus size={16} />
          Add Resident
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="bb-input"
            style={{ paddingLeft: '38px' }}
            placeholder="Search by name, phone, room..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
          {(['all', 'active', 'pending', 'notice', 'vacated'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
                background: statusFilter === s ? 'var(--teal-500)' : 'transparent',
                color: statusFilter === s ? 'var(--navy-900)' : 'var(--text-muted)',
              }}
            >
              {s} {statusCounts[s] > 0 ? `(${statusCounts[s]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading residents...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Users size={40} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              {search ? 'No residents match your search' : 'No residents yet. Add your first resident!'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Room</th>
                  <th>Joined</th>
                  <th>Rent</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(resident => (
                  <tr key={resident.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '10px',
                          background: 'var(--surface-3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px', fontWeight: '700', color: 'var(--teal-500)',
                          flexShrink: 0
                        }}>
                          {resident.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }}>
                            {resident.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{resident.mobile}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                        {resident.room_number || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {resident.bed?.room?.type || ''}
                      </div>
                    </td>
                    <td style={{ fontSize: '13px' }}>{formatDate(resident.date_of_joining)}</td>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {formatCurrency(resident.rent_amount)}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>/month</div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '11px', fontWeight: '600',
                        padding: '3px 8px', borderRadius: '999px',
                        textTransform: 'capitalize',
                        background: resident.occupation === 'student' ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)',
                        color: resident.occupation === 'student' ? '#818cf8' : '#34d399',
                      }}>
                        {resident.occupation}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge" style={(() => {
                        const colors: Record<string, any> = {
                          active: { background: 'rgba(52,211,153,0.1)', color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' },
                          pending: { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)' },
                          notice: { background: 'rgba(249,115,22,0.1)', color: '#f97316', borderColor: 'rgba(249,115,22,0.3)' },
                          vacated: { background: 'rgba(100,116,139,0.1)', color: '#94a3b8', borderColor: 'rgba(100,116,139,0.3)' },
                        }
                        return colors[resident.status] || {}
                      })()}>
                        {resident.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Link href={`/admin/residents/${resident.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '30px', height: '30px', borderRadius: '8px',
                            background: 'var(--surface-3)', border: '1px solid var(--border)',
                            color: 'var(--text-muted)', cursor: 'pointer',
                            textDecoration: 'none', transition: 'all 0.15s ease'
                          }}
                        >
                          <Eye size={13} />
                        </Link>
                        {resident.email && (
                          <a href={`mailto:${resident.email}`}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '30px', height: '30px', borderRadius: '8px',
                              background: 'var(--surface-3)', border: '1px solid var(--border)',
                              color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'none'
                            }}
                          >
                            <Mail size={13} />
                          </a>
                        )}
                        <a href={`tel:${resident.mobile}`}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '30px', height: '30px', borderRadius: '8px',
                            background: 'var(--surface-3)', border: '1px solid var(--border)',
                            color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'none'
                          }}
                        >
                          <Phone size={13} />
                        </a>
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
