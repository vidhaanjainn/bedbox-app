'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NoticePage() {
  const router = useRouter()
  const supabase = createClient()
  const [resident, setResident] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [vacateDate, setVacateDate] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const minDate = new Date(Date.now()+60*86400000).toISOString().split('T')[0]
  const displayMinDate = new Date(Date.now()+60*86400000).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})

  useEffect(()=>{
    async function load() {
      const {data:{session}} = await supabase.auth.getSession()
      if (!session) { router.replace('/portal'); return }
      const {data:res} = await supabase.from('residents').select('id,name,notice_period_start').eq('portal_user_id',session.user.id).single()
      setResident(res)
    }
    load()
  },[])

  const handleSubmit = async () => {
    if (!confirmed||!vacateDate) return
    setSubmitting(true)
    const {data:{session}} = await supabase.auth.getSession()
    if (!session) { router.replace('/portal'); return }
    const {error:e} = await supabase.from('residents').update({notice_period_start:new Date().toISOString()}).eq('portal_user_id',session.user.id)
    if (!e) await supabase.from('notice_periods').insert({resident_id:resident.id,notice_date:new Date().toISOString(),expected_vacate_date:vacateDate,reason:reason||null,status:'active'})
    if (e) { setError('Something went wrong. Try again.'); setSubmitting(false); return }
    setDone(true); setSubmitting(false)
  }

  if (resident?.notice_period_start) {
    const daysLeft = Math.max(0,60-Math.floor((Date.now()-new Date(resident.notice_period_start).getTime())/86400000))
    const endDate = new Date(new Date(resident.notice_period_start).getTime()+60*86400000).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})
    return (
      <div style={{padding:'28px 20px'}}>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:24,margin:'0 0 24px'}}>Notice to vacate</h1>
        <div style={{background:'rgba(255,179,50,0.08)',border:'1px solid rgba(255,179,50,0.2)',borderRadius:16,padding:24,textAlign:'center'}}>
          <div style={{fontSize:48,fontFamily:"'Syne',sans-serif",fontWeight:700,color:'#ffb332'}}>{daysLeft}</div>
          <div style={{fontSize:14,color:'rgba(255,255,255,0.5)',marginBottom:16}}>days remaining</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',lineHeight:1.7}}>Notice period ends on<br/><strong style={{color:'#fff'}}>{endDate}</strong></div>
        </div>
        <div style={{marginTop:20,padding:16,background:'rgba(255,255,255,0.03)',borderRadius:12,fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:2}}>
          <div>• Clear all dues before checkout</div><div>• Return all keys and access cards</div><div>• Leave room in original condition</div><div>• Security deposit refunded within 7 working days</div>
        </div>
      </div>
    )
  }

  if (done) return (
    <div style={{padding:'60px 24px',textAlign:'center'}}>
      <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(0,212,200,0.12)',border:'1px solid rgba(0,212,200,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',fontSize:28}}>✓</div>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,margin:'0 0 12px'}}>Notice submitted</h2>
      <p style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.7,maxWidth:300,margin:'0 auto 32px'}}>Your 2-month notice period has started. TheBedBox will be in touch.</p>
      <button onClick={()=>router.push('/portal/home')} style={{padding:'12px 24px',borderRadius:10,fontSize:14,fontWeight:600,background:'linear-gradient(135deg,#00d4c8,#0099ff)',color:'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Back to home</button>
    </div>
  )

  return (
    <div style={{padding:'28px 20px'}}>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:24,margin:'0 0 6px'}}>Notice to vacate</h1>
      <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 24px'}}>This starts your formal 2-month notice period</p>
      <div style={{background:'rgba(255,100,100,0.06)',border:'1px solid rgba(255,100,100,0.15)',borderRadius:12,padding:'14px 16px',marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:600,color:'#ff6b6b',marginBottom:4}}>⚠️ Read before submitting</div>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.7}}>Your earliest possible move-out date is <strong style={{color:'#fff'}}>{displayMinDate}</strong>.</div>
      </div>
      <label style={{display:'block',fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:8,fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase'}}>Expected move-out date</label>
      <input type="date" value={vacateDate} min={minDate} onChange={e=>setVacateDate(e.target.value)}
        style={{width:'100%',padding:'14px',borderRadius:12,fontSize:14,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#fff',outline:'none',boxSizing:'border-box',fontFamily:"'DM Sans',sans-serif",colorScheme:'dark',marginBottom:20}}
        onFocus={e=>e.target.style.borderColor='#00d4c8'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}/>
      <label style={{display:'block',fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:8,fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase'}}>Reason <span style={{color:'rgba(255,255,255,0.25)',fontWeight:400}}>(optional)</span></label>
      <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Relocation, end of course, personal reasons..." rows={3}
        style={{width:'100%',padding:'14px',borderRadius:12,fontSize:14,lineHeight:1.6,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#fff',outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:"'DM Sans',sans-serif",marginBottom:20}}
        onFocus={e=>e.target.style.borderColor='#00d4c8'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}/>
      <label style={{display:'flex',gap:12,alignItems:'flex-start',cursor:'pointer',marginBottom:24}}>
        <div onClick={()=>setConfirmed(c=>!c)} style={{width:20,height:20,borderRadius:5,marginTop:1,flexShrink:0,border:`2px solid ${confirmed?'#00d4c8':'rgba(255,255,255,0.2)'}`,background:confirmed?'#00d4c8':'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s'}}>
          {confirmed&&<span style={{fontSize:12,color:'#070d1a',fontWeight:700}}>✓</span>}
        </div>
        <span style={{fontSize:13,color:'rgba(255,255,255,0.6)',lineHeight:1.6}}>I understand this starts my formal 2-month notice period immediately.</span>
      </label>
      {error&&<div style={{fontSize:13,color:'#ff6b6b',marginBottom:16,padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:8}}>{error}</div>}
      <button onClick={handleSubmit} disabled={!confirmed||!vacateDate||submitting}
        style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:600,background:!confirmed||!vacateDate||submitting?'rgba(255,255,255,0.08)':'#ff6b6b',color:!confirmed||!vacateDate||submitting?'rgba(255,255,255,0.3)':'#fff',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
        {submitting?'Submitting...':'Submit notice to vacate'}
      </button>
    </div>
  )
}
