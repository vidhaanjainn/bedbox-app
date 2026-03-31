'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Wrench, Plus, X, Loader2, ChevronDown } from 'lucide-react'
import { MAINTENANCE_CATEGORIES } from '@/lib/utils'

export default function MaintenancePage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [residents, setResidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [form, setForm] = useState({
    title: '', description: '', category: 'plumbing', priority: 'medium',
    resident_id: '', assigned_to: '', submitted_by: 'admin'
  })
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [statusFilter])

  const fetchAll = async () => {
    setLoading(true)
    let query = supabase.from('maintenance_requests')
      .select('*, resident:residents(name, room_number)')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    setTasks(data || [])

    const { data: res } = await supabase.from('residents').select('id, name, room_number').eq('status', 'active')
    setResidents(res || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!form.title || !form.category) return
    setSaving(true)

    const { data: prop } = await supabase.from('properties').select('id').single()

    await supabase.from('maintenance_requests').insert({
      property_id: prop?.id,
      resident_id: form.resident_id || null,
      title: form.title,
      description: form.description || null,
      category: form.category,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      submitted_by: form.submitted_by,
      status: 'open',
    })

    setShowModal(false)
    setForm({ title: '', description: '', category: 'plumbing', priority: 'medium', resident_id: '', assigned_to: '', submitted_by: 'admin' })
    setSaving(false)
    fetchAll()
  }

  const updateStatus = async (id: string, status: string) => {
    const update: any = { status, updated_at: new Date().toISOString() }
    if (status === 'resolved') update.resolved_at = new Date().toISOString()
    await supabase.from('maintenance_requests').update(update).eq('id', id)
    fetchAll()
  }

  const counts = {
    all: tasks.length,
    open: tasks.filter(t => t.status === 'open').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    resolved: tasks.filter(t => t.status === 'resolved').length,
  }

  const priorityConfig: Record<string, { color: string, bg: string, label: string }> = {
    low: { color: '#94a3b8', bg: 'rgba(100,116,139,0.1)', label: 'Low' },
    medium: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', label: 'Medium' },
    high: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', label: 'High' },
    urgent: { color: '#f87171', bg: 'rgba(239,68,68,0.1)', label: 'Urgent' },
  }

  const statusConfig: Record<string, { color: string, bg: string, border: string }> = {
    open: { color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
    in_progress: { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
    resolved: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' },
    cancelled: { color: '#94a3b8', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)' },
  }

  return (
    <div style={{ padding: '32px' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Maintenance
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            {counts.open} open · {counts.in_progress} in progress · {counts.resolved} resolved
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="bb-btn-primary">
          <Plus size={16} /> Add Task
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px', width: 'fit-content', marginBottom: '24px' }}>
        {[['all', 'All'], ['open', 'Open'], ['in_progress', 'In Progress'], ['resolved', 'Resolved']].map(([s, l]) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '6px 14px', borderRadius: '7px', border: 'none', fontSize: '12px',
            fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
            background: statusFilter === s ? 'var(--teal-500)' : 'transparent',
            color: statusFilter === s ? 'var(--navy-900)' : 'var(--text-muted)',
          }}>{l} ({counts[s as keyof typeof counts] ?? tasks.length})</button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : tasks.length === 0 ? (
        <div style={{ padding: '80px', textAlign: 'center' }}>
          <Wrench size={40} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No maintenance tasks. Great!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tasks.map(task => {
            const pc = priorityConfig[task.priority]
            const sc = statusConfig[task.status]
            const cat = MAINTENANCE_CATEGORIES.find(c => c.value === task.category)
            return (
              <div key={task.id} className="glass-card-hover" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  {/* Category icon */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
                  }}>
                    {cat?.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{task.title}</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {task.resident && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {task.resident.name} · Room {task.resident.room_number}
                            </span>
                          )}
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {formatDate(task.created_at)}
                          </span>
                          {task.assigned_to && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Assigned: {task.assigned_to}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '999px', background: pc.bg, color: pc.color }}>
                          {pc.label}
                        </span>
                        <span className="status-badge" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {task.description && (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.5' }}>
                        {task.description}
                      </div>
                    )}

                    {/* Actions */}
                    {task.status !== 'resolved' && task.status !== 'cancelled' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        {task.status === 'open' && (
                          <button onClick={() => updateStatus(task.id, 'in_progress')}
                            style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                            Mark In Progress
                          </button>
                        )}
                        <button onClick={() => updateStatus(task.id, 'resolved')}
                          style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#34d399', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                          Mark Resolved
                        </button>
                        <button onClick={() => updateStatus(task.id, 'cancelled')}
                          style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Task Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Add Maintenance Task</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            {[
              { label: 'Title *', el: <input className="bb-input" placeholder="e.g. Bathroom tap leaking" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /> },
              { label: 'Category *', el: <select className="bb-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {MAINTENANCE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select> },
              { label: 'Priority', el: <select className="bb-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select> },
              { label: 'Related Resident', el: <select className="bb-input" value={form.resident_id} onChange={e => setForm(f => ({ ...f, resident_id: e.target.value }))}>
                <option value="">None (admin task)</option>
                {residents.map(r => <option key={r.id} value={r.id}>{r.name} — Room {r.room_number}</option>)}
              </select> },
              { label: 'Assigned To', el: <input className="bb-input" placeholder="Staff member name" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} /> },
              { label: 'Description', el: <textarea className="bb-input" style={{ height: '80px', resize: 'vertical' }} placeholder="Details about the issue..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /> },
            ].map(({ label, el }) => (
              <div key={label} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>{label}</label>
                {el}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setShowModal(false)} className="bb-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={handleAdd} className="bb-btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving || !form.title}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Wrench size={14} />}
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
