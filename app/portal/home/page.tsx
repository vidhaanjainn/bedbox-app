'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Wrench, Receipt, ClipboardList, Phone, Wifi, MapPin, Cross, Pill, ShoppingCart, UtensilsCrossed, TreePine, TrainFront, ChevronDown, Star, Upload, X, Loader2, Check, IndianRupee, Copy, Zap, Video, Users, PartyPopper, ChevronRight } from 'lucide-react'

const CATEGORY_META: Record<string, { label: string; Icon: typeof MapPin }> = {
  hospital: { label: 'Hospitals', Icon: Cross },
  pharmacy: { label: 'Pharmacies', Icon: Pill },
  grocery: { label: 'Grocery & Essentials', Icon: ShoppingCart },
  restaurant: { label: 'Food Vendors', Icon: UtensilsCrossed },
  attraction: { label: 'Places to Visit', Icon: TreePine },
  transport: { label: 'Transport', Icon: TrainFront },
  other: { label: 'Other', Icon: MapPin },
}
const CATEGORY_ORDER = ['restaurant', 'hospital', 'pharmacy', 'grocery', 'transport', 'attraction', 'other']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function PortalHomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [resident, setResident] = useState<any>(null)
  const [rentRecords, setRentRecords] = useState<any[]>([])
  const [pastArrears, setPastArrears] = useState(0)
  const [wifiPassword, setWifiPassword] = useState('')
  const [wifiNetwork, setWifiNetwork] = useState('')
  const [upiId, setUpiId] = useState('')
  const [upiPayeeName, setUpiPayeeName] = useState('TheBedBox')
  const [places, setPlaces] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [ratings, setRatings] = useState<any[]>([])
  const [myRatings, setMyRatings] = useState<Record<string, number>>({})
  const [nearbyOpen, setNearbyOpen] = useState(false)
  const [houseInfoOpen, setHouseInfoOpen] = useState(false)
  const [upiCopied, setUpiCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasElectricityReading, setHasElectricityReading] = useState(false)
  const [whatsappGroups, setWhatsappGroups] = useState<{ name: string; link: string }[]>([])
  const [propertyPhone, setPropertyPhone] = useState('')

  const [showPayModal, setShowPayModal] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState('upi')
  const [payScreenshot, setPayScreenshot] = useState<File | null>(null)
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [payMsg, setPayMsg] = useState('')

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/portal'); return }

    const { data: res } = await supabase.from('residents').select('*').eq('portal_user_id', session.user.id).single()
    if (!res) { setLoading(false); return }
    setResident(res)

    const { data: rents } = await supabase
      .from('rent_payments')
      .select('id, month, year, total_amount, amount_paid, status, electricity_amount, paid_at, resident_reported_at, resident_reported_amount')
      .eq('resident_id', res.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(6)
    setRentRecords(rents || [])

    const { data: unpaid } = await supabase
      .from('rent_payments')
      .select('total_amount, amount_paid, month, year')
      .eq('resident_id', res.id)
      .neq('status', 'paid')
    const past = (unpaid || []).filter(r => r.year < currentYear || (r.year === currentYear && r.month < currentMonth))
    setPastArrears(past.reduce((sum, r) => sum + Math.max(0, Number(r.total_amount) - Number(r.amount_paid || 0)), 0))

    const { data: settingsRows } = await supabase.from('settings').select('key, value').in('key', ['wifi_password', 'wifi_network_name', 'upi_id', 'upi_payee_name', 'property_phone', 'whatsapp_group_1_name', 'whatsapp_group_1_link', 'whatsapp_group_2_name', 'whatsapp_group_2_link'])
    const settingsMap: Record<string, string> = {}
    settingsRows?.forEach(s => { settingsMap[s.key] = s.value || '' })
    setWifiPassword(settingsMap.wifi_password || '')
    setWifiNetwork(settingsMap.wifi_network_name || '')
    setUpiId(settingsMap.upi_id || '')
    setUpiPayeeName(settingsMap.upi_payee_name || 'TheBedBox')
    setPropertyPhone(settingsMap.property_phone || '')
    setWhatsappGroups([
      { name: settingsMap.whatsapp_group_1_name, link: settingsMap.whatsapp_group_1_link },
      { name: settingsMap.whatsapp_group_2_name, link: settingsMap.whatsapp_group_2_link },
    ].filter(g => g.link))

    // Getting Started's electricity step is derived, not self-reported - it's
    // done the moment they've logged a reading at all, same source of truth
    // the admin's Electricity page uses.
    const { data: electricityRows } = await supabase.from('electricity_readings').select('id').eq('resident_id', res.id).limit(1)
    setHasElectricityReading((electricityRows?.length || 0) > 0)

    const { data: placesData } = await supabase.from('nearby_places').select('*').order('category').order('sort_order')
    setPlaces(placesData || [])

    const { data: staffData } = await supabase.from('staff').select('name, role, phone').eq('is_active', true).not('phone', 'is', null)
    setStaff(staffData || [])

    const { data: ratingRows } = await supabase.from('vendor_ratings').select('place_id, resident_id, rating')
    setRatings(ratingRows || [])
    const mine: Record<string, number> = {}
    ratingRows?.forEach(r => { if (r.resident_id === res.id) mine[r.place_id] = r.rating })
    setMyRatings(mine)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const rateVendor = async (placeId: string, rating: number) => {
    if (!resident) return
    setMyRatings(m => ({ ...m, [placeId]: rating }))
    await supabase.from('vendor_ratings').upsert(
      { place_id: placeId, resident_id: resident.id, rating, updated_at: new Date().toISOString() },
      { onConflict: 'place_id,resident_id' }
    )
    const { data: ratingRows } = await supabase.from('vendor_ratings').select('place_id, resident_id, rating')
    setRatings(ratingRows || [])
  }

  const avgRatingFor = (placeId: string) => {
    const rows = ratings.filter(r => r.place_id === placeId)
    if (!rows.length) return null
    return { avg: rows.reduce((s, r) => s + r.rating, 0) / rows.length, count: rows.length }
  }

  // Both of these are things that happen outside our system entirely (a
  // WhatsApp message, tapping a group invite link) - there's nothing here to
  // verify automatically, so it's a plain "I've done this" the resident
  // marks themselves, same trust level as ticking off a paper checklist.
  const markRoomVideoDone = async () => {
    setResident((r: any) => ({ ...r, checklist_room_video_done_at: new Date().toISOString() }))
    await supabase.from('residents').update({ checklist_room_video_done_at: new Date().toISOString() }).eq('id', resident.id)
  }
  const markGroupsJoined = async () => {
    setResident((r: any) => ({ ...r, checklist_groups_joined_at: new Date().toISOString() }))
    await supabase.from('residents').update({ checklist_groups_joined_at: new Date().toISOString() }).eq('id', resident.id)
  }
  const roomVideoWaLink = () => {
    const digits = (propertyPhone || '').replace(/\D/g, '')
    const number = digits.length === 10 ? `91${digits}` : digits
    const msg = `Hi! This is ${resident?.name?.split(' ')[0] || ''} from Room ${resident?.room_number || ''}. Sharing a video of my room's condition at move-in.`
    return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`
  }

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(upiId)
      setUpiCopied(true)
      setTimeout(() => setUpiCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }

  const openPayModal = (defaultAmount: number) => {
    setPayAmount(String(defaultAmount))
    setPayMode('upi')
    setPayScreenshot(null)
    setPayMsg('')
    setShowPayModal(true)
  }

  const submitPaymentProof = async () => {
    if (!payAmount) return
    setPaySubmitting(true)
    setPayMsg('')
    try {
      let screenshotPath = ''
      if (payScreenshot) {
        const upRes = await fetch('/api/portal/payment-upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: currentMonth, year: currentYear }),
        })
        const upData = await upRes.json()
        if (!upRes.ok) throw new Error(upData.error || 'Could not prepare upload.')
        const { error: uploadError } = await supabase.storage.from('resident-docs').uploadToSignedUrl(upData.path, upData.uploadToken, payScreenshot)
        if (uploadError) throw new Error('Upload failed. Please try again.')
        screenshotPath = upData.path
      }
      const res = await fetch('/api/portal/report-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentMonth, year: currentYear, amount: parseFloat(payAmount), paymentMode: payMode, screenshotPath }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save your payment report.')
      setPayMsg('✓ Thanks! We\'ll verify and update your status shortly.')
      setTimeout(() => { setShowPayModal(false); load() }, 1800)
    } catch (err: any) {
      setPayMsg(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setPaySubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: 28 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: i === 1 ? 80 : 120, borderRadius: 12, marginBottom: 16, background: 'rgba(255,255,255,0.04)' }} />)}</div>

  const current = rentRecords.find(r => r.month === currentMonth && r.year === currentYear)
  const dueAmount = current ? Number(current.total_amount) : Number(resident?.rent_amount) || 0
  const outstanding = current ? Math.max(0, Number(current.total_amount) - Number(current.amount_paid || 0)) : dueAmount
  const isPaid = current?.status === 'paid'
  const currentMonthLabel = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`

  const upiLink = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiPayeeName)}&am=${outstanding}&cu=INR&tn=${encodeURIComponent('Rent ' + currentMonthLabel)}` : ''

  const groupedPlaces = CATEGORY_ORDER
    .map(cat => ({ cat, items: places.filter(p => p.category === cat) }))
    .filter(g => g.items.length > 0)

  const gettingStartedSteps = [
    { key: 'electricity', done: hasElectricityReading, Icon: Zap, title: 'Log your electricity meter reading', desc: 'Your starting number, so future bills are accurate.' },
    { key: 'video', done: !!resident?.checklist_room_video_done_at, Icon: Video, title: "Send a video of your room's condition", desc: 'Protects both of us in case of any damage dispute later.' },
    { key: 'groups', done: !!resident?.checklist_groups_joined_at, Icon: Users, title: 'Join the resident WhatsApp groups', desc: 'For house announcements and staying in the loop.' },
  ]
  const gettingStartedDone = gettingStartedSteps.filter(s => s.done).length

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
        {/* Getting Started - a plain checklist of the few things worth doing
            in the first days, not a spotlight-tour overlay. Disappears for
            good once all three are done, so it never nags a settled-in
            resident - it's a welcome moment, not a permanent fixture. */}
        {gettingStartedDone < gettingStartedSteps.length && (
          <div style={{ background: 'rgba(0,212,200,0.05)', border: '1px solid rgba(0,212,200,0.18)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <PartyPopper size={16} color="#00d4c8" />
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15 }}>Getting Started</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>{gettingStartedDone} of {gettingStartedSteps.length} done - a few quick things to wrap up</div>
            <div className="bb-progress" style={{ marginBottom: 16 }}>
              <div className="bb-progress-bar" style={{ width: `${(gettingStartedDone / gettingStartedSteps.length) * 100}%` }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gettingStartedSteps.map(step => (
                <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 12, background: step.done ? 'rgba(0,212,200,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${step.done ? 'rgba(0,212,200,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: step.done ? 'rgba(0,212,200,0.15)' : 'rgba(255,255,255,0.06)' }}>
                    {step.done ? <Check size={15} color="#00d4c8" /> : <step.Icon size={15} color="rgba(255,255,255,0.6)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: step.done ? 'rgba(255,255,255,0.5)' : '#fff', textDecoration: step.done ? 'line-through' : 'none' }}>{step.title}</div>
                    {!step.done && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 1.5 }}>{step.desc}</div>}
                    {!step.done && step.key === 'electricity' && (
                      <Link href="/portal/electricity" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600, color: '#00d4c8', textDecoration: 'none' }}>
                        Enter reading <ChevronRight size={12} />
                      </Link>
                    )}
                    {!step.done && step.key === 'video' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <a href={roomVideoWaLink()} target="_blank" rel="noopener noreferrer" onClick={markRoomVideoDone} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#00d4c8', textDecoration: 'none' }}>
                          Open WhatsApp <ChevronRight size={12} />
                        </a>
                      </div>
                    )}
                    {!step.done && step.key === 'groups' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                        {whatsappGroups.map((g, i) => (
                          <a key={i} href={g.link} target="_blank" rel="noopener noreferrer" onClick={markGroupsJoined} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#00d4c8', textDecoration: 'none' }}>
                            Join {g.name || `Group ${i + 1}`} <ChevronRight size={12} />
                          </a>
                        ))}
                        {whatsappGroups.length === 0 && (
                          <button onClick={markGroupsJoined} style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color: '#00d4c8', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            Mark as done ✓
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rent status - the primary card. Pay/report options are always
            available, even before an admin has generated this month's bill,
            using the resident's on-file rent as the default amount. */}
        <div style={{ background: isPaid ? 'rgba(0,212,200,0.06)' : 'rgba(255,100,100,0.06)', border: `1px solid ${isPaid ? 'rgba(0,212,200,0.15)' : 'rgba(255,100,100,0.2)'}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{currentMonthLabel}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 28 }}>₹{dueAmount.toLocaleString('en-IN')}</div>
            </div>
            <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: isPaid ? 'rgba(0,212,200,0.12)' : 'rgba(255,100,100,0.12)', color: isPaid ? '#00d4c8' : '#ff6b6b' }}>
              {isPaid ? '✓ Paid' : current?.status === 'partial' ? '◐ Partial' : '⚠ Due'}
            </span>
          </div>
          {current?.electricity_amount > 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Includes electricity: ₹{current.electricity_amount}</div>}
          {isPaid && current.paid_at && <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,212,200,0.7)' }}>✓ Paid on {new Date(current.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
          {!current && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Your official bill isn't generated yet - you're welcome to pay your usual rent now.</div>}

          {!isPaid && current?.resident_reported_at && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', fontSize: 12, color: '#7dd3fc' }}>
              ✓ You reported ₹{Number(current.resident_reported_amount).toLocaleString('en-IN')} paid - awaiting confirmation from TheBedBox.
            </div>
          )}

          {!isPaid && (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {upiId && (
                  <a href={upiLink} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#00d4c8,#0099ff)', color: '#070d1a', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                    <IndianRupee size={14} /> Pay via UPI
                  </a>
                )}
                <button onClick={() => openPayModal(outstanding)} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  I've Paid
                </button>
              </div>
              {upiId && (
                <button onClick={copyUpiId} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, padding: '8px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer' }}>
                  {upiCopied ? <Check size={11} color="#00d4c8" /> : <Copy size={11} />} {upiCopied ? 'Copied!' : `UPI ID: ${upiId} (tap to copy)`}
                </button>
              )}
            </>
          )}
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

        {/* Payment history */}
        {rentRecords.filter(r => !(r.month === currentMonth && r.year === currentYear)).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Payment history</span>
              <Link href="/portal/receipt" style={{ fontSize: 11, color: '#00d4c8', textDecoration: 'none', fontWeight: 600 }}>Get a receipt →</Link>
            </div>
            {rentRecords.filter(r => !(r.month === currentMonth && r.year === currentYear)).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{MONTH_NAMES[r.month - 1]} {r.year}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>₹{Number(r.total_amount).toLocaleString('en-IN')}</span>
                  <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: r.status === 'paid' ? 'rgba(0,212,200,0.12)' : 'rgba(255,100,100,0.12)', color: r.status === 'paid' ? '#00d4c8' : '#ff6b6b' }}>{r.status === 'paid' ? '✓ Paid' : 'Due'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Staff contacts - source of truth is Staff & Expenses in the admin console */}
        {staff.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Need help around the house?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {staff.map((s, i) => (
                <a key={i} href={`tel:${s.phone}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none', color: '#fff' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>{s.role}</div>
                  </div>
                  <Phone size={16} color="#00d4c8" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Quick actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[{ href: '/portal/maintenance', Icon: Wrench, label: 'Report issue' }, { href: '/portal/electricity', Icon: Zap, label: 'Electricity reading' }, { href: '/portal/receipt', Icon: Receipt, label: 'Get receipt' }, { href: '/portal/notice', Icon: ClipboardList, label: 'Notice to vacate' }, { href: 'tel:+917999546362', Icon: Phone, label: 'Call us' }].map(a => (
            <Link key={a.href} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', minHeight: 44, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500 }}>
              <a.Icon size={18} color="#00d4c8" strokeWidth={1.75} />{a.label}
            </Link>
          ))}
        </div>

        {/* Secondary info - collapsed by default. These are reference
            material residents check occasionally, not things that deserve
            prime real estate above the fold every time they open the app. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {groupedPlaces.length > 0 && (
            <div>
              <button onClick={() => setNearbyOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MapPin size={15} /> Around TheBedBox</span>
                <ChevronDown size={16} style={{ transform: nearbyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {nearbyOpen && (
                <div style={{ padding: '14px 16px', marginTop: 8, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {groupedPlaces.map(g => {
                    const meta = CATEGORY_META[g.cat]
                    return (
                    <div key={g.cat} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                        {meta && <meta.Icon size={14} color="#00d4c8" />}
                        {meta?.label || g.cat}
                      </div>
                      {g.items.map((p: any) => {
                        const agg = avgRatingFor(p.id)
                        const mine = myRatings[p.id] || 0
                        return (
                        <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{p.name}</span>
                            {p.distance_note && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{p.distance_note}</span>}
                          </div>
                          {g.cat === 'restaurant' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              {[1, 2, 3, 4, 5].map(n => (
                                <button key={n} onClick={() => rateVendor(p.id, n)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                  <Star size={14} fill={n <= mine ? '#fbbf24' : 'none'} color={n <= mine ? '#fbbf24' : 'rgba(255,255,255,0.25)'} />
                                </button>
                              ))}
                              {agg && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{agg.avg.toFixed(1)} ({agg.count})</span>}
                            </div>
                          )}
                        </div>
                      )})}
                    </div>
                  )})}
                </div>
              )}
            </div>
          )}

          {wifiPassword && (
            <div>
              <button onClick={() => setHouseInfoOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wifi size={15} /> House Info</span>
                <ChevronDown size={16} style={{ transform: houseInfoOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {houseInfoOpen && (
                <div style={{ padding: '14px 16px', marginTop: 8, borderRadius: 12, background: 'rgba(0,153,255,0.06)', border: '1px solid rgba(0,153,255,0.15)' }}>
                  {wifiNetwork && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Network: <strong style={{ color: '#fff' }}>{wifiNetwork}</strong></div>}
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Password: <strong style={{ color: '#fff' }}>{wifiPassword}</strong></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pay confirmation modal */}
      {showPayModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: '#0d1526', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, margin: 0 }}>Report your payment</h3>
              <button onClick={() => setShowPayModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 18, lineHeight: 1.5 }}>Let us know you've paid - we'll verify and update your status. This doesn't mark rent as paid automatically.</p>

            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Amount paid (₹)</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
              style={{ width: '100%', padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 14, fontFamily: "'DM Sans',sans-serif" }} />

            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Payment mode</label>
            <select value={payMode} onChange={e => setPayMode(e.target.value)}
              style={{ width: '100%', padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 14, fontFamily: "'DM Sans',sans-serif" }}>
              <option value="upi">UPI / GPay</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
            </select>

            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Screenshot (optional)</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, border: `2px dashed ${payScreenshot ? '#00d4c8' : 'rgba(255,255,255,0.15)'}`, background: payScreenshot ? 'rgba(0,212,200,0.06)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', marginBottom: 16 }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setPayScreenshot(e.target.files[0])} />
              {payScreenshot ? <><Check size={16} color="#00d4c8" /><span style={{ fontSize: 13, color: '#00d4c8' }}>{payScreenshot.name}</span></> : <><Upload size={16} color="rgba(255,255,255,0.4)" /><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Tap to attach</span></>}
            </label>

            {payMsg && <div style={{ fontSize: 13, color: payMsg.startsWith('✓') ? '#00d4c8' : '#ff6b6b', marginBottom: 14, padding: '10px 12px', background: payMsg.startsWith('✓') ? 'rgba(0,212,200,0.08)' : 'rgba(255,107,107,0.08)', borderRadius: 8 }}>{payMsg}</div>}

            <button onClick={submitPaymentProof} disabled={paySubmitting || !payAmount}
              style={{ width: '100%', padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 700, background: !payAmount || paySubmitting ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#00d4c8,#0099ff)', color: !payAmount || paySubmitting ? 'rgba(255,255,255,0.3)' : '#070d1a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {paySubmitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {paySubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
