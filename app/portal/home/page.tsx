'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Wrench, Receipt, ClipboardList, Phone, Wifi, MapPin, Cross, Pill, ShoppingCart, UtensilsCrossed, TreePine, TrainFront } from 'lucide-react'

const CATEGORY_META: Record<string, { label: string; Icon: typeof MapPin }> = {
  hospital: { label: 'Hospitals', Icon: Cross },
  pharmacy: { label: 'Pharmacies', Icon: Pill },
  grocery: { label: 'Grocery & Essentials', Icon: ShoppingCart },
  restaurant: { label: 'Restaurants', Icon: UtensilsCrossed },
  attraction: { label: 'Places to Visit', Icon: TreePine },
  transport: { label: 'Transport', Icon: TrainFront },
  other: { label: 'Other', Icon: MapPin },
}
const CATEGORY_ORDER = ['hospital', 'pharmacy', 'grocery', 'restaurant', 'attraction', 'transport', 'other']

export default function PortalHomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [resident, setResident] = useState<any>(null)
  const [rentRecords, setRentRecords] = useState<any[]>([])
  const [pastArrears, setPastArrears] = useState(0)
  const [wifiPassword, setWifiPassword] = useState('')
  const [wifiNetwork, setWifiNetwork] = useState('')
  const [places, setPlaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/portal'); return }

      const { data: res } = await supabase.from('residents').select('*').eq('portal_user_id', session.user.id).single()
      if (!res) { setLoading(false); return }
      setResident(res)

      const { data: rents } = await supabase
        .from('rent_payments')
        .select('id, month, year, total_amount, amount_paid, status, electricity_amount, paid_at')
        .eq('resident_id', res.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(4)
      setRentRecords(rents || [])

      // Arrears = unpaid balance from BEFORE this month — queried separately
      // (not capped at 4 rows) so a resident who's fallen behind further
      // back still sees the true total, not just what fits in the recent list.
      const { data: unpaid } = await supabase
        .from('rent_payments')
        .select('total_amount, amount_paid, month, year')
        .eq('resident_id', res.id)
        .neq('status', 'paid')
      const past = (unpaid || []).filter(r => r.year < currentYear || (r.year === currentYear && r.month < currentMonth))
      setPastArrears(past.reduce((sum, r) => sum + Math.max(0, Number(r.total_amount) - Number(r.amount_paid || 0)), 0))

      const { data: settingsRows } = await supabase.from('settings').select('key, value').in('key', ['wifi_password', 'wifi_network_name'])
      settingsRows?.forEach(s => {
        if (s.key === 'wifi_password') setWifiPassword(s.value || '')
        if (s.key === 'wifi_network_name') setWifiNetwork(s.value || '')
      })

      const { data: placesData } = await supabase.from('nearby_places').select('*').order('category').order('sort_order')
      setPlaces(placesData || [])

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding: 28 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: i === 1 ? 80 : 120, borderRadius: 12, marginBottom: 16, background: 'rgba(255,255,255,0.04)' }} />)}</div>

  const current = rentRecords.find(r => r.month === currentMonth && r.year === currentYear)
  const outstanding = current ? Math.max(0, Number(current.total_amount) - Number(current.amount_paid || 0)) : 0
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonthLabel = `${monthNames[currentMonth - 1]} ${currentYear}`

  const groupedPlaces = CATEGORY_ORDER
    .map(cat => ({ cat, items: places.filter(p => p.category === cat) }))
    .filter(g => g.items.length > 0)

  return (
    <div>
      <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 24, margin: 0 }}>Hey {resident?.name?.split(' ')[0]} 👋</h1>
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); router.replace('/portal') }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>Logout</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {resident?.room_number && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: 'rgba(0,212,200,0.12)', color: '#00d4c8' }}>Room {resident.room_number}</span>}
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Rent status */}
        <div style={{ background: outstanding > 0 ? 'rgba(255,100,100,0.06)' : 'rgba(0,212,200,0.06)', border: `1px solid ${outstanding > 0 ? 'rgba(255,100,100,0.2)' : 'rgba(0,212,200,0.15)'}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{currentMonthLabel}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 28 }}>₹{(current ? Number(current.total_amount) : Number(resident?.rent_amount) || 0).toLocaleString('en-IN')}</div>
            </div>
            {current && <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: current.status === 'paid' ? 'rgba(0,212,200,0.12)' : 'rgba(255,100,100,0.12)', color: current.status === 'paid' ? '#00d4c8' : '#ff6b6b' }}>{current.status === 'paid' ? '✓ Paid' : current.status === 'partial' ? '◐ Partial' : '⚠ Due'}</span>}
          </div>
          {current?.electricity_amount > 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Includes electricity: ₹{current.electricity_amount}</div>}
          {current?.status === 'paid' && current.paid_at && <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,212,200,0.7)' }}>✓ Paid on {new Date(current.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
          {!current && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Bill not generated yet for this month</div>}
        </div>

        {pastArrears > 0 && (
          <div style={{ background: 'rgba(255,100,100,0.08)', border: '1px solid rgba(255,100,100,0.25)', borderRadius: 14, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6b6b' }}>Past dues: ₹{pastArrears.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Outstanding from previous months, in addition to this month's rent.</div>
            </div>
          </div>
        )}

        {rentRecords.filter(r => !(r.month === currentMonth && r.year === currentYear)).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Previous months</div>
            {rentRecords.filter(r => !(r.month === currentMonth && r.year === currentYear)).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{monthNames[r.month - 1]} {r.year}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>₹{Number(r.total_amount).toLocaleString('en-IN')}</span>
                  <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: r.status === 'paid' ? 'rgba(0,212,200,0.12)' : 'rgba(255,100,100,0.12)', color: r.status === 'paid' ? '#00d4c8' : '#ff6b6b' }}>{r.status === 'paid' ? '✓ Paid' : 'Due'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WiFi */}
        {wifiPassword && (
          <div style={{ background: 'rgba(0,153,255,0.06)', border: '1px solid rgba(0,153,255,0.15)', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Wifi size={16} color="#0099ff" />
              <span style={{ fontSize: 12, color: '#0099ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WiFi</span>
            </div>
            {wifiNetwork && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Network: <strong style={{ color: '#fff' }}>{wifiNetwork}</strong></div>}
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Password: <strong style={{ color: '#fff' }}>{wifiPassword}</strong></div>
          </div>
        )}

        {/* Quick actions */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Quick actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[{ href: '/portal/maintenance', Icon: Wrench, label: 'Report issue' }, { href: '/portal/receipt', Icon: Receipt, label: 'Get receipt' }, { href: '/portal/notice', Icon: ClipboardList, label: 'Notice to vacate' }, { href: 'tel:+917999546362', Icon: Phone, label: 'Call us' }].map(a => (
            <Link key={a.href} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', minHeight: 44, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500 }}>
              <a.Icon size={18} color="#00d4c8" strokeWidth={1.75} />{a.label}
            </Link>
          ))}
        </div>

        {/* Nearby places */}
        {groupedPlaces.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Around TheBedBox</div>
            {groupedPlaces.map(g => {
              const meta = CATEGORY_META[g.cat]
              return (
              <div key={g.cat} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                  {meta && <meta.Icon size={14} color="#00d4c8" />}
                  {meta?.label || g.cat}
                </div>
                {g.items.map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{p.name}</span>
                    {p.distance_note && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{p.distance_note}</span>}
                  </div>
                ))}
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}
