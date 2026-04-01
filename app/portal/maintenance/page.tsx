'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CATS = [{id:'electrical',label:'⚡ Electrical',desc:'Lights, switches, sockets'},{id:'plumbing',label:'🚿 Plumbing',desc:'Taps, drainage, geyser'},{id:'furniture',label:'🪑 Furniture',desc:'Bed, chair, wardrobe'},{id:'appliance',label:'📺 Appliance',desc:'Fan, AC, fridge'},{id:'cleanliness',label:'🧹 Cleanliness',desc:'Common area, room'},{id:'other',label:'📝 Other',desc:'Anything else'}]

export default function MaintenancePage() {
  const router = useRouter()
  const supabase = createClient()
  const [cat, setCat] = useState('')
  const [desc, setDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!cat||!desc.trim()) return
    setSubmitting(true)
    const {data:{session}} = await supabase.auth.getSession()
    if (!session) { router.replace('/portal'); return }
    const {data:res} = await supabase.from('residents').select('id').eq('portal_user_id',session.user.id).single()
    if (!res) { setError('Session error. Please login again.'); setSubmitting(false); return }
    const {error:e} = await supabase.from('maintenance_requests').insert({resident_id:res.id,category:cat,description:desc})
    if (e) { setError('Something went wrong. Try again.'); setSubmitting(false); return }
    setDone(true); setSubmitting(false)
  }

  if (done) return (
    <div style={{padding:'60px 24px',textAlign:'center'}}>
      <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(0,212,200,0.12)',border:'1px solid rgba(0,212,200,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',fontSize:28}}>✓</div>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,margin:'0 0 12px'}}>Request submitted</h2>
      <p style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.7,maxWidth:300,margin:'0 auto 32px'}}>TheBedBox will look into this and get back to you.</p>
      <div style={{display:'flex',gap:10,justifyContent:'center'}}>
        <button onClick={()=>{setDone(false);setCat('');setDesc('')}} style={{padding:'12px 20px',borderRadius:10,fontSize:14,background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Raise another</button>
        <button onClick={()=>router.push('/portal/home')} style={{padding:'12px 20px',borderRadius:10,fontSize:14,fontWeight:600,background:'linear-gradient(135deg,#00d4c8,#0099ff)',color:'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Back to home</button>
      </div>
    </div>
  )

  return (
    <div style={{padding:'28px 20px'}}>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:24,margin:'0 0 6px'}}>Maintenance request</h1>
      <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 28px'}}>Tell us what needs fixing</p>
      <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12}}>Category</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:24}}>
        {CATS.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{padding:'14px 12px',borderRadius:12,textAlign:'left',cursor:'pointer',background:cat===c.id?'rgba(0,212,200,0.1)':'rgba(255,255,255,0.04)',border:`1px solid ${cat===c.id?'rgba(0,212,200,0.4)':'rgba(255,255,255,0.08)'}`,color:'#fff',fontFamily:"'DM Sans',sans-serif"}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:3}}>{c.label}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{c.desc}</div>
        </button>)}
      </div>
      <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10}}>Description</div>
      <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Describe the issue — what, where, since when..." rows={5}
        style={{width:'100%',padding:'14px',borderRadius:12,fontSize:14,lineHeight:1.6,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#fff',outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:"'DM Sans',sans-serif",marginBottom:24}}
        onFocus={e=>e.target.style.borderColor='#00d4c8'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}/>
      {error&&<div style={{fontSize:13,color:'#ff6b6b',marginBottom:16,padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:8}}>{error}</div>}
      <button onClick={handleSubmit} disabled={!cat||desc.trim().length<10||submitting}
        style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:600,background:!cat||desc.trim().length<10||submitting?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#00d4c8,#0099ff)',color:!cat||desc.trim().length<10||submitting?'rgba(255,255,255,0.3)':'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
        {submitting?'Submitting...':'Submit request →'}
      </button>
    </div>
  )
}
