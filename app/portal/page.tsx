'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Phone } from 'lucide-react'

export default function PortalLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<'mobile'|'otp'>('mobile')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)

  const startResendTimer = () => {
    setResendTimer(30)
    const interval = setInterval(()=>setResendTimer(t=>{if(t<=1){clearInterval(interval);return 0}return t-1}),1000)
  }

  const handleSendOTP = async () => {
    setError(''); setLoading(true)
    const clean = mobile.replace(/\s/g,'').replace('+91','')

    let residentEmail = ''
    try {
      const res = await fetch('/api/ensure-portal-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: clean }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Could not send OTP. Please try again.'); setLoading(false); return }
      residentEmail = json.email
    } catch {
      setError('Could not send OTP. Please try again.'); setLoading(false); return
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: residentEmail,
      options: { shouldCreateUser: false },
    })
    if (otpError) { setError('Could not send OTP. Please try again.'); setLoading(false); return }
    setEmail(residentEmail); setStep('otp'); startResendTimer(); setLoading(false)
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
        <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:56}}>
          <div style={{width:38,height:38,borderRadius:11,background:'linear-gradient(135deg,#00d4c8,#0099ff)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:'#070d1a',boxShadow:'0 6px 20px -6px rgba(0,212,200,0.5)'}}>B</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:'#f4f7fb',letterSpacing:'-0.01em'}}>TheBedBox</span>
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
          {step==='mobile'&&<div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:26,margin:'0 0 8px',letterSpacing:'-0.01em'}}>Welcome back</h1>
            <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 32px',lineHeight:1.5}}>Enter your registered mobile number to sign in</p>
            <label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(255,255,255,0.35)',marginBottom:9}}>Mobile number</label>
            <div style={{display:'flex',marginBottom:8}}>
              <div style={{padding:'14px 14px',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.08)',borderRight:'none',borderRadius:'12px 0 0 12px',fontSize:14,color:'rgba(255,255,255,0.45)',fontWeight:500}}>+91</div>
              <input type="tel" value={mobile} onChange={e=>setMobile(e.target.value)} placeholder="98765 43210" maxLength={10} onKeyDown={e=>e.key==='Enter'&&handleSendOTP()}
                style={{flex:1,padding:'14px',fontSize:15,letterSpacing:'0.03em',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'0 12px 12px 0',color:'#fff',outline:'none',fontFamily:"'DM Sans',sans-serif"}}
                onFocus={e=>{e.target.style.borderColor='#00d4c8';e.target.style.boxShadow='0 0 0 3px rgba(0,212,200,0.12)'}} onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.08)';e.target.style.boxShadow='none'}}/>
            </div>
            {error&&<div style={{fontSize:13,color:'#ff6b6b',margin:'12px 0 0',padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:10}}>{error}</div>}
            <button onClick={handleSendOTP} disabled={mobile.replace(/\s/g,'').length<10||loading}
              style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:mobile.replace(/\s/g,'').length<10||loading?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#00d4c8,#0099ff)',color:mobile.replace(/\s/g,'').length<10||loading?'rgba(255,255,255,0.3)':'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginTop:20,boxShadow:mobile.replace(/\s/g,'').length<10||loading?'none':'0 10px 28px -10px rgba(0,212,200,0.45)',transition:'box-shadow 0.2s ease'}}>
              {loading?'Sending...':<>Send OTP <ArrowRight size={16} /></>}
            </button>
          </div>}
          {step==='otp'&&<div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:26,margin:'0 0 8px',letterSpacing:'-0.01em'}}>Check your email</h1>
            <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 4px'}}>OTP sent to</p>
            <p style={{color:'#00d4c8',fontSize:14,fontWeight:600,margin:'0 0 28px'}}>{masked}</p>
            <label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(255,255,255,0.35)',marginBottom:9}}>Enter 6-digit OTP</label>
            <input type="number" value={otp} onChange={e=>setOtp(e.target.value.slice(0,6))} placeholder="— — — — — —" onKeyDown={e=>e.key==='Enter'&&handleVerifyOTP()}
              style={{width:'100%',padding:'16px',fontSize:24,letterSpacing:'0.3em',textAlign:'center',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,color:'#fff',outline:'none',marginBottom:8,boxSizing:'border-box',fontFamily:"'DM Sans',sans-serif"}}
              onFocus={e=>{e.target.style.borderColor='#00d4c8';e.target.style.boxShadow='0 0 0 3px rgba(0,212,200,0.12)'}} onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.08)';e.target.style.boxShadow='none'}}/>
            {error&&<div style={{fontSize:13,color:'#ff6b6b',marginBottom:16,padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:10}}>{error}</div>}
            <button onClick={handleVerifyOTP} disabled={otp.length<6||loading}
              style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:otp.length<6||loading?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#00d4c8,#0099ff)',color:otp.length<6||loading?'rgba(255,255,255,0.3)':'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginTop:20,marginBottom:18,boxShadow:otp.length<6||loading?'none':'0 10px 28px -10px rgba(0,212,200,0.45)',transition:'box-shadow 0.2s ease'}}>
              {loading?'Verifying...':<>Verify & Continue <ArrowRight size={16} /></>}
            </button>
            <div style={{textAlign:'center'}}>
              {resendTimer>0?<span style={{fontSize:13,color:'rgba(255,255,255,0.3)'}}>Resend in {resendTimer}s</span>:<button onClick={()=>{setStep('mobile');setOtp('');setError('')}} style={{fontSize:13,color:'#00d4c8',background:'none',border:'none',cursor:'pointer',padding:0,fontWeight:600}}>← Try a different number</button>}
            </div>
          </div>}
        </div>
      </div>

      <div style={{padding:'32px 24px',textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
        <Phone size={12} /> Need help? <a href="tel:+917999546362" style={{color:'rgba(255,255,255,0.45)',fontWeight:600}}>+91 79995 46362</a>
      </div>
    </div>
  )
}
