'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Phone } from 'lucide-react'
import Link from 'next/link'
import { BedBoxLogo } from '@/components/brand/BedBoxLogo'

export default function PortalLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<'email'|'otp'|'password'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [pwEmail, setPwEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)

  // Password sign-in exists only for accounts an admin explicitly sets a
  // password on (see Settings -> Review Tools) - real residents only ever
  // have OTP, so this is a no-op dead end for everyone else.
  const handlePasswordLogin = async () => {
    setError(''); setLoading(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: pwEmail, password: pw })
    if (signInError || !data.session) { setError('Invalid email or password.'); setLoading(false); return }
    router.push('/portal/home')
  }

  const startResendTimer = () => {
    setResendTimer(30)
    const interval = setInterval(()=>setResendTimer(t=>{if(t<=1){clearInterval(interval);return 0}return t-1}),1000)
  }

  const handleSendOTP = async () => {
    setError(''); setLoading(true)
    const clean = email.trim().toLowerCase()

    try {
      const res = await fetch('/api/ensure-portal-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Could not send OTP. Please try again.'); setLoading(false); return }
    } catch {
      setError('Could not send OTP. Please try again.'); setLoading(false); return
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: false },
    })
    if (otpError) { setError('Could not send OTP. Please try again.'); setLoading(false); return }
    setEmail(clean); setStep('otp'); startResendTimer(); setLoading(false)
  }

  const handleVerifyOTP = async () => {
    setError(''); setLoading(true)
    const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
    if (verifyError||!data.session) { setError('Invalid or expired OTP. Try again.'); setLoading(false); return }
    router.push('/portal/home')
  }

  const masked = email.replace(/(.{2})(.*)(@.*)/,(_,a,b,c)=>a+'*'.repeat(Math.max(2,b.length-2))+b.slice(-1)+c)

  return (
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(0,212,200,0.10), transparent 60%), #070d1a',fontFamily:"'DM Sans',sans-serif",color:'#e8eaf0',display:'flex',flexDirection:'column',position:'relative'}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>

      <div style={{padding:'32px 24px 0',maxWidth:420,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>
        <div style={{display:'flex',alignItems:'center',marginBottom:56}}>
          <BedBoxLogo height={30} surface="dark" />
        </div>
      </div>

      <div style={{flex:1,padding:'0 24px',maxWidth:420,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>
        <div style={{
          background:'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:20,
          padding:'32px 28px',
          backdropFilter:'blur(20px)',
          boxShadow:'0 1px 0 rgba(255,255,255,0.06) inset, 0 32px 64px -32px rgba(0,0,0,0.7)',
        }}>
          {step==='email'&&<div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:26,margin:'0 0 8px',letterSpacing:'-0.01em'}}>Welcome back</h1>
            <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 32px',lineHeight:1.5}}>Enter your registered email - we'll send a 6-digit code to sign you in</p>
            <label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(255,255,255,0.35)',marginBottom:9}}>Email address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={e=>e.key==='Enter'&&handleSendOTP()}
              style={{width:'100%',padding:'14px',fontSize:15,background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,color:'#fff',outline:'none',fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box',marginBottom:8}}
              onFocus={e=>{e.target.style.borderColor='#00d4c8';e.target.style.boxShadow='0 0 0 3px rgba(0,212,200,0.12)'}} onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.08)';e.target.style.boxShadow='none'}}/>
            {error&&<div style={{fontSize:13,color:'#ff6b6b',margin:'12px 0 0',padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:10}}>{error}</div>}
            <button onClick={handleSendOTP} disabled={!email.includes('@')||!email.includes('.')||loading}
              style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:!email.includes('@')||!email.includes('.')||loading?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#00d4c8,#0099ff)',color:!email.includes('@')||!email.includes('.')||loading?'rgba(255,255,255,0.3)':'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginTop:20,boxShadow:!email.includes('@')||!email.includes('.')||loading?'none':'0 10px 28px -10px rgba(0,212,200,0.45)',transition:'box-shadow 0.2s ease'}}>
              {loading?'Sending...':<>Send Code <ArrowRight size={16} /></>}
            </button>
            <div style={{textAlign:'center',marginTop:16}}>
              <button onClick={()=>{setStep('password');setError('')}} style={{fontSize:11,color:'rgba(255,255,255,0.2)',background:'none',border:'none',cursor:'pointer',padding:0}}>Sign in with password instead</button>
            </div>
          </div>}
          {step==='password'&&<div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:26,margin:'0 0 8px',letterSpacing:'-0.01em'}}>Password sign-in</h1>
            <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 28px',lineHeight:1.5}}>Only accounts an admin has set a password for can use this.</p>
            <label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(255,255,255,0.35)',marginBottom:9}}>Email</label>
            <input type="email" value={pwEmail} onChange={e=>setPwEmail(e.target.value)} placeholder="you@example.com"
              style={{width:'100%',padding:'14px',fontSize:14,background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,color:'#fff',outline:'none',fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box',marginBottom:14}}
              onFocus={e=>{e.target.style.borderColor='#00d4c8'}} onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.08)'}}/>
            <label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(255,255,255,0.35)',marginBottom:9}}>Password</label>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&handlePasswordLogin()}
              style={{width:'100%',padding:'14px',fontSize:14,background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,color:'#fff',outline:'none',fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}
              onFocus={e=>{e.target.style.borderColor='#00d4c8'}} onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.08)'}}/>
            {error&&<div style={{fontSize:13,color:'#ff6b6b',margin:'12px 0 0',padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:10}}>{error}</div>}
            <button onClick={handlePasswordLogin} disabled={!pwEmail||!pw||loading}
              style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:!pwEmail||!pw||loading?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#00d4c8,#0099ff)',color:!pwEmail||!pw||loading?'rgba(255,255,255,0.3)':'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginTop:20,boxShadow:!pwEmail||!pw||loading?'none':'0 10px 28px -10px rgba(0,212,200,0.45)'}}>
              {loading?'Signing in...':<>Sign In <ArrowRight size={16} /></>}
            </button>
            <div style={{textAlign:'center',marginTop:16}}>
              <button onClick={()=>{setStep('email');setError('')}} style={{fontSize:13,color:'#00d4c8',background:'none',border:'none',cursor:'pointer',padding:0,fontWeight:600}}>← Use email code instead</button>
            </div>
          </div>}
          {step==='otp'&&<div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:26,margin:'0 0 8px',letterSpacing:'-0.01em'}}>Check your email</h1>
            <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 4px'}}>Code sent to</p>
            <p style={{color:'#00d4c8',fontSize:14,fontWeight:600,margin:'0 0 8px'}}>{masked}</p>
            <p style={{color:'rgba(255,255,255,0.3)',fontSize:12,margin:'0 0 28px',lineHeight:1.5}}>Not in your inbox within a minute? Check spam/junk - it comes from Supabase, not TheBedBox.</p>
            <label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(255,255,255,0.35)',marginBottom:9}}>Enter 6-digit OTP</label>
            <input type="number" value={otp} onChange={e=>setOtp(e.target.value.slice(0,6))} placeholder="- - - - - -" onKeyDown={e=>e.key==='Enter'&&handleVerifyOTP()}
              style={{width:'100%',padding:'16px',fontSize:24,letterSpacing:'0.3em',textAlign:'center',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,color:'#fff',outline:'none',marginBottom:8,boxSizing:'border-box',fontFamily:"'DM Sans',sans-serif"}}
              onFocus={e=>{e.target.style.borderColor='#00d4c8';e.target.style.boxShadow='0 0 0 3px rgba(0,212,200,0.12)'}} onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.08)';e.target.style.boxShadow='none'}}/>
            {error&&<div style={{fontSize:13,color:'#ff6b6b',marginBottom:16,padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:10}}>{error}</div>}
            <button onClick={handleVerifyOTP} disabled={otp.length<6||loading}
              style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:otp.length<6||loading?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#00d4c8,#0099ff)',color:otp.length<6||loading?'rgba(255,255,255,0.3)':'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginTop:20,marginBottom:18,boxShadow:otp.length<6||loading?'none':'0 10px 28px -10px rgba(0,212,200,0.45)',transition:'box-shadow 0.2s ease'}}>
              {loading?'Verifying...':<>Verify & Continue <ArrowRight size={16} /></>}
            </button>
            <div style={{textAlign:'center'}}>
              {resendTimer>0?<span style={{fontSize:13,color:'rgba(255,255,255,0.3)'}}>Resend in {resendTimer}s</span>:<button onClick={()=>{setStep('email');setOtp('');setError('')}} style={{fontSize:13,color:'#00d4c8',background:'none',border:'none',cursor:'pointer',padding:0,fontWeight:600}}>← Try a different email</button>}
            </div>
          </div>}
        </div>
      </div>

      <div style={{padding:'32px 24px 12px',textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
        <Phone size={12} /> Need help? <a href="tel:+917999546362" style={{color:'rgba(255,255,255,0.45)',fontWeight:600}}>+91 79995 46362</a>
      </div>
      <div style={{padding:'0 24px 28px',textAlign:'center'}}>
        <Link href="/login" style={{fontSize:11,color:'rgba(255,255,255,0.15)',textDecoration:'none'}}>Admin portal</Link>
      </div>
    </div>
  )
}
