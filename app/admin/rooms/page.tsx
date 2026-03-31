'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Bed, Plus, X, Loader2, Home } from 'lucide-react'

export default function RoomsPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showBedModal, setShowBedModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [roomForm, setRoomForm] = useState({ room_number: '', floor: '1', type: 'double', total_beds: '2' })
  const [bedForm, setBedForm] = useState({ bed_number: '', rate_monthly: '', rate_daily: '' })
  const supabase = createClient()

  useEffect(() => { fetchRooms() }, [])

  const fetchRooms = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('rooms')
      .select('*, beds(*, resident:residents(name, status))')
      .order('room_number')
    setRooms(data || [])
    setLoading(false)
  }

  const addRoom = async () => {
    setSaving(true)
    const { data: prop } = await supabase.from('properties').select('id').single()
    await supabase.from('rooms').insert({
      property_id: prop?.id,
      room_number: roomForm.room_number,
      floor: parseInt(roomForm.floor),
      type: roomForm.type,
      total_beds: parseInt(roomForm.total_beds),
      status: 'available',
    })
    setShowRoomModal(false)
    setRoomForm({ room_number: '', floor: '1', type: 'double', total_beds: '2' })
    setSaving(false)
    fetchRooms()
  }

  const addBed = async () => {
    if (!selectedRoom) return
    setSaving(true)
    await supabase.from('beds').insert({
      room_id: selectedRoom.id,
      bed_number: bedForm.bed_number,
      rate_monthly: parseFloat(bedForm.rate_monthly || '0'),
      rate_daily: parseFloat(bedForm.rate_daily || '0'),
      status: 'available',
    })
    setShowBedModal(false)
    setBedForm({ bed_number: '', rate_monthly: '', rate_daily: '' })
    setSaving(false)
    fetchRooms()
  }

  const bedStatusColors: Record<string, any> = {
    available: { bg: 'rgba(0,212,200,0.1)', color: 'var(--teal-500)', border: 'rgba(0,212,200,0.25)' },
    occupied: { bg: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: 'rgba(100,116,139,0.25)' },
    maintenance: { bg: 'rgba(249,115,22,0.1)', color: '#f97316', border: 'rgba(249,115,22,0.25)' },
    reserved: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  }

  return (
    <div style={{ padding: '32px' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Rooms & Beds
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            {rooms.length} rooms · {rooms.reduce((s, r) => s + (r.beds?.length || 0), 0)} total beds · {rooms.reduce((s, r) => s + (r.beds?.filter((b: any) => b.status === 'available').length || 0), 0)} available
          </p>
        </div>
        <button onClick={() => setShowRoomModal(true)} className="bb-btn-primary">
          <Plus size={16} /> Add Room
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : rooms.length === 0 ? (
        <div style={{ padding: '80px', textAlign: 'center' }}>
          <Home size={40} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>No rooms yet. Add your first room.</p>
          <button onClick={() => setShowRoomModal(true)} className="bb-btn-primary">
            <Plus size={14} /> Add First Room
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {rooms.map(room => {
            const beds = room.beds || []
            const occupied = beds.filter((b: any) => b.status === 'occupied').length
            const occupancy = beds.length > 0 ? Math.round((occupied / beds.length) * 100) : 0

            return (
              <div key={room.id} className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>
                      Room {room.room_number}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'capitalize' }}>
                      Floor {room.floor} · {room.type} · {beds.length} beds
                    </div>
                  </div>
                  <span style={{
                    fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '999px',
                    background: occupancy === 100 ? 'rgba(100,116,139,0.1)' : occupancy > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(0,212,200,0.1)',
                    color: occupancy === 100 ? '#94a3b8' : occupancy > 0 ? '#fbbf24' : 'var(--teal-500)',
                  }}>
                    {occupancy}% full
                  </span>
                </div>

                {/* Beds */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {beds.map((bed: any) => {
                    const bc = bedStatusColors[bed.status] || bedStatusColors.available
                    return (
                      <div key={bed.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: '8px',
                        background: bc.bg, border: `1px solid ${bc.border}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Bed size={14} color={bc.color} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                              Bed {bed.bed_number}
                            </div>
                            {bed.resident && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bed.resident.name}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: bc.color, textTransform: 'capitalize' }}>
                            {bed.status}
                          </div>
                          {bed.rate_monthly > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {formatCurrency(bed.rate_monthly)}/mo
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={() => { setSelectedRoom(room); setShowBedModal(true) }}
                  style={{
                    width: '100%', padding: '8px', borderRadius: '8px', cursor: 'pointer',
                    border: '1px dashed var(--border)', background: 'transparent',
                    color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Plus size={12} /> Add Bed
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Room Modal */}
      {showRoomModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Add Room</h3>
              <button onClick={() => setShowRoomModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            {[
              { label: 'Room Number *', el: <input className="bb-input" placeholder="e.g. 101, 202, G1" value={roomForm.room_number} onChange={e => setRoomForm(f => ({ ...f, room_number: e.target.value }))} /> },
              { label: 'Floor', el: <input className="bb-input" type="number" value={roomForm.floor} onChange={e => setRoomForm(f => ({ ...f, floor: e.target.value }))} /> },
              { label: 'Type', el: <select className="bb-input" value={roomForm.type} onChange={e => setRoomForm(f => ({ ...f, type: e.target.value }))}>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="dorm">Dorm</option>
              </select> },
              { label: 'Total Beds', el: <input className="bb-input" type="number" value={roomForm.total_beds} onChange={e => setRoomForm(f => ({ ...f, total_beds: e.target.value }))} /> },
            ].map(({ label, el }) => (
              <div key={label} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>{label}</label>
                {el}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setShowRoomModal(false)} className="bb-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={addRoom} className="bb-btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving || !roomForm.room_number}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                Add Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bed Modal */}
      {showBedModal && selectedRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Add Bed</h3>
              <button onClick={() => setShowBedModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>Room {selectedRoom.room_number}</p>
            {[
              { label: 'Bed Number/Label *', el: <input className="bb-input" placeholder="e.g. A, B, 1, 2" value={bedForm.bed_number} onChange={e => setBedForm(f => ({ ...f, bed_number: e.target.value }))} /> },
              { label: 'Monthly Rate (₹)', el: <input className="bb-input" type="number" placeholder="5000" value={bedForm.rate_monthly} onChange={e => setBedForm(f => ({ ...f, rate_monthly: e.target.value }))} /> },
              { label: 'Daily Rate (₹) — for short stays', el: <input className="bb-input" type="number" placeholder="500" value={bedForm.rate_daily} onChange={e => setBedForm(f => ({ ...f, rate_daily: e.target.value }))} /> },
            ].map(({ label, el }) => (
              <div key={label} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>{label}</label>
                {el}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setShowBedModal(false)} className="bb-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={addBed} className="bb-btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving || !bedForm.bed_number}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                Add Bed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
