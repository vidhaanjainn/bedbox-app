'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building, Zap, CreditCard, User, Save, Eye, EyeOff } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const [propertyName, setPropertyName] = useState('TheBedBox')
  const [propertyAddress, setPropertyAddress] = useState('8, Mahabali Nagar, Kolar Road, Bhopal')
  const [propertyPhone, setPropertyPhone] = useState('7999546362')
  const [propertyEmail, setPropertyEmail] = useState('thebedbox.in@gmail.com')
  const [electricityRate, setElectricityRate] = useState('10')
  const [rateCard, setRateCard] = useState<Record<string, string>>({ single: '7000', double: '6000', triple: '5500' })
  const [adminEmail, setAdminEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => { loadSettings() }, [])

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
      })
    }
  }

  const upsert = async (key: string, value: string) => supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })

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
