'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NotificationPrompt from '@/components/ui/NotificationPrompt'
import InstallPrompt from '@/components/ui/InstallPrompt'
import Link from 'next/link'
import { Home, Wrench, ClipboardList, Receipt } from 'lucide-react'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(()=>{}) }
  }, [])

  useEffect(() => {
    if (pathname==='/portal') { setChecking(false); return }
    supabase.auth.getSession().then(({data})=>{ if (!data.session) router.replace('/portal'); else setChecking(false) })
  }, [pathname])

  if (checking && pathname!=='/portal') return <div style={{minHeight:'100vh',background:'#070d1a',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.3)',fontFamily:"'DM Sans',sans-serif",fontSize:14}}><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>Loading...</div>

  const isLogin = pathname==='/portal'
  const tabs = [{href:'/portal/home',label:'Home',Icon:Home},{href:'/portal/maintenance',label:'Issues',Icon:Wrench},{href:'/portal/notice',label:'Vacate',Icon:ClipboardList},{href:'/portal/receipt',label:'Receipt',Icon:Receipt}]

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
