'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, getNoticeDaysRemaining, getNoticeTargetDate } from '@/lib/utils'
import { ArrowLeft, Phone, Mail, MapPin, Building, Calendar, Zap, CreditCard, Clock, Wrench, Edit, Shield, AlertTriangle, Link2, CheckCircle, Copy, Archive, X, FileText, ShieldCheck, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { generateAgreementPdf, generatePoliceVerificationPdf } from '@/lib/documents'
import { AGREEMENT_CLAUSES } from '@/lib/agreement-clauses'
import { Modal } from '@/components/ui/Modal'

export default function ResidentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [justInvited, setJustInvited] = useState(false)
  const [resident, setResident] = useState<any>(null)
  const [rentPayments, setRentPayments] = useState<any[]>([])
  const [electricityReadings, setElectricityReadings] = useState<any[]>([])
  const [maintenance, setMaintenance] = useState<any[]>([])
  const [notice, setNotice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteEmailStatus, setInviteEmailStatus] = useState('')
  const [copied, setCopied] = useState(false)
  const [approving, setApproving] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveReasonNotes, setArchiveReasonNotes] = useState('')
  const [archiveDepositStatus, setArchiveDepositStatus] = useState('')
  const [archiveWouldReAdmit, setArchiveWouldReAdmit] = useState<boolean | null>(null)
  const [archiveFinalElectricityReading, setArchiveFinalElectricityReading] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [generatingDoc, setGeneratingDoc] = useState<'agreement' | 'police' | null>(null)
  const [docMsg, setDocMsg] = useState('')
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [renewRent, setRenewRent] = useState('')
  const [renewEndDate, setRenewEndDate] = useState('')
  const [renewing, setRenewing] = useState(false)
  const supabase = createClient()

  // Admin-only action - this page is never reachable by a resident, and lease_end_date
  // is never queried or displayed anywhere in app/portal/*, by design (owner request:
  // residents should get no early warning that a renewal is coming).
  const openRenewModal = () => {
    const currentRent = Number(resident?.rent_amount) || 0
    setRenewRent(String(Math.round(currentRent * 1.075))) // suggested +7.5%, per the agreement's 5-10% clause - editable
    const base = resident?.lease_end_date ? new Date(resident.lease_end_date) : new Date()
    base.setMonth(base.getMonth() + 11)
    setRenewEndDate(base.toISOString().split('T')[0])
    setShowRenewModal(true)
  }

  const confirmRenewal = async () => {
    setRenewing(true)
    const oldRent = resident.rent_amount
    await supabase.from('residents').update({
      rent_amount: parseFloat(renewRent) || resident.rent_amount,
      lease_end_date: renewEndDate,
      lease_renewed_at: new Date().toISOString(),
      notes: `${resident.notes ? resident.notes + ' | ' : ''}Lease renewed ${new Date().toLocaleDateString('en-IN')}: rent ${oldRent} → ${renewRent}, new term ends ${renewEndDate}.`,
    }).eq('id', resident.id)
    setShowRenewModal(false)
    setRenewing(false)
    fetchAll()
  }

  const getSettingsMap = async () => {
    const { data } = await supabase.from('settings').select('key, value')
    const m: Record<string, string> = {}
    data?.forEach(s => { m[s.key] = s.value })
    return {
      name: m.property_name || 'TheBedBox',
      address: m.property_address || '',
      phone: m.property_phone || '',
      email: m.property_email || '',
    }
  }

  const generateAndStore = async (type: 'agreement' | 'police') => {
    setGeneratingDoc(type)
    setDocMsg('')
    try {
      const property = await getSettingsMap()
      const blob = type === 'agreement'
        ? generateAgreementPdf(resident, property, AGREEMENT_CLAUSES)
        : generatePoliceVerificationPdf(resident, property)

      const path = `${type === 'agreement' ? 'agreements' : 'police-verification'}/${resident.id}.pdf`
      const { error: uploadError } = await supabase.storage.from('private-docs').upload(path, blob, { upsert: true, contentType: 'application/pdf' })
      if (uploadError) throw uploadError

      const column = type === 'agreement' ? 'agreement_path' : 'police_verification_path'
      await supabase.from('residents').update({ [column]: path }).eq('id', resident.id)

      const { data: signed } = await supabase.storage.from('private-docs').createSignedUrl(path, 300)
      if (signed?.signedUrl) window.open(signed.signedUrl, '_blank')

      setDocMsg(`✓ ${type === 'agreement' ? 'Agreement' : 'Police verification form'} generated`)
      fetchAll()
    } catch (err) {
      console.error(err)
      setDocMsg('Could not generate document. Please try again.')
    } finally {
      setGeneratingDoc(null)
      setTimeout(() => setDocMsg(''), 4000)
    }
  }

  const viewStoredDoc = async (path: string) => {
    const { data } = await supabase.storage.from('private-docs').createSignedUrl(path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  useEffect(() => { fetchAll() }, [id])
  useEffect(() => {
    if (searchParams.get('invited') === 'true') {
      setJustInvited(true)
      router.replace(`/admin/residents/${id}`)
    }
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: res },
      { data: rent },
      { data: elec },
      { data: maint },
      { data: noticeData },
    ] = await Promise.all([
      supabase.from('residents').select('*, bed:beds(bed_number, room:rooms(room_number, type, floor)), onboarded_by_admin:admins!residents_onboarded_by_fkey(name)').eq('id', id).single(),
      supabase.from('rent_payments').select('*').eq('resident_id', id).order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('electricity_readings').select('*').eq('resident_id', id).order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('maintenance_requests').select('*').eq('resident_id', id).order('created_at', { ascending: false }),
      supabase.from('notice_periods').select('*').eq('resident_id', id).eq('status', 'active').maybeSingle(),
    ])
    setResident(res)
    setRentPayments(rent || [])
    setElectricityReadings(elec || [])
    setMaintenance(maint || [])
    setNotice(noticeData)
    setLoading(false)
  }

  const updateStatus = async (status: string) => {
    await supabase.from('residents').update({ status }).eq('id', id)
    setResident((r: any) => ({ ...r, status }))
  }

  const handleGenerateInvite = async () => {
    setInviteLoading(true)
    setInviteEmailStatus('')
    const { data, error } = await supabase.rpc('generate_onboard_token', { p_resident_id: id })
    if (error || !data) { alert('Failed to generate invite link. Try again.'); setInviteLoading(false); return }
    const url = `${window.location.origin}/onboard/${data}`
    setInviteLink(url)

    if (resident?.email) {
      try {
        const res = await fetch('/api/send-onboard-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ residentId: id, link: url }),
        })
        const json = await res.json()
        setInviteEmailStatus(res.ok ? `✓ Emailed to ${json.email}` : 'Could not email automatically - copy the link below and send manually.')
      } catch {
        setInviteEmailStatus('Could not email automatically - copy the link below and send manually.')
      }
    } else {
      setInviteEmailStatus('No email on file - copy the link below and send manually.')
    }
    setInviteLoading(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      const res = await fetch('/api/approve-resident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId: id }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Could not approve this resident.'); setApproving(false); return }
      await fetchAll()
    } catch {
      alert('Something went wrong. Please try again.')
    }
    setApproving(false)
  }

  const handleArchive = async () => {
    if (!archiveReason) { setArchiveError('Please select a reason for leaving.'); return }
    if (archiveDepositStatus === '') { setArchiveError('Please select the security deposit status.'); return }
    if (archiveWouldReAdmit === null) { setArchiveError('Please indicate whether you would re-admit this resident.'); return }
    setArchiving(true)
    setArchiveError('')
    try {
      const res = await fetch('/api/archive-resident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId: id,
          reason: archiveReason,
          reasonNotes: archiveReasonNotes,
          depositStatus: archiveDepositStatus,
          wouldReAdmit: archiveWouldReAdmit,
          finalElectricityReading: archiveFinalElectricityReading ? parseFloat(archiveFinalElectricityReading) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setArchiveError(json.error || 'Something went wrong.'); setArchiving(false); return }
      if (json.electricityReconciliation?.unbilledMonths?.length > 0) {
        alert(`Heads up: ${json.electricityReconciliation.note}`)
      }
      router.push('/admin/residents')
    } catch {
      setArchiveError('Something went wrong. Please try again.')
      setArchiving(false)
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
  if (!resident) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Resident not found.</div>

  const statusColors: Record<string, any> = {
    active: { bg: 'rgba(52,211,153,0.1)', color: '#34d399', border: 'rgba(52,211,153,0.3)' },
    pending: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
    notice: { bg: 'rgba(249,115,22,0.1)', color: '#f97316', border: 'rgba(249,115,22,0.3)' },
    vacated: { bg: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
  }
  const sc = statusColors[resident.status] || statusColors.active
  const totalArrears = rentPayments.reduce((sum, p) => sum + Math.max(0, Number(p.total_amount) - Number(p.amount_paid || 0)), 0)

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }} className="animate-fade-in">
      <Link href="/admin/residents" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', marginBottom: '24px' }}>
        <ArrowLeft size={14} /> Back to Residents
      </Link>

      {justInvited && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', fontSize: '13px', color: '#34d399', fontWeight: '600' }}>
          <CheckCircle size={15} /> Resident created - the onboarding link was emailed automatically if they have an email on file.
        </div>
      )}

      {/* PORTAL INVITE BANNER - top, always visible */}
      {resident.onboarding_status !== 'active' ? (
        <div style={{ padding: '20px 24px', borderRadius: '14px', marginBottom: '24px', background: resident.onboarding_status === 'submitted' ? 'rgba(52,211,153,0.06)' : 'rgba(0,212,200,0.04)', border: `1px solid ${resident.onboarding_status === 'submitted' ? 'rgba(52,211,153,0.25)' : 'rgba(0,212,200,0.15)'}` }}>
          {resident.onboarding_status === 'submitted' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle size={20} color="#34d399" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#34d399' }}>Onboarding submitted - needs your approval</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Agreement signed{resident.agreement_signed_at ? ` on ${formatDate(resident.agreement_signed_at)}` : ''} · IP: {resident.agreement_ip || '-'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link href={`/admin/residents/${id}/edit`} className="bb-btn-secondary" style={{ fontSize: '13px' }}>Review Details</Link>
                <button onClick={handleApprove} disabled={approving} className="bb-btn-primary" style={{ fontSize: '13px' }}>
                  <CheckCircle size={14} />{approving ? 'Activating...' : 'Approve & Activate'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: inviteLink ? '14px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Link2 size={18} color="var(--teal-500)" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Send Portal Onboarding Link</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Status: <span style={{ color: 'var(--teal-500)', fontWeight: '600', textTransform: 'capitalize' }}>{resident.onboarding_status || 'not sent'}</span>
                    </div>
                  </div>
                </div>
                <button onClick={handleGenerateInvite} disabled={inviteLoading} className="bb-btn-primary" style={{ fontSize: '13px' }}>
                  <Link2 size={14} />{inviteLoading ? 'Generating...' : 'Generate Invite Link'}
                </button>
              </div>
              {inviteLink && (
                <>
                  {inviteEmailStatus && (
                    <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '10px', color: inviteEmailStatus.startsWith('✓') ? '#34d399' : '#fbbf24' }}>
                      {inviteEmailStatus}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--teal-500)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      {inviteLink}
                    </div>
                    <button onClick={handleCopy} className="bb-btn-secondary" style={{ fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <Copy size={13} />{copied ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    ⚡ Expires in 7 days · One-time use · Also fine to paste into WhatsApp
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', marginBottom: '24px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', fontSize: '13px', color: '#34d399', fontWeight: '600' }}>
          <CheckCircle size={14} /> Portal Active · Resident can log in
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(0,212,200,0.1)', border: '2px solid rgba(0,212,200,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', color: 'var(--teal-500)', fontFamily: 'Syne, sans-serif' }}>
            {resident.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>{resident.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span className="status-badge" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>{resident.status}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Room {resident.room_number} · Joined {formatDate(resident.date_of_joining)}</span>
            </div>
            {resident.onboarded_by_admin?.name && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Onboarded by <strong style={{ color: 'var(--text-primary)' }}>{resident.onboarded_by_admin.name}</strong>{resident.onboarded_at ? ` on ${formatDate(resident.onboarded_at)}` : ''}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {resident.status !== 'vacated' && (
            <select className="bb-input" style={{ width: 'auto', fontSize: '12px' }} value={resident.status} onChange={e => updateStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="notice">On Notice</option>
              <option value="vacated">Vacated</option>
            </select>
          )}
          <Link href={`/admin/residents/${id}/edit`} className="bb-btn-secondary"><Edit size={14} /> Edit</Link>
          {resident.status !== 'vacated' && (
            <button
              onClick={() => setShowArchiveModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.06)', color: '#f87171',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              <Archive size={14} /> Archive
            </button>
          )}
        </div>
      </div>

      {/* Notice Alert */}
      {notice && (
        <div style={{ padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={18} color="#f97316" />
          <div style={{ flex: 1 }}>
            <span style={{ color: '#f97316', fontWeight: '600', fontSize: '14px' }}>Active Notice Period</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '8px' }}>
              Last day: {formatDate(getNoticeTargetDate(notice) || notice.last_day_per_agreement)} · <strong style={{ color: (getNoticeDaysRemaining(notice) ?? 0) <= 14 ? '#f87171' : '#f97316' }}>{getNoticeDaysRemaining(notice) ?? 0} days remaining</strong>
            </span>
          </div>
        </div>
      )}

      {/* Info Grid */}
      <div className="bb-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <InfoRow icon={<Phone size={14} />} label="Mobile" value={resident.mobile} />
            <InfoRow icon={<Mail size={14} />} label="Email" value={resident.email || '-'} />
            <InfoRow icon={<MapPin size={14} />} label="Hometown" value={resident.hometown || '-'} />
            <InfoRow icon={<Building size={14} />} label="Institution" value={resident.institution || '-'} />
            <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Emergency Contact</div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{resident.emergency_contact_name || '-'}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{resident.emergency_contact_phone || resident.emergency_contact_number || ''}</div>
            </div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stay Details</h3>
            {resident.status === 'active' && (
              <button onClick={openRenewModal} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(0,212,200,0.3)', background: 'rgba(0,212,200,0.08)', color: 'var(--teal-500)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                <RefreshCw size={11} /> {resident.lease_end_date ? 'Renew Lease' : 'Start Lease Tracking'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <InfoRow icon={<Building size={14} />} label="Room" value={`${resident.room_number || '-'} (${resident.bed?.room?.type || ''})`} />
            <InfoRow icon={<Calendar size={14} />} label="Joined" value={formatDate(resident.date_of_joining)} />
            <InfoRow icon={<Calendar size={14} />} label="Duration" value={resident.expected_duration || '-'} />
            <InfoRow icon={<CreditCard size={14} />} label="Monthly Rent" value={formatCurrency(resident.rent_amount)} highlight />
            <InfoRow icon={<Shield size={14} />} label="Security Deposit" value={formatCurrency(resident.security_deposit)} />
            <InfoRow icon={<Zap size={14} />} label="Initial Electricity" value={`${resident.initial_electricity_reading} units`} />
            {resident.lease_end_date && (
              <InfoRow icon={<RefreshCw size={14} />} label="Lease Term Ends" value={`${formatDate(resident.lease_end_date)} (admin-only, not shown to resident)`} />
            )}
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Documents (Admin Only)</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <DocBadge label="Aadhaar Number" uploaded={!!resident.aadhaar_number} note={resident.aadhaar_number || undefined} />
          <DocBadge label="Aadhaar Front" uploaded={!!(resident.aadhaar_front_path || resident.aadhaar_front_url)} />
          <DocBadge label="Aadhaar Back" uploaded={!!(resident.aadhaar_back_path || resident.aadhaar_back_url)} />
          <DocBadge label="T&C Agreed" uploaded={!!(resident.tc_agreed_at || resident.agreement_signed_at)} note={resident.agreement_signed_at ? formatDate(resident.agreement_signed_at) : resident.tc_agreed_at ? formatDate(resident.tc_agreed_at) : undefined} />
          {resident.agreement_ip && <DocBadge label={`Signed IP: ${resident.agreement_ip}`} uploaded={true} />}
        </div>
        {docMsg && <div style={{ fontSize: '12px', color: docMsg.startsWith('✓') ? '#34d399' : '#f87171', marginBottom: '12px' }}>{docMsg}</div>}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <button onClick={() => generateAndStore('agreement')} disabled={generatingDoc !== null} className="bb-btn-secondary" style={{ fontSize: '13px' }}>
            {generatingDoc === 'agreement' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={13} />}
            {resident.agreement_path ? 'Regenerate Agreement PDF' : 'Generate Agreement PDF'}
          </button>
          {resident.agreement_path && (
            <button onClick={() => viewStoredDoc(resident.agreement_path)} className="bb-btn-secondary" style={{ fontSize: '13px' }}><FileText size={13} /> View Agreement</button>
          )}
          <button onClick={() => generateAndStore('police')} disabled={generatingDoc !== null} className="bb-btn-secondary" style={{ fontSize: '13px' }}>
            {generatingDoc === 'police' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={13} />}
            {resident.police_verification_path ? 'Regenerate Police Form' : 'Generate Police Verification Form'}
          </button>
          {resident.police_verification_path && (
            <button onClick={() => viewStoredDoc(resident.police_verification_path)} className="bb-btn-secondary" style={{ fontSize: '13px' }}><ShieldCheck size={13} /> View Police Form</button>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
          Both documents are stored privately (admin-only) and never exposed to the resident. The police form is submission-ready - confirm the current tenant-verification process with your local police station, as no automated submission channel exists to integrate against.
        </div>
      </div>

      {/* Rent History */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rent History</h3>
          {totalArrears > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertTriangle size={13} color="#f87171" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>Arrears: {formatCurrency(totalArrears)}</span>
            </div>
          )}
        </div>
        {rentPayments.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No rent records yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
          <table className="bb-table">
            <thead><tr><th>Month</th><th>Rent</th><th>Electricity</th><th>Late Fee</th><th>Total</th><th>Paid</th><th>Mode</th><th>Status</th></tr></thead>
            <tbody>
              {rentPayments.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.year, p.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                  <td>{formatCurrency(p.rent_amount)}</td>
                  <td>
                    {p.electricity_logged_at ? (p.electricity_amount > 0 ? formatCurrency(p.electricity_amount) : '-') : (
                      <span title="Electricity reading not logged yet for this month" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#f97316' }}>
                        <AlertTriangle size={11} /> Not logged
                      </span>
                    )}
                  </td>
                  <td style={{ color: p.late_fee > 0 ? '#fbbf24' : 'inherit' }}>{p.late_fee > 0 ? formatCurrency(p.late_fee) : '-'}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(p.total_amount)}</td>
                  <td style={{ color: '#34d399' }}>{formatCurrency(p.amount_paid)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.payment_mode?.replace('_', ' ') || '-'}</td>
                  <td><span className="status-badge" style={{ background: p.status === 'paid' ? 'rgba(52,211,153,0.1)' : p.status === 'partial' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)', color: p.status === 'paid' ? '#34d399' : p.status === 'partial' ? '#fbbf24' : '#f87171', borderColor: p.status === 'paid' ? 'rgba(52,211,153,0.3)' : p.status === 'partial' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)' }}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Electricity */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Electricity Readings</h3>
        {electricityReadings.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No electricity readings yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
          <table className="bb-table">
            <thead><tr><th>Month</th><th>Previous</th><th>Current</th><th>Units</th><th>Bill</th><th>Added to Rent</th></tr></thead>
            <tbody>
              {electricityReadings.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.year, r.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                  <td>{r.previous_reading}</td><td>{r.current_reading}</td>
                  <td style={{ color: 'var(--teal-500)', fontWeight: '600' }}>{r.units_consumed}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(r.bill_amount)}</td>
                  <td><span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '999px', background: r.added_to_rent ? 'rgba(52,211,153,0.1)' : 'rgba(100,116,139,0.1)', color: r.added_to_rent ? '#34d399' : '#94a3b8' }}>{r.added_to_rent ? 'Yes' : 'Pending'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Maintenance */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Maintenance Requests</h3>
        {maintenance.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No maintenance requests.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {maintenance.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: 'var(--surface-2)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: m.priority === 'urgent' ? '#f87171' : m.priority === 'high' ? '#f97316' : '#64748b' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{m.title || m.description?.slice(0, 60)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.category} · {formatDate(m.created_at)}</div>
                </div>
                <span className="status-badge" style={{ background: m.status === 'resolved' ? 'rgba(52,211,153,0.1)' : m.status === 'in_progress' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)', color: m.status === 'resolved' ? '#34d399' : m.status === 'in_progress' ? '#60a5fa' : '#f87171', borderColor: m.status === 'resolved' ? 'rgba(52,211,153,0.3)' : m.status === 'in_progress' ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)' }}>{m.status?.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ARCHIVE RESIDENT MODAL ── */}
      {showArchiveModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}>
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)',
            borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '520px',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>
                  Archive Resident
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  {resident.name} · Room {resident.room_number}
                </p>
              </div>
              <button onClick={() => { setShowArchiveModal(false); setArchiveError('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Warning banner */}
            <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '24px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <p style={{ fontSize: '13px', color: '#f87171', margin: 0, lineHeight: '1.5' }}>
                ⚠️ This will mark the resident as <strong>vacated</strong>, free up their bed, and close any active notice period. This cannot be undone from the app.
              </p>
            </div>

            {/* Reason for leaving */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Reason for Leaving *
              </label>
              <select className="bb-input" value={archiveReason} onChange={e => setArchiveReason(e.target.value)}>
                <option value="">Select reason</option>
                <option value="course_completed">Course / studies completed</option>
                <option value="job_change">Job change / relocation</option>
                <option value="shifting_home">Shifting to own home</option>
                <option value="shifting_other_pg">Moving to another PG</option>
                <option value="family_emergency">Family emergency</option>
                <option value="rent_issue">Rent / financial issue</option>
                <option value="maintenance_issue">Maintenance / facility issue</option>
                <option value="behaviour_evicted">Evicted - behaviour/policy violation</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Additional notes */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Additional Notes (Optional)
              </label>
              <textarea
                className="bb-input"
                placeholder="Any extra context about their departure..."
                style={{ height: '72px', resize: 'vertical' }}
                value={archiveReasonNotes}
                onChange={e => setArchiveReasonNotes(e.target.value)}
              />
            </div>

            {/* Security deposit */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Security Deposit Status *
              </label>
              <select className="bb-input" value={archiveDepositStatus} onChange={e => setArchiveDepositStatus(e.target.value)}>
                <option value="">Select status</option>
                <option value="returned_full">Returned in full</option>
                <option value="partial_deduction">Partial deduction (damage / dues)</option>
                <option value="fully_deducted">Fully deducted (dues / violation)</option>
                <option value="pending">Pending - not yet settled</option>
              </select>
            </div>

            {/* Final electricity reading */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Final Electricity Reading (optional)
              </label>
              <input
                className="bb-input" type="number" step="0.1" placeholder="Reading at move-out, from their photo"
                value={archiveFinalElectricityReading}
                onChange={e => setArchiveFinalElectricityReading(e.target.value)}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Logs one last reading and checks it against everything already billed, so nothing gets missed at move-out.
              </div>
            </div>

            {/* Would re-admit */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Would You Re-Admit This Resident? *
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setArchiveWouldReAdmit(opt.value)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid',
                      borderColor: archiveWouldReAdmit === opt.value
                        ? (opt.value ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)')
                        : 'var(--border)',
                      background: archiveWouldReAdmit === opt.value
                        ? (opt.value ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.08)')
                        : 'var(--surface-2)',
                      color: archiveWouldReAdmit === opt.value
                        ? (opt.value ? '#34d399' : '#f87171')
                        : 'var(--text-muted)',
                      fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {archiveError && (
              <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '13px' }}>
                {archiveError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowArchiveModal(false); setArchiveError('') }}
                className="bb-btn-secondary"
                disabled={archiving}
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '10px 20px', borderRadius: '10px',
                  background: archiving ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#f87171', fontSize: '13px', fontWeight: '600', cursor: archiving ? 'not-allowed' : 'pointer',
                }}
              >
                <Archive size={14} />
                {archiving ? 'Archiving...' : 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lease renewal - admin-initiated only. Never surfaced to the resident;
          lease_end_date is not queried anywhere under app/portal/*. */}
      {showRenewModal && (
        <Modal title="Renew Lease" onClose={() => setShowRenewModal(false)} maxWidth="420px">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
            Current rent: {formatCurrency(resident.rent_amount)}/month. The resident is not notified of this action or shown any expiry countdown.
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>New Monthly Rent (₹)</label>
            <input className="bb-input" type="number" value={renewRent} onChange={e => setRenewRent(e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Suggested +7.5% per the standard agreement clause - adjust as needed.</div>
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>New Term Ends</label>
            <input className="bb-input" type="date" value={renewEndDate} onChange={e => setRenewEndDate(e.target.value)} />
          </div>
          <button onClick={confirmRenewal} disabled={renewing || !renewRent || !renewEndDate} className="bb-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            {renewing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            Confirm Renewal
          </button>
        </Modal>
      )}
    </div>
  )
}

function InfoRow({ icon, label, value, highlight }: { icon: React.ReactNode, label: string, value: string, highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: '14px', fontWeight: highlight ? '700' : '500', color: highlight ? 'var(--teal-500)' : 'var(--text-primary)' }}>{value}</span>
      </div>
    </div>
  )
}

function DocBadge({ label, uploaded, note }: { label: string, uploaded: boolean, note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', background: uploaded ? 'rgba(52,211,153,0.08)' : 'var(--surface-2)', border: `1px solid ${uploaded ? 'rgba(52,211,153,0.25)' : 'var(--border)'}` }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: uploaded ? '#34d399' : 'var(--text-muted)' }} />
      <span style={{ fontSize: '12px', color: uploaded ? '#34d399' : 'var(--text-muted)', fontWeight: '500' }}>{label}</span>
      {note && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({note})</span>}
    </div>
  )
}
