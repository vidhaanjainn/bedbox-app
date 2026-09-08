'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NotificationPrompt from '@/components/ui/NotificationPrompt'
import InstallPrompt from '@/components/ui/InstallPrompt'
import Link from 'next/link'
import { Home, Wrench, ClipboardList, Receipt } from 'lucide-react'

// A vacated resident keeps portal access for a short grace window after
// move-out (enough time to settle final dues, check the deposit status, and
// leave a review) - not forever, and not zero. Centralized here so every
// portal page is covered by one gate instead of each page re-checking it.
const VACATE_GRACE_DAYS = 7

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [accessClosed, setAccessClosed] = useState(false)
  const [isVacated, setIsVacated] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(()=>{}) }
  }, [])

  useEffect(() => {
    if (pathname==='/portal') { setChecking(false); return }
    supabase.auth.getSession().then(async ({data})=>{
      if (!data.session) { router.replace('/portal'); return }

      const { data: res } = await supabase.from('residents').select('status, vacated_at').eq('portal_user_id', data.session.user.id).maybeSingle()
      if (res?.status === 'vacated' && res.vacated_at) {
        const daysSince = (Date.now() - new Date(res.vacated_at).getTime()) / 86400000
        if (daysSince > VACATE_GRACE_DAYS) {
          await supabase.auth.signOut()
          setAccessClosed(true)
          setChecking(false)
          return
        }
        setIsVacated(true)
      }
      setChecking(false)
    })
  }, [pathname])

  if (checking && pathname!=='/portal') return <div style={{minHeight:'100vh',background:'#070d1a',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.3)',fontFamily:"'DM Sans',sans-serif",fontSize:14}}><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>Loading...</div>

  if (accessClosed) return (
    <div style={{minHeight:'100vh',background:'#070d1a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#e8eaf0',fontFamily:"'DM Sans',sans-serif",padding:32,textAlign:'center'}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
      <div style={{fontSize:40,marginBottom:16}}>👋</div>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,margin:'0 0 12px'}}>Thanks for staying with us</h1>
      <p style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.7,maxWidth:320,margin:'0 0 20px'}}>Your portal access has now closed. For anything you still need - your deposit, a document, anything - just call us.</p>
      <a href="tel:+917999546362" style={{padding:'12px 24px',borderRadius:12,background:'linear-gradient(135deg,#00d4c8,#0099ff)',color:'#070d1a',fontWeight:700,fontSize:14,textDecoration:'none'}}>Call +91 79995 46362</a>
    </div>
  )

  const isLogin = pathname==='/portal'
  // A vacated resident has nothing to file a maintenance issue for or give
  // notice about anymore - just the closing-out essentials.
  const tabs = isVacated
    ? [{href:'/portal/home',label:'Home',Icon:Home},{href:'/portal/receipt',label:'Receipt',Icon:Receipt}]
    : [{href:'/portal/home',label:'Home',Icon:Home},{href:'/portal/maintenance',label:'Issues',Icon:Wrench},{href:'/portal/notice',label:'Vacate',Icon:ClipboardList},{href:'/portal/receipt',label:'Receipt',Icon:Receipt}]

  return (
    <div style={{minHeight:'100vh',background:'#070d1a',fontFamily:"'DM Sans',sans-serif",color:'#e8eaf0',paddingBottom:isLogin?0:80,maxWidth:480,margin:'0 auto'}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
      {!isLogin && (
        <div style={{ padding: '16px 20px 0' }}>
          <InstallPrompt />
          <NotificationPrompt />
        </div>
      )}
      {children}
      {!isLogin&&<nav style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,background:'rgba(7,13,26,0.96)',backdropFilter:'blur(12px)',borderTop:'1px solid rgba(255,255,255,0.08)',display:'flex',padding:'8px 0 20px',zIndex:100}}>
        {tabs.map(tab=>{
          const active=pathname===tab.href
          return <Link key={tab.href} href={tab.href} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'8px 0',minHeight:44,textDecoration:'none',color:active?'#00d4c8':'rgba(255,255,255,0.35)'}}>
            <tab.Icon size={20} strokeWidth={active?2.25:1.75} />
            <span style={{fontSize:10,fontWeight:active?600:400}}>{tab.label}</span>
          </Link>
        })}
      </nav>}
    </div>
  )
}
