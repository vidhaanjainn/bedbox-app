'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Zap, Camera, Loader2, Check, X } from 'lucide-react'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function ElectricityPage() {
  const router = useRouter()
  const supabase = createClient()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [loading, setLoading] = useState(true)
  const [resident, setResident] = useState<any>(null)
  const [previousReading, setPreviousReading] = useState(0)
  const [thisMonthReading, setThisMonthReading] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  const [currentReading, setCurrentReading] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/portal'); return }

    const { data: res } = await supabase.from('residents').select('id, initial_electricity_reading').eq('portal_user_id', session.user.id).single()
    if (!res) { setLoading(false); return }
    setResident(res)

    const { data: rows } = await supabase
      .from('electricity_readings')
      .select('*')
      .eq('resident_id', res.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(6)
    setHistory(rows || [])

    const current = (rows || []).find(r => r.month === month && r.year === year)
    setThisMonthReading(current || null)

    const prev = (rows || []).find(r => !(r.month === month && r.year === year))
    setPreviousReading(current ? current.previous_reading : (prev?.current_reading ?? res.initial_electricity_reading ?? 0))

    setLoading(false)
  }

  const handlePhoto = (file: File | null) => {
    setPhoto(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : '')
  }

  const submit = async () => {
    if (!currentReading) return
    setSubmitting(true)
    setError('')
    try {
      let photoPath = ''
      if (photo) {
        const upRes = await fetch('/api/portal/electricity-photo-upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month, year }),
        })
        const upData = await upRes.json()
        if (!upRes.ok) throw new Error(upData.error || 'Could not prepare photo upload.')
        const { error: uploadError } = await supabase.storage.from('resident-docs').uploadToSignedUrl(upData.path, upData.uploadToken, photo)
        if (uploadError) throw new Error('Photo upload failed. Please try again.')
        photoPath = upData.path
      }

      const res = await fetch('/api/portal/report-electricity-reading', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, currentReading: parseFloat(currentReading), photoPath }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save your reading.')
      setDone(true)
      setTimeout(load, 100)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: 28 }}>{[1, 2].map(i => <div key={i} style={{ height: 100, borderRadius: 12, marginBottom: 16, background: 'rgba(255,255,255,0.04)' }} />)}</div>

  const preview = currentReading ? Math.max(0, parseFloat(currentReading) - previousReading) * 10 : null
  const alreadyLogged = !!thisMonthReading

  return (
    <div style={{ padding: '28px 20px' }}>
      <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 24, margin: '0 0 6px' }}>Electricity reading</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 28px' }}>{MONTH_NAMES[month - 1]} {year} · ₹10/unit</p>

      {alreadyLogged || done ? (
        <div style={{ background: 'rgba(0,212,200,0.06)', border: '1px solid rgba(0,212,200,0.2)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,212,200,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={18} color="#00d4c8" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Logged for {MONTH_NAMES[month - 1]}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Already added to this month's rent.</div>
            </div>
          </div>
          {thisMonthReading && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Units consumed</span>
              <span style={{ fontWeight: 700 }}>{thisMonthReading.units_consumed}</span>
            </div>
          )}
          {thisMonthReading && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Bill amount</span>
              <span style={{ fontWeight: 700, color: '#00d4c8' }}>₹{thisMonthReading.bill_amount}</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Last recorded reading</span>
            <span style={{ fontWeight: 700 }}>{previousReading}</span>
          </div>

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Current meter reading</div>
          <input
            type="number" inputMode="decimal" step="0.1" value={currentReading}
            onChange={e => setCurrentReading(e.target.value)} placeholder="e.g. 4521"
            style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans',sans-serif", marginBottom: 20 }}
          />

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Photo of the meter <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional, but helps avoid disputes)</span>
          </div>
          {photoPreview ? (
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <img src={photoPreview} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }} />
              <button onClick={() => handlePhoto(null)} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
              <Camera size={16} /> Take or upload a photo
              <input type="file" accept="image/*" capture="environment" onChange={e => handlePhoto(e.target.files?.[0] || null)} style={{ display: 'none' }} />
            </label>
          )}

          {preview !== null && (
            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(0,212,200,0.05)', border: '1px solid rgba(0,212,200,0.15)', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Bill preview</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#00d4c8', fontFamily: "'Syne',sans-serif" }}>₹{preview.toFixed(0)}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Will be added to this month's rent automatically.</div>
            </div>
          )}

          {error && <div style={{ fontSize: 13, color: '#ff6b6b', marginBottom: 16, padding: '10px 12px', background: 'rgba(255,107,107,0.08)', borderRadius: 10 }}>{error}</div>}

          <button onClick={submit} disabled={submitting || !currentReading} style={{ width: '100%', padding: 14, borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg,#00d4c8,#0099ff)', color: '#070d1a', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: "'DM Sans',sans-serif" }}>
            {submitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={16} />}
            {submitting ? 'Saving...' : 'Submit reading'}
          </button>
        </>
      )}

      {history.filter(h => !(h.month === month && h.year === year)).length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>History</div>
          {history.filter(h => !(h.month === month && h.year === year)).map(h => (
            <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{MONTH_NAMES[h.month - 1]} {h.year}</span>
              <span>{h.units_consumed} units</span>
              <span style={{ fontWeight: 600 }}>₹{h.bill_amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
