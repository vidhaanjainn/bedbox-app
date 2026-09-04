'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building, Zap, CreditCard, User, Save, Eye, EyeOff, Users, UserPlus, Loader2 } from 'lucide-react'

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
  const [admins, setAdmins] = useState<any[]>([])
  const [adminsLoading, setAdminsLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', role: 'staff' })
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  useEffect(() => { loadSettings(); loadAdmins() }, [])

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
