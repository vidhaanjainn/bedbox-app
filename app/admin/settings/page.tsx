'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isPushSupported, hasActiveSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client'
import { Building, Zap, CreditCard, User, Save, Eye, EyeOff, Users, UserPlus, Loader2, Wifi, MapPin, Plus, Trash2, Bell } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const [propertyName, setPropertyName] = useState('TheBedBox')
  const [propertyAddress, setPropertyAddress] = useState('8, Mahabali Nagar, Kolar Road, Bhopal')
  const [propertyPhone, setPropertyPhone] = useState('7999546362')
  const [propertyEmail, setPropertyEmail] = useState('thebedbox.in@gmail.com')
  const [electricityRate, setElectricityRate] = useState('10')
  const [rateCard, setRateCard] = useState<Record<string, string>>({ single: '7000', double: '6000', triple: '5500' })
  const [wifiPassword, setWifiPassword] = useState('')
  const [wifiNetwork, setWifiNetwork] = useState('')
  const [places, setPlaces] = useState<any[]>([])
  const [newPlace, setNewPlace] = useState({ category: 'attraction', name: '', distance_note: '' })
  const [adminEmail, setAdminEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [seedingTestResident, setSeedingTestResident] = useState(false)
  const [testResidentMsg, setTestResidentMsg] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [admins, setAdmins] = useState<any[]>([])
  const [adminsLoading, setAdminsLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', role: 'staff' })
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [notifSubscribed, setNotifSubscribed] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifMsg, setNotifMsg] = useState('')

  useEffect(() => {
    loadSettings(); loadAdmins(); loadPlaces()
    hasActiveSubscription().then(setNotifSubscribed)
  }, [])

  const handleToggleNotifications = async () => {
    setNotifLoading(true); setNotifMsg('')
    if (notifSubscribed) {
      await unsubscribeFromPush()
      setNotifMsg('Notifications turned off on this device.')
    } else {
      const result = await subscribeToPush()
      if (!result.ok) { setNotifMsg(result.error || 'Could not enable notifications.'); setNotifLoading(false); return }
      setNotifMsg('✓ Notifications enabled on this device.')
    }
    setNotifSubscribed(await hasActiveSubscription())
    setNotifLoading(false)
  }

  const loadPlaces = async () => {
    const { data } = await supabase.from('nearby_places').select('*').order('category').order('sort_order')
    setPlaces(data || [])
  }

  const addPlace = async () => {
    if (!newPlace.name.trim()) return
    await supabase.from('nearby_places').insert({ category: newPlace.category, name: newPlace.name.trim(), distance_note: newPlace.distance_note.trim() || null })
    setNewPlace({ category: newPlace.category, name: '', distance_note: '' })
    loadPlaces()
  }

  const deletePlace = async (id: string) => {
    await supabase.from('nearby_places').delete().eq('id', id)
    loadPlaces()
  }

  const loadAdmins = async () => {
    setAdminsLoading(true)
    try {
      const res = await fetch('/api/admin/invite')
      const data = await res.json()
      if (res.ok) setAdmins(data.admins || [])
    } catch {}
    setAdminsLoading(false)
  }

  const sendInvite = async () => {
    setInviting(true)
    setInviteMsg('')
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })
      const data = await res.json()
      if (!res.ok) { setInviteMsg(data.error || 'Could not send invite.'); return }
      setInviteMsg('✓ Invite sent!')
      setInviteForm({ name: '', email: '', phone: '', role: 'staff' })
      loadAdmins()
      setTimeout(() => { setShowInvite(false); setInviteMsg('') }, 1500)
    } catch {
      setInviteMsg('Something went wrong.')
    } finally {
      setInviting(false)
    }
  }

  const toggleAdmin = async (id: string, is_active: boolean) => {
    const res = await fetch('/api/admin/invite', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    })
    if (res.ok) loadAdmins()
    else { const d = await res.json(); alert(d.error || 'Could not update.') }
  }

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) setAdminEmail(user.email)
    const { data } = await supabase.from('settings').select('*')
    if (data) {
      data.forEach((s: any) => {
        if (s.key === 'property_name') setPropertyName(s.value)
        if (s.key === 'property_address') setPropertyAddress(s.value)
        if (s.key === 'property_phone') setPropertyPhone(s.value)
        if (s.key === 'property_email') setPropertyEmail(s.value)
        if (s.key === 'electricity_rate') setElectricityRate(s.value)
        if (s.key === 'rate_card') { try { setRateCard(JSON.parse(s.value)) } catch {} }
        if (s.key === 'wifi_password') setWifiPassword(s.value || '')
        if (s.key === 'wifi_network_name') setWifiNetwork(s.value || '')
      })
    }
  }

  const upsert = async (key: string, value: string) => supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })

  const seedTestResident = async () => {
    setSeedingTestResident(true)
    setTestResidentMsg('')
    try {
      const res = await fetch('/api/admin/seed-test-resident', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setTestResidentMsg(data.error || 'Could not set this up.'); return }
      setTestResidentMsg(`✓ Ready — sign in at /portal with "Sign in with password", email ${data.email}, password ${data.password}`)
    } catch {
      setTestResidentMsg('Something went wrong.')
    } finally {
      setSeedingTestResident(false)
    }
  }

  const save = async (section: string, fn: () => Promise<any>) => {
    setSaving(section)
    await fn()
    setSaving(null); setSaved(section)
    setTimeout(() => setSaved(null), 2000)
  }

  const Btn = ({ section, onClick }: { section: string; onClick: () => void }) => (
    <button onClick={onClick} disabled={saving === section} className="bb-btn-primary" style={{ fontSize: '13px' }}>
      <Save size={13} />{saving === section ? 'Saving...' : saved === section ? '✓ Saved!' : 'Save'}
    </button>
  )

  return (
    <div style={{ padding: '32px', maxWidth: '720px' }} className="animate-fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Property info, rate card, and admin access</p>
      </div>

      {/* Property */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Building size={16} color="var(--teal-500)" /><h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Property Info</h3></div>
          <Btn section="property" onClick={() => save('property', () => Promise.all([upsert('property_name', propertyName), upsert('property_address', propertyAddress), upsert('property_phone', propertyPhone), upsert('property_email', propertyEmail)]))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Property name" value={propertyName} onChange={setPropertyName} />
          <Field label="Phone" value={propertyPhone} onChange={setPropertyPhone} type="tel" />
          <div style={{ gridColumn: '1/-1' }}><Field label="Full address" value={propertyAddress} onChange={setPropertyAddress} /></div>
          <div style={{ gridColumn: '1/-1' }}><Field label="Email" value={propertyEmail} onChange={setPropertyEmail} type="email" /></div>
        </div>
      </div>

      {/* Rate card */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><CreditCard size={16} color="var(--teal-500)" /><h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Rate Card (Monthly Rent)</h3></div>
          <Btn section="rates" onClick={() => save('rates', () => upsert('rate_card', JSON.stringify(rateCard)))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {['single', 'double', 'triple'].map(type => (
            <div key={type}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'capitalize', fontWeight: '600' }}>{type} occupancy</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px' }}>₹</span>
                <input className="bb-input" type="number" value={rateCard[type] || ''} onChange={e => setRateCard(rc => ({ ...rc, [type]: e.target.value }))} style={{ paddingLeft: '28px' }} placeholder="0" />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>per month</div>
            </div>
          ))}
        </div>
      </div>

      {/* Electricity */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Zap size={16} color="var(--teal-500)" /><h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Electricity Rate</h3></div>
          <Btn section="electricity" onClick={() => save('electricity', () => upsert('electricity_rate', electricityRate))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '140px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px' }}>₹</span>
            <input className="bb-input" type="number" value={electricityRate} onChange={e => setElectricityRate(e.target.value)} style={{ paddingLeft: '28px' }} />
          </div>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>per unit (sub-meter reading)</span>
        </div>
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: '8px' }}>
          💡 Changes take effect from the next billing cycle. Residents are notified per your agreement terms.
        </div>
      </div>

      {/* WiFi (resident portal) */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Wifi size={16} color="var(--teal-500)" /><h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>WiFi (shown to residents)</h3></div>
          <Btn section="wifi" onClick={() => save('wifi', () => Promise.all([upsert('wifi_password', wifiPassword), upsert('wifi_network_name', wifiNetwork)]))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Network name (optional)" value={wifiNetwork} onChange={setWifiNetwork} />
          <Field label="Password" value={wifiPassword} onChange={setWifiPassword} />
        </div>
      </div>

      {/* Nearby places (resident portal) */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}><MapPin size={16} color="var(--teal-500)" /><h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Nearby Places (resident portal)</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr auto', gap: '10px', marginBottom: '16px' }}>
          <select className="bb-input" value={newPlace.category} onChange={e => setNewPlace(p => ({ ...p, category: e.target.value }))}>
            {['hospital', 'pharmacy', 'grocery', 'restaurant', 'attraction', 'transport', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="bb-input" placeholder="Name" value={newPlace.name} onChange={e => setNewPlace(p => ({ ...p, name: e.target.value }))} />
          <input className="bb-input" placeholder="Distance / note (optional)" value={newPlace.distance_note} onChange={e => setNewPlace(p => ({ ...p, distance_note: e.target.value }))} />
          <button onClick={addPlace} className="bb-btn-primary" style={{ fontSize: '13px' }}><Plus size={13} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
          {places.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '8px' }}>
              <div style={{ fontSize: '13px' }}><span style={{ color: 'var(--text-muted)', textTransform: 'capitalize', fontSize: '11px' }}>{p.category}</span> · <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{p.name}</span> {p.distance_note && <span style={{ color: 'var(--text-muted)' }}>· {p.distance_note}</span>}</div>
              <button onClick={() => deletePlace(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}><Trash2 size={14} /></button>
            </div>
          ))}
          {places.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>No places added yet.</div>}
        </div>
      </div>

      {/* Team / Multi-admin */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Users size={16} color="var(--teal-500)" /><h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Team</h3></div>
          <button onClick={() => setShowInvite(s => !s)} className="bb-btn-secondary" style={{ fontSize: '13px' }}>
            <UserPlus size={13} /> Invite Admin
          </button>
        </div>

        {showInvite && (
          <div style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <Field label="Name" value={inviteForm.name} onChange={v => setInviteForm(f => ({ ...f, name: v }))} />
              <Field label="Email" value={inviteForm.email} onChange={v => setInviteForm(f => ({ ...f, email: v }))} type="email" />
              <Field label="Phone (optional)" value={inviteForm.phone} onChange={v => setInviteForm(f => ({ ...f, phone: v }))} type="tel" />
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>Role</label>
                <select className="bb-input" value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="staff">Staff (day-to-day ops)</option>
                  <option value="super_admin">Super Admin (full access)</option>
                </select>
              </div>
            </div>
            {inviteMsg && <div style={{ fontSize: '12px', color: inviteMsg.startsWith('✓') ? '#34d399' : '#f87171', marginBottom: '10px' }}>{inviteMsg}</div>}
            <button onClick={sendInvite} disabled={inviting || !inviteForm.name || !inviteForm.email} className="bb-btn-primary" style={{ fontSize: '13px' }}>
              {inviting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={13} />}
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              They'll get an email to set their own password and can log in at this same admin portal immediately after.
            </div>
          </div>
        )}

        {adminsLoading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {admins.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{a.name} <span style={{ fontWeight: '400', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'capitalize' }}>· {a.role?.replace('_', ' ')}</span></div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.email}</div>
                </div>
                <button
                  onClick={() => toggleAdmin(a.id, a.is_active)}
                  style={{
                    padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)',
                    background: a.is_active ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
                    color: a.is_active ? '#34d399' : '#f87171',
                    fontSize: '11px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  {a.is_active ? 'Active' : 'Deactivated'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}><User size={16} color="var(--teal-500)" /><h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Admin Profile</h3></div>
        <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'var(--surface-2)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Logged in as <strong style={{ color: 'var(--text-primary)' }}>{adminEmail}</strong>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>Change Password</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
            <PassField label="New password" value={newPassword} onChange={setNewPassword} show={showPass} toggle={() => setShowPass(s => !s)} />
            <PassField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} show={showPass} toggle={() => setShowPass(s => !s)} />
            <button
              onClick={async () => {
                if (newPassword !== confirmPassword) { alert('Passwords do not match.'); return }
                if (newPassword.length < 8) { alert('Minimum 8 characters.'); return }
                setSaving('password')
                const { error } = await supabase.auth.updateUser({ password: newPassword })
                if (error) { alert(error.message); setSaving(null); return }
                setNewPassword(''); setConfirmPassword(''); setSaving(null); setSaved('password')
                setTimeout(() => setSaved(null), 3000)
              }}
              disabled={!newPassword || !confirmPassword || saving === 'password'}
              className="bb-btn-primary" style={{ fontSize: '13px', width: 'fit-content' }}
            >
              <Save size={13} />{saving === 'password' ? 'Updating...' : saved === 'password' ? '✓ Updated!' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>

      {/* Review tools */}
      <div className="glass-card" style={{ padding: '24px', marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}><User size={16} color="var(--teal-500)" /><h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Review Tools</h3></div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Creates (or resets) a test resident login so you can review the resident portal without waiting for an OTP each time. Doesn't occupy a real bed.
        </p>
        <button onClick={seedTestResident} disabled={seedingTestResident} className="bb-btn-secondary" style={{ fontSize: '13px' }}>
          {seedingTestResident ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          {seedingTestResident ? 'Setting up...' : 'Create Test Resident Login'}
        </button>
        {testResidentMsg && <div style={{ fontSize: '12px', color: testResidentMsg.startsWith('✓') ? '#34d399' : '#f87171', marginTop: '10px' }}>{testResidentMsg}</div>}
      </div>

      <div className="glass-card" style={{ padding: '24px', marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}><Bell size={16} color="var(--teal-500)" /><h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Notifications</h3></div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Get push notifications on this device for new bookings, onboarding submissions, complaints, notice-to-vacate filings, and the monthly rent/payout reminder.
        </p>
        {!isPushSupported() ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Not supported on this browser/device.</div>
        ) : (
          <button onClick={handleToggleNotifications} disabled={notifLoading} className={notifSubscribed ? 'bb-btn-secondary' : 'bb-btn-primary'} style={{ fontSize: '13px' }}>
            {notifLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Bell size={13} />}
            {notifLoading ? 'Working...' : notifSubscribed ? 'Turn Off Notifications' : 'Enable Notifications'}
          </button>
        )}
        {notifMsg && <div style={{ fontSize: '12px', color: notifMsg.startsWith('✓') ? '#34d399' : '#f87171', marginTop: '10px' }}>{notifMsg}</div>}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>{label}</label>
      <input className="bb-input" type={type} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function PassField({ label, value, onChange, show, toggle }: { label: string; value: string; onChange: (v: string) => void; show: boolean; toggle: () => void }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input className="bb-input" type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} style={{ paddingRight: '40px' }} />
        <button onClick={toggle} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}
