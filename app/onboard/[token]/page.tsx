'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Resident = {
  id: string
  name: string
  email: string
  mobile: string
  onboard_token_used: boolean
  onboard_token_expires_at: string
  onboarding_status: string
}

type FormData = {
  emergency_contact_name: string
  emergency_contact_phone: string
  hometown: string
  institution: string
  occupation: string
  aadhaar_front: File | null
  aadhaar_back: File | null
  agreement_agreed: boolean
}

const STEPS = ['Welcome', 'Your Details', 'Documents', 'Agreement', 'Done']

const AGREEMENT_CLAUSES = [
  "Rent is payable on or before the 5th of each calendar month. A penalty of ₹200 per day shall be levied for each day of delay beyond the 5th. Non-payment by the 10th gives TheBedBox the right to repossess the room and remove the tenant's belongings.",
  "The security deposit paid at the time of check-in is non-adjustable against rent and is returnable without interest at the end of the tenancy, subject to deductions for unpaid dues, damages, missing items, or any other outstanding charges.",
  "Electricity charges are billed at ₹10 per unit as per the sub-meter reading, payable along with rent. TheBedBox reserves the right to revise this rate in line with revisions by the electricity distribution company.",
  "Rent shall be subject to an increase of 5–10% after the initial 11-month term. TheBedBox reserves the right to revise rent annually thereafter, with 30 days prior notice.",
  "A minimum of two calendar months written notice is mandatory before vacating. Failure to give adequate notice will result in forfeiture of the full security deposit. During the notice period, the tenant consents to TheBedBox showing the room to prospective tenants between 9:00 AM and 8:30 PM.",
  "If the tenant fails to vacate on the termination date, a holdover penalty of ₹1,000 per day shall be charged in addition to applicable rent, until physical possession is handed over.",
  "Upon vacating, the tenant shall return the room and all fixtures in the same condition as received (normal wear and tear accepted). Failure to do so makes the tenant liable for full replacement or repair costs.",
  "If the tenant leaves the premises locked and unoccupied for more than 30 consecutive days without prior notice, TheBedBox reserves the right to break the lock and take possession in the presence of a local authority witness. The tenant shall have no claim against this action.",
  "Alcohol, drugs, tobacco, and any intoxicating substances are strictly prohibited on the premises including rooms and all common areas. This applies to visitors as well. Violation is grounds for immediate termination and forfeiture of deposit.",
  "Ragging in any form is strictly banned. Physical, mental, or verbal harassment of co-residents or staff is grounds for immediate eviction and legal action.",
  "No gambling, firearms, ammunition, explosives, or flammable materials are permitted on the premises at any time.",
  "Political, communal, or propaganda activities are prohibited on the premises. Tenants shall not give media interviews referencing TheBedBox without prior written permission from management.",
  "Noise must be kept at a level not audible outside the room at all times. Celebrations require prior written permission and must not disturb other residents.",
  "Tenants must inform management in advance of any overnight absence or extended leave exceeding 3 days.",
  "All furniture and fixtures are property of TheBedBox. Tenants must pay the full original cost of any missing item and repair costs for willful damage beyond normal wear and tear.",
  "Tenants are prohibited from interchanging furniture between rooms. No nails, pegs, or adhesives on walls, windows, or doors. No structural alterations without prior written permission.",
  "Damage or theft of common area property will be recovered equally from tenants sharing that area. Hostel-wide damage will be recovered from all occupants proportionally.",
  "Subletting, sharing, or transferring occupancy to any unauthorized person is strictly prohibited and is grounds for immediate eviction without refund.",
  "Room changes require prior written permission. Tenants may not occupy vacant rooms without authorization.",
  "Guests are permitted only in designated common areas between 9:00 AM and 9:00 PM. Overnight guests are not permitted under any circumstances.",
  "TheBedBox reserves the right to inspect any room at any time with reasonable prior intimation, or immediately in cases of suspected rule violation.",
  "TheBedBox reserves the right to terminate tenancy immediately and forfeit the deposit for misconduct, repeated rule violations, property damage, or any act detrimental to the safety or reputation of the premises.",
  "Any false or misleading information provided during onboarding renders the tenancy void immediately. The tenant must vacate forthwith and is not entitled to any refund.",
  "TheBedBox reserves the right to revise policies, pricing, and rules at any time with 30 days prior notice.",
  "The tenant is strictly prohibited from using this premises as a registered business address or for GST registration. Any such use is a material breach entitling TheBedBox to immediate termination. The tenant is solely liable for all legal consequences and costs arising therefrom.",
  "This agreement is executed at Bhopal. All disputes are subject to the exclusive jurisdiction of courts in Bhopal, Madhya Pradesh, India.",
  "This digital agreement, executed with the tenant's explicit consent including timestamp and IP address, is legally binding under the Information Technology Act, 2000, equivalent to a physically signed contract.",
  "By digitally agreeing, the tenant confirms they have read, understood, and unconditionally accept all clauses above, and that this agreement has not been made under duress, misrepresentation, or coercion.",
]

