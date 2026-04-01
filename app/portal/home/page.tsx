'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function PortalHomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [resident, setResident] = useState<any>(null)
  const [rentRecords, setRentRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const currentMonth = new Date().toLocaleString('default',{month:'long'})+' '+new Date().getFullYear()

  useEffect(()=>{
    async function load() {
      const {data:{session}} = await supabase.auth.getSession()
      if (!session) { router.replace('/portal'); return }
      const {data:res} = await supabase.from('residents').select('id,name,room_id,bed_id,rent_amount,move_in_date,notice_period_start,rooms(room_number),beds(bed_label)').eq('portal_user_id',session.user.id).single()
      if (!res) { setLoading(false); return }
      setResident(res)
      const {data:rents} = await supabase.from('rent_records').select('id,month,amount,paid,paid_date,electricity_units,electricity_amount').eq('resident_id',res.id).order('created_at',{ascending:false}).limit(4)
      setRentRecords(rents||[])
      setLoading(false)
    }
    load()
  },[])

  if (loading) return <div style={{padding:28}}>{[1,2,3].map(i=><div key={i} style={{height:i===1?80:120,borderRadius:12,marginBottom:16,background:'rgba(255,255,255,0.04)'}}/>)}</div>

  const current = rentRecords.find(r=>r.month===currentMonth)
  const daysLeft = resident?.notice_period_start ? Math.max(0,60-Math.floor((Date.now()-new Date(resident.notice_period_start).getTime())/86400000)) : null
  const totalDue = current&&!current.paid ? (current.amount||resident?.rent_amount||0)+(current.electricity_amount||0) : 0

  return (
    <div>
      <div style={{padding:'28px 20px 20px',borderBottom:'1px solid rgba(255,255,255,0.05)',marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:4}}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:24,margin:0}}>Hey {resident?.name?.split(' ')[0]} 👋</h1>
          </div>
          <button onClick={async()=>{await supabase.auth.signOut();router.replace('/portal')}} style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'6px 12px',color:'rgba(255,255,255,0.4)',fontSize:12,cursor:'pointer'}}>Logout</button>
        </div>
        <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
          {resident?.rooms?.room_number&&<span style={{padding:'4px 10px',borderRadius:20,fontSize:12,fontWeight:500,background:'rgba(0,212,200,0.12)',color:'#00d4c8'}}>Room {resident.rooms.room_number}</span>}
          {resident?.beds?.bed_label&&<span style={{padding:'4px 10px',borderRadius:20,fontSize:12,fontWeight:500,background:'rgba(0,153,255,0.12)',color:'#0099ff'}}>Bed {resident.beds.bed_label}</span>}
          {daysLeft!==null&&<span style={{padding:'4px 10px',borderRadius:20,fontSize:12,fontWeight:500,background:'rgba(255,179,50,0.12)',color:'#ffb332'}}>{daysLeft}d notice left</span>}
        </div>
      </div>

      <div style={{padding:'0 20px'}}>
        {daysLeft!==null&&<div style={{background:'rgba(255,160,50,0.08)',border:'1px solid rgba(255,160,50,0.2)',borderRadius:12,padding:'14px 16px',marginBottom:20,display:'flex',gap:12,alignItems:'center'}}>
          <span style={{fontSize:20}}>⚠️</span>
          <div><div style={{fontSize:13,fontWeight:600,color:'#ffb347',marginBottom:2}}>Notice period active</div><div style={{fontSize:12,color:'rgba(255,255,255,0.5)'}}>{daysLeft} days remaining</div></div>
        </div>}

        <div style={{background:totalDue>0?'rgba(255,100,100,0.06)':'rgba(0,212,200,0.06)',border:`1px solid ${totalDue>0?'rgba(255,100,100,0.2)':'rgba(0,212,200,0.15)'}`,borderRadius:16,padding:20,marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
            <div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>{currentMonth}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:28}}>₹{(totalDue>0?totalDue:resident?.rent_amount||0).toLocaleString('en-IN')}</div>
            </div>
            {current&&<span style={{padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:600,background:current.paid?'rgba(0,212,200,0.12)':'rgba(255,100,100,0.12)',color:current.paid?'#00d4c8':'#ff6b6b'}}>{current.paid?'✓ Paid':'⚠ Due'}</span>}
          </div>
          {current?.electricity_units&&<div style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>Electricity: {current.electricity_units} units · ₹{current.electricity_amount}</div>}
          {current?.paid&&current.paid_date&&<div style={{marginTop:8,fontSize:12,color:'rgba(0,212,200,0.7)'}}>✓ Paid on {new Date(current.paid_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>}
          {!current&&<div style={{fontSize:12,color:'rgba(255,255,255,0.3)',marginTop:4}}>Bill not generated yet for this month</div>}
        </div>

        {rentRecords.filter(r=>r.month!==currentMonth).length>0&&<div style={{marginBottom:20}}>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12}}>Previous months</div>
          {rentRecords.filter(r=>r.month!==currentMonth).map(r=>(
            <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
              <span style={{fontSize:14,color:'rgba(255,255,255,0.7)'}}>{r.month}</span>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <span style={{fontSize:14,fontWeight:500}}>₹{((r.amount||0)+(r.electricity_amount||0)).toLocaleString('en-IN')}</span>
                <span style={{padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:r.paid?'rgba(0,212,200,0.12)':'rgba(255,100,100,0.12)',color:r.paid?'#00d4c8':'#ff6b6b'}}>{r.paid?'✓ Paid':'Due'}</span>
              </div>
            </div>
          ))}
        </div>}

        <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12}}>Quick actions</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
          {[{href:'/portal/maintenance',icon:'🔧',label:'Report issue'},{href:'/portal/receipt',icon:'🧾',label:'Get receipt'},{href:'/portal/notice',icon:'📋',label:'Notice to vacate'},{href:'tel:+917999546362',icon:'📞',label:'Call us'}].map(a=>(
            <Link key={a.href} href={a.href} style={{display:'flex',alignItems:'center',gap:10,padding:'14px',borderRadius:12,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',textDecoration:'none',color:'rgba(255,255,255,0.8)',fontSize:13,fontWeight:500}}>
              <span style={{fontSize:18}}>{a.icon}</span>{a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
