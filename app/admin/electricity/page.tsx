'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Zap, Plus, X, Loader2, CheckCircle } from 'lucide-react'

export default function ElectricityPage() {
  const [readings, setReadings] = useState<any[]>([])
  const [residents, setResidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [form, setForm] = useState({ resident_id: '', current_reading: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() })
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [monthFilter, yearFilter])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: r }, { data: res }] = await Promise.all([
      supabase.from('electricity_readings').select('*, resident:residents(name, room_number, bed_id, initial_electricity_reading)')
        .eq('month', monthFilter).eq('year', yearFilter).order('created_at', { ascending: false }),
      supabase.from('residents').select('id, name, room_number, initial_electricity_reading, bed_id').eq('status', 'active'),
    ])
    setReadings(r || [])
    setResidents(res || [])
    setLoading(false)
  }

  const getPreviousReading = async (residentId: string): Promise<number> => {
    const now = new Date(yearFilter, monthFilter - 2)
    const prevMonth = now.getMonth() + 1
    const prevYear = now.getFullYear()

    const { data } = await supabase.from('electricity_readings')
      .select('current_reading').eq('resident_id', residentId)
      .eq('month', prevMonth).eq('year', prevYear).maybeSingle()

    if (data) return data.current_reading

    const resident = residents.find(r => r.id === residentId)
    return resident?.initial_electricity_reading || 0
  }

  const handleAdd = async () => {
    if (!form.resident_id || !form.current_reading) return
    setSaving(true)

    const resident = residents.find(r => r.id === form.resident_id)
    const previousReading = await getPreviousReading(form.resident_id)
    const currentReading = parseFloat(form.current_reading)

    if (currentReading < previousReading) {
      alert(`Current reading (${currentReading}) cannot be less than previous reading (${previousReading})`)
      setSaving(false)
      return
    }

    const { data: reading, error } = await supabase.from('electricity_readings').insert({
      resident_id: form.resident_id,
      bed_id: resident?.bed_id,
      month: form.month,
      year: form.year,
      previous_reading: previousReading,
      current_reading: currentReading,
      reading_date: new Date().toISOString().split('T')[0],
    }).select().single()

    if (!error && reading) {
      // Add electricity to rent payment
      const { data: rentPayment } = await supabase.from('rent_payments')
        .select('*').eq('resident_id', form.resident_id)
        .eq('month', form.month).eq('year', form.year).maybeSingle()

      if (rentPayment) {
        await supabase.from('rent_payments').update({
          electricity_amount: reading.bill_amount,
          total_amount: rentPayment.rent_amount + rentPayment.late_fee + reading.bill_amount,
        }).eq('id', rentPayment.id)
      }

      await supabase.from('electricity_readings').update({ added_to_rent: true }).eq('id', reading.id)
    }

    setShowModal(false)
    setForm({ resident_id: '', current_reading: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() })
    setSaving(false)
    fetchAll()
  }

  const totalUnits = readings.reduce((s, r) => s + r.units_consumed, 0)
  const totalBill = readings.reduce((s, r) => s + r.bill_amount, 0)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const alreadyLogged = readings.map(r => r.resident_id)
  const pendingResidents = residents.filter(r => !alreadyLogged.includes(r.id))

  return (
    <div style={{ padding: '32px' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Electricity
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            {months[monthFilter - 1]} {yearFilter} · ₹10/unit · {readings.length} readings logged
          </p>
        </div>
        <button onClick={() => { setShowModal(true); setForm(f => ({ ...f, month: monthFilter, year: yearFilter })) }} className="bb-btn-primary">
          <Plus size={16} /> Add Reading
        </button>
      </div>

      {/* Month selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
          {months.map((m, i) => (
            <button key={m} onClick={() => setMonthFilter(i + 1)} style={{
              padding: '5px 10px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600',
              cursor: 'pointer', transition: 'all 0.15s',
              background: monthFilter === i + 1 ? 'var(--teal-500)' : 'transparent',
              color: monthFilter === i + 1 ? 'var(--navy-900)' : 'var(--text-muted)',
            }}>{m}</button>
          ))}
        </div>
        <select className="bb-input" style={{ width: 'auto' }} value={yearFilter} onChange={e => setYearFilter(parseInt(e.target.value))}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Zap size={18} color="var(--teal-500)" />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Units</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--teal-500)', fontFamily: 'Syne, sans-serif' }}>{totalUnits.toFixed(1)}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Zap size={18} color="#fbbf24" />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Bill</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#fbbf24', fontFamily: 'Syne, sans-serif' }}>{formatCurrency(totalBill)}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <CheckCircle size={18} color="#34d399" />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Logged</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#34d399', fontFamily: 'Syne, sans-serif' }}>
            {readings.length}<span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '400' }}>/{residents.length}</span>
          </div>
        </div>
        {pendingResidents.length > 0 && (
          <div className="stat-card" style={{ border: '1px solid rgba(249,115,22,0.25)' }}>
            <div style={{ fontSize: '12px', color: '#f97316', fontWeight: '600', marginBottom: '8px' }}>Pending Readings</div>
            {pendingResidents.slice(0, 3).map(r => (
              <div key={r.id} style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                {r.name} · Room {r.room_number}
              </div>
            ))}
            {pendingResidents.length > 3 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>+{pendingResidents.length - 3} more</div>}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : readings.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Zap size={40} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No readings for this month yet.</p>
          </div>
        ) : (
          <table className="bb-table">
            <thead>
              <tr>
                <th>Resident</th>
                <th>Room</th>
                <th>Previous</th>
                <th>Current</th>
                <th>Units Used</th>
                <th>Bill (₹10/unit)</th>
                <th>Date</th>
                <th>Added to Rent</th>
              </tr>
            </thead>
            <tbody>
              {readings.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{r.resident?.name}</td>
                  <td>Room {r.resident?.room_number}</td>
                  <td>{r.previous_reading}</td>
                  <td>{r.current_reading}</td>
                  <td>
                    <span style={{ fontWeight: '700', color: 'var(--teal-500)', fontFamily: 'Syne, sans-serif', fontSize: '15px' }}>
                      {r.units_consumed}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>units</span>
                  </td>
                  <td style={{ fontWeight: '700', color: '#fbbf24', fontFamily: 'Syne, sans-serif' }}>
                    {formatCurrency(r.bill_amount)}
                  </td>
                  <td style={{ fontSize: '13px' }}>{formatDate(r.reading_date)}</td>
                  <td>
                    <span style={{
                      fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '999px',
                      background: r.added_to_rent ? 'rgba(52,211,153,0.1)' : 'rgba(100,116,139,0.1)',
                      color: r.added_to_rent ? '#34d399' : '#94a3b8',
                    }}>
                      {r.added_to_rent ? '✓ Yes' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Reading Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Add Electricity Reading
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Resident *
              </label>
              <select className="bb-input" value={form.resident_id} onChange={e => setForm(f => ({ ...f, resident_id: e.target.value }))}>
                <option value="">Select resident</option>
                {residents.map(r => (
                  <option key={r.id} value={r.id} disabled={alreadyLogged.includes(r.id)}>
                    {r.name} — Room {r.room_number} {alreadyLogged.includes(r.id) ? '(logged)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Current Meter Reading *
              </label>
              <input className="bb-input" type="number" step="0.1" placeholder="Enter current reading"
                value={form.current_reading} onChange={e => setForm(f => ({ ...f, current_reading: e.target.value }))} />
            </div>

            {form.resident_id && form.current_reading && (
              <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(0,212,200,0.05)', border: '1px solid rgba(0,212,200,0.15)', marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Bill Preview</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--teal-500)', fontFamily: 'Syne, sans-serif' }}>
                  {formatCurrency(Math.max(0, parseFloat(form.current_reading || '0') - (residents.find(r => r.id === form.resident_id)?.initial_electricity_reading || 0)) * 10)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Rate: ₹10/unit · Will be added to rent automatically</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowModal(false)} className="bb-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={handleAdd} className="bb-btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving || !form.resident_id || !form.current_reading}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                Save Reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
