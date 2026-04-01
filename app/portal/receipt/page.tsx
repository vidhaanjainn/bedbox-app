'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ReceiptPage() {
  const router = useRouter()
  const supabase = createClient()
  const [resident, setResident] = useState<any>(null)
  const [rentRecords, setRentRecords] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [existing, setExisting] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(()=>{
    async function load() {
      const {data:{session}} = await supabase.auth.getSession()
      if (!session) { router.replace('/portal'); return }
      const {data:res} = await supabase.from('residents').select('id,name,email').eq('portal_user_id',session.user.id).single()
      if (!res) return
      setResident(res)
      const {data:rents} = await supabase.from('rent_records').select('id,month,amount,paid,electricity_amount').eq('resident_id',res.id).eq('paid',true).order('created_at',{ascending:false})
      setRentRecords(rents||[])
      const {data:reqs} = await supabase.from('receipt_requests').select('id,month,status,sent_at').eq('resident_id',res.id).order('created_at',{ascending:false})
      setExisting(reqs||[])
    }
    load()
  },[])

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    const {error:e} = await supabase.from('receipt_requests').insert({resident_id:resident.id,month:selected})
    if (e) { setError(e.code==='23505'?'Already requested for this month.':'Something went wrong.'); setSubmitting(false); return }
    setDone(true); setSubmitting(false)
  }

  if (done) return (
    <div style={{padding:'60px 24px',textAlign:'center'}}>
      <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(0,212,200,0.12)',border:'1px solid rgba(0,212,200,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',fontSize:28}}>✓</div>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,margin:'0 0 12px'}}>Receipt requested</h2>
      <p style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.7,maxWidth:300,margin:'0 auto 32px'}}>We'll email it to {resident?.email} within 24 hours.</p>
      <button onClick={()=>router.push('/portal/home')} style={{padding:'12px 24px',borderRadius:10,fontSize:14,fontWeight:600,background:'linear-gradient(135deg,#00d4c8,#0099ff)',color:'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Back to home</button>
    </div>
  )

  const requested = existing.map(r=>r.month)

  return (
    <div style={{padding:'28px 20px'}}>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:24,margin:'0 0 6px'}}>Request receipt</h1>
      <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 28px'}}>We'll email it to your registered address</p>
      {rentRecords.length===0?<div style={{textAlign:'center',padding:'40px 0',color:'rgba(255,255,255,0.3)',fontSize:14}}>No paid months yet</div>:<>
        <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12}}>Select month</div>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
          {rentRecords.map(r=>{
            const done2=requested.includes(r.month)
            const sel=selected===r.month
            return <button key={r.id} onClick={()=>!done2&&setSelected(r.month)} disabled={done2}
              style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',borderRadius:12,cursor:done2?'not-allowed':'pointer',background:sel?'rgba(0,212,200,0.08)':'rgba(255,255,255,0.04)',border:`1px solid ${sel?'rgba(0,212,200,0.35)':'rgba(255,255,255,0.08)'}`,color:done2?'rgba(255,255,255,0.3)':'#fff',fontFamily:"'DM Sans',sans-serif",textAlign:'left',opacity:done2?0.6:1}}>
              <div><div style={{fontSize:14,fontWeight:500}}>{r.month}</div><div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:2}}>₹{((r.amount||0)+(r.electricity_amount||0)).toLocaleString('en-IN')} paid</div></div>
              {done2&&<span style={{fontSize:12,color:'#00d4c8'}}>✓ Requested</span>}
              {sel&&!done2&&<span style={{fontSize:12,color:'#00d4c8'}}>● Selected</span>}
            </button>
          })}
        </div>
        {resident&&<div style={{background:'rgba(255,255,255,0.03)',borderRadius:10,padding:'12px 14px',marginBottom:20,fontSize:13,color:'rgba(255,255,255,0.5)'}}>Sending to <strong style={{color:'rgba(255,255,255,0.8)'}}>{resident.email}</strong></div>}
        {error&&<div style={{fontSize:13,color:'#ff6b6b',marginBottom:16,padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:8}}>{error}</div>}
        <button onClick={handleSubmit} disabled={!selected||submitting}
          style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:600,background:!selected||submitting?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#00d4c8,#0099ff)',color:!selected||submitting?'rgba(255,255,255,0.3)':'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
          {submitting?'Requesting...':'Request receipt →'}
        </button>
      </>}
      {existing.length>0&&<div style={{marginTop:28}}>
        <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12}}>Previous requests</div>
        {existing.map(r=><div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:13}}>
          <span style={{color:'rgba(255,255,255,0.7)'}}>{r.month}</span>
          <span style={{color:r.status==='sent'?'#00d4c8':'rgba(255,255,255,0.3)'}}>{r.status==='sent'?`✓ Sent`:' Pending'}</span>
        </div>)}
      </div>}
    </div>
  )
}
