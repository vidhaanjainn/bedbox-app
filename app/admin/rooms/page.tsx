'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Bed, Plus, X, Loader2, Home, ChevronRight, Pencil, Trash2 } from 'lucide-react'

export default function RoomsPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<any[]>([])
  const [notices, setNotices] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showBedModal, setShowBedModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [roomForm, setRoomForm] = useState({ room_number: '', floor: '1', type: 'double', total_beds: '2' })
  const [bedForm, setBedForm] = useState({ bed_number: '', rate_monthly: '', rate_daily: '' })
  const [editRoom, setEditRoom] = useState<any>(null)
  const [editForm, setEditForm] = useState({ type: 'double', floor: '1' })
  const [editBeds, setEditBeds] = useState<any[]>([])
  const [editError, setEditError] = useState('')
  const supabase = createClient()

  useEffect(() => { fetchRooms() }, [])

  const openEditRoom = (room: any) => {
    setEditRoom(room)
    setEditForm({ type: room.type || 'double', floor: String(room.floor ?? '1') })
    setEditError('')
    setEditBeds((room.beds || []).map((b: any) => ({
      id: b.id,
      bed_number: b.bed_number,
      status: b.status,
      occupied: b.status === 'occupied',
      rate_monthly: String(b.rate_monthly ?? ''),
      rate_daily: String(b.rate_daily ?? ''),
      remove: false,
    })))
  }

  const patchEditBed = (id: string, patch: any) =>
    setEditBeds(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b))

  // One tap for the common case: the room is now let to one person only.
  // Keeps the occupied bed (or the first one) and marks every other vacant bed for removal.
  const makeSingleOccupancy = () => {
    setEditForm(f => ({ ...f, type: 'single' }))
    setEditBeds(bs => {
      const keepId = (bs.find(b => b.occupied) || bs[0])?.id
      return bs.map(b => ({ ...b, remove: b.id !== keepId && !b.occupied }))
    })
  }

  const saveEditRoom = async () => {
    if (!editRoom) return
    const kept = editBeds.filter(b => !b.remove)
    if (editForm.type === 'single' && kept.length > 1) {
      setEditError('A single room can only have one bed - remove the extra vacant beds first.')
      return
    }
    setSaving(true)
    setEditError('')
    try {
      for (const b of editBeds.filter(b => b.remove && !b.occupied)) {
        const { error } = await supabase.from('beds').delete().eq('id', b.id)
        if (error) throw error
      }
      for (const b of kept) {
        const patch: any = {
          rate_monthly: parseFloat(b.rate_monthly || '0'),
          rate_daily: parseFloat(b.rate_daily || '0'),
        }
        // Only vacant beds may flip between available / maintenance
        if (!b.occupied && (b.status === 'available' || b.status === 'maintenance')) patch.status = b.status
        const { error } = await supabase.from('beds').update(patch).eq('id', b.id)
        if (error) throw error
      }
      const occupied = kept.filter(b => b.occupied).length
      const { error } = await supabase.from('rooms').update({
        type: editForm.type,
        floor: parseInt(editForm.floor) || editRoom.floor,
        total_beds: kept.length,
        status: occupied === 0 ? 'available' : occupied >= kept.length ? 'full' : 'partial',
      }).eq('id', editRoom.id)
      if (error) throw error
      setEditRoom(null)
      fetchRooms()
    } catch (e: any) {
      setEditError(e?.message || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  const fetchRooms = async () => {
    setLoading(true)
    const [{ data }, { data: noticeData }] = await Promise.all([
      supabase.from('rooms').select('*, beds(*, resident:residents(id, name, status))').order('room_number'),
      supabase.from('notice_periods').select('resident_id, last_day_of_stay').eq('status', 'active'),
    ])
    setRooms(data || [])
    const noticeMap: Record<string, string> = {}
    noticeData?.forEach(n => { noticeMap[n.resident_id] = n.last_day_of_stay })
    setNotices(noticeMap)
    setLoading(false)
  }

  // Auto-derived the moment a notice_periods row exists for this resident - no
  // manual "mark available" step needed anywhere.
  const availableFrom = (residentId?: string) => residentId ? notices[residentId] : undefined

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => openEditRoom(room)} title="Edit room type, beds and rates" className="bb-btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Pencil size={12} /> Edit
                  </button>
                  <span style={{
                    fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '999px',
                    background: occupancy === 100 ? 'rgba(100,116,139,0.1)' : occupancy > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(0,212,200,0.1)',
                    color: occupancy === 100 ? '#94a3b8' : occupancy > 0 ? '#fbbf24' : 'var(--teal-500)',
                  }}>
                    {occupancy}% full
                  </span>
                  </div>
                </div>

                {/* Beds */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {beds.map((bed: any) => {
                    const bc = bedStatusColors[bed.status] || bedStatusColors.available
                    // bed.resident comes from residents.bed_id, which archiving
                    // now clears - this status check is the second line of
                    // defense against that same stale-join bug ever showing a
                    // departed resident as still living in a bed again.
                    const occupant = bed.resident && bed.resident.status !== 'vacated' ? bed.resident : null
                    return (
                      <div key={bed.id}
                        onClick={occupant ? () => router.push(`/admin/residents/${occupant.id}`) : undefined}
                        title={occupant ? `Open ${occupant.name}'s page to amend their details` : undefined}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', borderRadius: '8px',
                          background: bc.bg, border: `1px solid ${bc.border}`,
                          cursor: occupant ? 'pointer' : 'default',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Bed size={14} color={bc.color} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                              Bed {bed.bed_number}
                            </div>
                            {occupant && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{occupant.name}</div>
                            )}
                            {bed.resident?.status === 'notice' && availableFrom(bed.resident.id) && (
                              <div style={{ fontSize: '10px', color: '#f97316', fontWeight: '600', marginTop: '2px' }}>
                                ⏳ Available from {new Date(availableFrom(bed.resident.id)!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                          {occupant && <ChevronRight size={14} color="var(--text-muted)" />}
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

      {/* Edit Room Modal */}
      {editRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px', overflowY: 'auto' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Edit Room {editRoom.room_number}</h3>
              <button onClick={() => setEditRoom(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '20px' }}>
              Changing a bed rate here updates what new bookings and residents are charged. It does not change an existing resident&apos;s rent - edit that on their page.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Type</label>
                <select className="bb-input" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="dorm">Dorm</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Floor</label>
                <input className="bb-input" type="number" value={editForm.floor} onChange={e => setEditForm(f => ({ ...f, floor: e.target.value }))} />
              </div>
            </div>

            {editBeds.length > 1 && (
              <button onClick={makeSingleOccupancy} className="bb-btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: '14px', fontSize: '13px' }}>
                Make single occupancy (remove extra vacant beds)
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {editBeds.map(b => (
                <div key={b.id} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', opacity: b.remove ? 0.45 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Bed {b.bed_number} <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'capitalize' }}>· {b.remove ? 'will be removed' : b.status}</span>
                    </div>
                    {!b.occupied && (
                      <button onClick={() => patchEditBed(b.id, { remove: !b.remove })} title={b.remove ? 'Keep this bed' : 'Remove this bed'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: b.remove ? 'var(--teal-500)' : '#f97316', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 size={12} /> {b.remove ? 'Undo' : 'Remove'}
                      </button>
                    )}
                  </div>
                  {!b.remove && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Monthly (₹)</label>
                        <input className="bb-input" type="number" value={b.rate_monthly} onChange={e => patchEditBed(b.id, { rate_monthly: e.target.value })} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Daily (₹)</label>
                        <input className="bb-input" type="number" value={b.rate_daily} onChange={e => patchEditBed(b.id, { rate_daily: e.target.value })} />
                      </div>
                      {!b.occupied && (
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Status</label>
                          <select className="bb-input" value={b.status === 'maintenance' ? 'maintenance' : 'available'} onChange={e => patchEditBed(b.id, { status: e.target.value })}>
                            <option value="available">Available</option>
                            <option value="maintenance">Blocked</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {editError && <p style={{ color: '#f87171', fontSize: '13px', marginTop: '14px' }}>{editError}</p>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setEditRoom(null)} className="bb-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={saveEditRoom} className="bb-btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                Save changes
              </button>
            </div>
          </div>
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
              { label: 'Daily Rate (₹) - for short stays', el: <input className="bb-input" type="number" placeholder="500" value={bedForm.rate_daily} onChange={e => setBedForm(f => ({ ...f, rate_daily: e.target.value }))} /> },
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