export default function OnboardPage() {
  const { token } = useParams()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [resident, setResident] = useState<Resident | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ front: false, back: false })
  const [form, setForm] = useState<FormData>({
    emergency_contact_name: '',
    emergency_contact_phone: '',
    hometown: '',
    institution: '',
    occupation: '',
    aadhaar_front: null,
    aadhaar_back: null,
    agreement_agreed: false,
  })

  useEffect(() => {
    async function validateToken() {
      if (!token) return
      const { data, error } = await supabase
        .from('residents')
        .select('id, name, email, mobile, onboard_token_used, onboard_token_expires_at, onboarding_status')
        .eq('onboard_token', token)
        .single()
      if (error || !data) { setError('This link is invalid or has expired.'); setLoading(false); return }
      if (data.onboard_token_used && data.onboarding_status !== 'submitted') { setError('This onboarding link has already been used.'); setLoading(false); return }
      if (new Date(data.onboard_token_expires_at) < new Date()) { setError('This link has expired. Please contact TheBedBox for a new link.'); setLoading(false); return }
      if (data.onboarding_status === 'submitted' || data.onboarding_status === 'active') { setError('Your onboarding is already complete. Please log in to your portal.'); setLoading(false); return }
      setResident(data)
      setLoading(false)
    }
    validateToken()
  }, [token])

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from('resident-docs').upload(path, file, { upsert: true })
    if (error) throw error
    return data.path
  }

  const handleSubmit = async () => {
    if (!resident) return
    setSubmitting(true)
    try {
      let ip = 'unknown'
      try { const r = await fetch('https://api.ipify.org?format=json'); const d = await r.json(); ip = d.ip } catch {}
      setUploadProgress({ front: true, back: false })
      let aadhaarFrontUrl = ''
      let aadhaarBackUrl = ''
      if (form.aadhaar_front) { aadhaarFrontUrl = await uploadFile(form.aadhaar_front, `${resident.id}/aadhaar-front-${Date.now()}`) }
      setUploadProgress({ front: false, back: true })
      if (form.aadhaar_back) { aadhaarBackUrl = await uploadFile(form.aadhaar_back, `${resident.id}/aadhaar-back-${Date.now()}`) }
      setUploadProgress({ front: false, back: false })
      const { error: updateError } = await supabase.from('residents').update({
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        hometown: form.hometown,
        institution: form.institution,
        occupation: form.occupation,
        aadhaar_front_url: aadhaarFrontUrl,
        aadhaar_back_url: aadhaarBackUrl,
        agreement_signed_at: new Date().toISOString(),
        agreement_ip: ip,
        onboarding_status: 'submitted',
        onboard_token_used: true,
      }).eq('id', resident.id)
      if (updateError) throw updateError
      setStep(4)
    } catch (err: any) {
      setError('Something went wrong. Please try again or contact TheBedBox.')
    } finally {
      setSubmitting(false)
    }
  }

  const canProceedStep1 = () => form.emergency_contact_name.trim() && form.emergency_contact_phone.trim() && form.hometown.trim() && form.occupation.trim()
  const canProceedStep2 = () => form.aadhaar_front && form.aadhaar_back

  if (loading) return <div style={{minHeight:'100vh',background:'#070d1a',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif",color:'rgba(255,255,255,0.4)'}}>Verifying link...</div>
  if (error) return (
    <div style={{minHeight:'100vh',background:'#070d1a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif",padding:32,textAlign:'center'}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
      <div style={{fontSize:40,marginBottom:16}}>⚠️</div>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:'#fff',margin:'0 0 12px'}}>Link unavailable</h2>
      <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,maxWidth:300,lineHeight:1.7}}>{error}</p>
      <p style={{color:'rgba(255,255,255,0.3)',fontSize:13,marginTop:24}}>Contact TheBedBox: <a href="tel:+917999546362" style={{color:'#00d4c8'}}>+91 79995 46362</a></p>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#070d1a',fontFamily:"'DM Sans',sans-serif",color:'#e8eaf0'}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
      <div style={{padding:'20px 24px 0',maxWidth:480,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:32}}>
          <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#00d4c8,#0099ff)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:'#070d1a'}}>B</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:15,color:'#00d4c8'}}>TheBedBox</span>
        </div>
        {step < 4 && (
          <div style={{display:'flex',gap:6,marginBottom:32}}>
            {STEPS.slice(0,4).map((s,i) => (
              <div key={i} style={{flex:1}}>
                <div style={{height:3,borderRadius:2,background:i<=step?'#00d4c8':'rgba(255,255,255,0.1)',transition:'background 0.3s'}}/>
                <div style={{fontSize:10,marginTop:4,color:i===step?'#00d4c8':'rgba(255,255,255,0.3)',fontWeight:i===step?600:400}}>{s}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{padding:'0 24px 40px',maxWidth:480,margin:'0 auto'}}>
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {step===0&&<div style={{animation:'fadeIn 0.4s ease'}}>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:28,margin:'0 0 8px',lineHeight:1.2}}>Hey {resident?.name?.split(' ')[0]} 👋</h1>
          <p style={{color:'rgba(255,255,255,0.5)',fontSize:15,margin:'0 0 32px',lineHeight:1.6}}>Welcome to TheBedBox. Complete your onboarding in 4 quick steps.</p>
          <div style={{background:'rgba(0,212,200,0.06)',border:'1px solid rgba(0,212,200,0.15)',borderRadius:12,padding:20,marginBottom:24}}>
            <div style={{fontSize:12,color:'#00d4c8',marginBottom:12,fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase'}}>Your booking</div>
            {[['Name',resident?.name||''],['Email',resident?.email||''],['Mobile',resident?.mobile||'']].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:13}}>
                <span style={{color:'rgba(255,255,255,0.4)'}}>{l}</span><span style={{color:'#fff',fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={()=>setStep(1)} style={{width:'100%',padding:'14px 20px',borderRadius:12,fontSize:15,fontWeight:600,background:'linear-gradient(135deg,#00d4c8,#0099ff)',color:'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Start Onboarding →</button>
        </div>}

        {step===1&&<div style={{animation:'fadeIn 0.4s ease'}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:24,margin:'0 0 6px'}}>Your details</h2>
          <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 28px'}}>We need a few things from you</p>
          {[['Emergency contact name','emergency_contact_name','Parent / sibling / friend','text'],['Their mobile number','emergency_contact_phone','+91 98765 43210','tel'],['Hometown','hometown','Indore, Jabalpur, Delhi...','text'],['Institution / Company','institution','College or employer name','text'],['Occupation','occupation','Student / Working professional / Other','text']].map(([label,field,placeholder,type])=>(
            <div key={field} style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:6}}>{label}</label>
              <input type={type} value={(form as any)[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={placeholder}
                style={{width:'100%',padding:'12px 14px',borderRadius:10,fontSize:14,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#fff',outline:'none',boxSizing:'border-box'}}
                onFocus={e=>e.target.style.borderColor='#00d4c8'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}/>
            </div>
          ))}
          <div style={{display:'flex',gap:12,marginTop:8}}>
            <button onClick={()=>setStep(0)} style={{padding:'14px 20px',borderRadius:12,fontSize:15,fontWeight:500,background:'transparent',color:'rgba(255,255,255,0.5)',border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>← Back</button>
            <button onClick={()=>setStep(2)} disabled={!canProceedStep1()} style={{flex:1,padding:'14px 20px',borderRadius:12,fontSize:15,fontWeight:600,background:canProceedStep1()?'linear-gradient(135deg,#00d4c8,#0099ff)':'rgba(255,255,255,0.08)',color:canProceedStep1()?'#070d1a':'rgba(255,255,255,0.3)',border:'none',cursor:canProceedStep1()?'pointer':'not-allowed',fontFamily:"'DM Sans',sans-serif"}}>Continue →</button>
          </div>
        </div>}

        {step===2&&<div style={{animation:'fadeIn 0.4s ease'}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:24,margin:'0 0 6px'}}>Upload Aadhaar</h2>
          <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 28px'}}>Required for identity verification. Stored securely.</p>
          {[['Aadhaar front side','aadhaar_front','Clear photo or scan — name & photo side'],['Aadhaar back side','aadhaar_back','Address side']].map(([label,field,hint])=>(
            <div key={field} style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:6}}>{label}</label>
              <label style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'20px 16px',borderRadius:10,cursor:'pointer',textAlign:'center',border:(form as any)[field]?'2px solid #00d4c8':'2px dashed rgba(255,255,255,0.15)',background:(form as any)[field]?'rgba(0,212,200,0.06)':'rgba(255,255,255,0.03)'}}>
                <input type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&setForm(f=>({...f,[field]:e.target.files![0]}))}/>
                {(form as any)[field]?<><span style={{fontSize:22,marginBottom:6}}>✓</span><span style={{fontSize:13,color:'#00d4c8',fontWeight:500}}>{(form as any)[field].name}</span></>:<><span style={{fontSize:24,marginBottom:8,opacity:0.4}}>📎</span><span style={{fontSize:13,color:'rgba(255,255,255,0.6)'}}>Tap to upload</span><span style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:3}}>{hint}</span></>}
              </label>
            </div>
          ))}
          <div style={{background:'rgba(255,200,0,0.06)',border:'1px solid rgba(255,200,0,0.15)',borderRadius:10,padding:14,marginBottom:24,fontSize:13,color:'rgba(255,200,100,0.8)',lineHeight:1.6}}>🔒 Stored in private encrypted storage. Only accessible to TheBedBox management.</div>
          <div style={{display:'flex',gap:12}}>
            <button onClick={()=>setStep(1)} style={{padding:'14px 20px',borderRadius:12,fontSize:15,fontWeight:500,background:'transparent',color:'rgba(255,255,255,0.5)',border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>← Back</button>
            <button onClick={()=>setStep(3)} disabled={!canProceedStep2()} style={{flex:1,padding:'14px 20px',borderRadius:12,fontSize:15,fontWeight:600,background:canProceedStep2()?'linear-gradient(135deg,#00d4c8,#0099ff)':'rgba(255,255,255,0.08)',color:canProceedStep2()?'#070d1a':'rgba(255,255,255,0.3)',border:'none',cursor:canProceedStep2()?'pointer':'not-allowed',fontFamily:"'DM Sans',sans-serif"}}>Continue →</button>
          </div>
        </div>}

        {step===3&&<div style={{animation:'fadeIn 0.4s ease'}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:24,margin:'0 0 6px'}}>Tenancy agreement</h2>
          <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 20px'}}>Read all 28 clauses before agreeing</p>
          <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'4px 16px',maxHeight:340,overflowY:'auto',marginBottom:20}}>
            {AGREEMENT_CLAUSES.map((clause,i)=>(
              <div key={i} style={{padding:'12px 0',borderBottom:i<AGREEMENT_CLAUSES.length-1?'1px solid rgba(255,255,255,0.05)':'none',display:'flex',gap:12,fontSize:13,lineHeight:1.6,color:'rgba(255,255,255,0.7)'}}>
                <span style={{color:'#00d4c8',fontWeight:600,minWidth:24,fontSize:11,paddingTop:2}}>{String(i+1).padStart(2,'0')}</span>
                <span>{clause}</span>
              </div>
            ))}
          </div>
          <label style={{display:'flex',gap:12,alignItems:'flex-start',cursor:'pointer',marginBottom:24}}>
            <div onClick={()=>setForm(f=>({...f,agreement_agreed:!f.agreement_agreed}))} style={{width:20,height:20,borderRadius:5,marginTop:1,flexShrink:0,border:`2px solid ${form.agreement_agreed?'#00d4c8':'rgba(255,255,255,0.2)'}`,background:form.agreement_agreed?'#00d4c8':'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s'}}>
              {form.agreement_agreed&&<span style={{fontSize:12,color:'#070d1a',fontWeight:700}}>✓</span>}
            </div>
            <span style={{fontSize:13,color:'rgba(255,255,255,0.6)',lineHeight:1.6}}>I, <strong style={{color:'#fff'}}>{resident?.name}</strong>, have read and understood all 28 clauses and agree to be bound by them.</span>
          </label>
          {error&&<div style={{fontSize:13,color:'#ff6b6b',marginBottom:16,padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:8}}>{error}</div>}
          <div style={{display:'flex',gap:12}}>
            <button onClick={()=>setStep(2)} style={{padding:'14px 20px',borderRadius:12,fontSize:15,fontWeight:500,background:'transparent',color:'rgba(255,255,255,0.5)',border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>← Back</button>
            <button onClick={handleSubmit} disabled={!form.agreement_agreed||submitting} style={{flex:1,padding:'14px 20px',borderRadius:12,fontSize:15,fontWeight:600,background:!form.agreement_agreed||submitting?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#00d4c8,#0099ff)',color:!form.agreement_agreed||submitting?'rgba(255,255,255,0.3)':'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              {submitting?(uploadProgress.front?'Uploading front...':uploadProgress.back?'Uploading back...':'Submitting...'):'Submit & Complete ✓'}
            </button>
          </div>
        </div>}

        {step===4&&<div style={{animation:'fadeIn 0.4s ease',textAlign:'center',paddingTop:40}}>
          <div style={{width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#00d4c8,#0099ff)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',fontSize:32}}>✓</div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:26,margin:'0 0 12px'}}>You're all done!</h1>
          <p style={{color:'rgba(255,255,255,0.5)',fontSize:15,lineHeight:1.7,maxWidth:320,margin:'0 auto 32px'}}>Your onboarding has been submitted to TheBedBox. You'll receive a confirmation once approved.</p>
        </div>}
      </div>
    </div>
  )
}
