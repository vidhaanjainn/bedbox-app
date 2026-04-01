'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Receipt, CheckCircle, Clock, Mail } from 'lucide-react'

export default function ReceiptsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'sent'>('pending')
  const supabase = createClient()

  useEffect(() => { fetchRequests() }, [])

  const fetchRequests = async () => {
    setLoading(true)
    const { data } = await supabase.from('receipt_requests').select('*, resident:residents(name, email, mobile, room_number)').order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  const markAsSent = async (id: string) => {
    await supabase.from('receipt_requests').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
    fetchRequests()
  }

  const pending = requests.filter(r => r.status === 'pending')
  const sent = requests.filter(r => r.status === 'sent')
  const filtered = filter === 'pending' ? pending : sent

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }} className="animate-fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>Receipt Requests</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>{pending.length} pending · {sent.length} sent</p>
      </div>
      <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px', width: 'fit-content', marginBottom: '24px' }}>
        {(['pending', 'sent'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 20px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s', background: filter === f ? 'var(--teal-500)' : 'transparent', color: filter === f ? 'var(--navy-900)' : 'var(--text-muted)' }}>
            {f === 'pending' ? `⏳ Pending (${pending.length})` : `✓ Sent (${sent.length})`}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <Receipt size={40} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{filter === 'pending' ? 'No pending receipt requests 🎉' : 'No receipts sent yet'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(req => (
            <div key={req.id} className="glass-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0, background: req.status === 'sent' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {req.status === 'sent' ? <CheckCircle size={18} color="#34d399" /> : <Clock size={18} color="#fbbf24" />}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{req.resident?.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Room {req.resident?.room_number} · Receipt for <strong style={{ color: 'var(--text-primary)' }}>{req.month}</strong></div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{req.resident?.email} · Requested {formatDate(req.created_at)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {req.status === 'pending' ? (
                  <>
                    <a href={`mailto:${req.resident?.email}?subject=Rent Receipt - ${req.month} | TheBedBox&body=Dear ${req.resident?.name},%0A%0APlease find your rent receipt for ${req.month} attached.%0A%0AThank you for staying at TheBedBox!%0A%0ARegards,%0AVidhaan%0ATheBedBox%0A7999546362`} className="bb-btn-secondary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                      <Mail size={13} /> Open Email
                    </a>
                    <button onClick={() => markAsSent(req.id)} className="bb-btn-primary" style={{ fontSize: '13px' }}>
                      <CheckCircle size={13} /> Mark as Sent
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: '12px', color: '#34d399', fontWeight: '600' }}>✓ Sent {req.sent_at ? formatDate(req.sent_at) : ''}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
