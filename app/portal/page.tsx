'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
    const { data: resident, error: fetchError } = await supabase.from('residents').select('email,onboarding_status').eq('mobile',clean).single()
    if (fetchError||!resident) { setError('No resident found with this mobile. Contact TheBedBox.'); setLoading(false); return }
    if (resident.onboarding_status!=='active') { setError('Your account is not yet active. Contact TheBedBox.'); setLoading(false); return }
    const { error: otpError } = await supabase.auth.signInWithOtp({ email: resident.email, options: { shouldCreateUser: false } })
    if (otpError) { setError('Could not send OTP. Please try again.'); setLoading(false); return }
    setEmail(resident.email); setStep('otp'); startResendTimer(); setLoading(false)
  }

  const handleVerifyOTP = async () => {
    setError(''); setLoading(true)
    const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
    if (verifyError||!data.session) { setError('Invalid or expired OTP. Try again.'); setLoading(false); return }
    router.push('/portal/home')
  }

  const masked = email.replace(/(.{2})(.*)(@.*)/,(_,a,b,c)=>a+'*'.repeat(Math.max(2,b.length-2))+b.slice(-1)+c)

  return (
    <div style={{minHeight:'100vh',background:'#070d1a',fontFamily:"'DM Sans',sans-serif",color:'#e8eaf0',display:'flex',flexDirection:'column'}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
      <div style={{padding:'28px 24px 0',maxWidth:420,margin:'0 auto',width:'100%'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:48}}>
          <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#00d4c8,#0099ff)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:'#070d1a'}}>B</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:15,color:'#00d4c8'}}>TheBedBox</span>
        </div>
      </div>
      <div style={{flex:1,padding:'0 24px',maxWidth:420,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>
        {step==='mobile'&&<div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:28,margin:'0 0 8px'}}>Resident login</h1>
          <p style={{color:'rgba(255,255,255,0.4)',fontSize:15,margin:'0 0 36px'}}>Enter your registered mobile number</p>
          <label style={{display:'block',fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:8}}>Mobile number</label>
          <div style={{display:'flex',marginBottom:8}}>
            <div style={{padding:'14px 12px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRight:'none',borderRadius:'10px 0 0 10px',fontSize:14,color:'rgba(255,255,255,0.5)'}}>+91</div>
            <input type="tel" value={mobile} onChange={e=>setMobile(e.target.value)} placeholder="98765 43210" maxLength={10} onKeyDown={e=>e.key==='Enter'&&handleSendOTP()}
              style={{flex:1,padding:'14px',fontSize:14,letterSpacing:'0.05em',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0 10px 10px 0',color:'#fff',outline:'none'}}
              onFocus={e=>e.target.style.borderColor='#00d4c8'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}/>
          </div>
          {error&&<div style={{fontSize:13,color:'#ff6b6b',marginBottom:16,padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:8}}>{error}</div>}
          <button onClick={handleSendOTP} disabled={mobile.replace(/\s/g,'').length<10||loading}
            style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:600,background:mobile.replace(/\s/g,'').length<10||loading?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#00d4c8,#0099ff)',color:mobile.replace(/\s/g,'').length<10||loading?'rgba(255,255,255,0.3)':'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginTop:8}}>
            {loading?'Checking...':'Send OTP →'}
          </button>
        </div>}
        {step==='otp'&&<div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:28,margin:'0 0 8px'}}>Check your email</h1>
          <p style={{color:'rgba(255,255,255,0.4)',fontSize:15,margin:'0 0 6px'}}>OTP sent to</p>
          <p style={{color:'#00d4c8',fontSize:15,fontWeight:500,margin:'0 0 32px'}}>{masked}</p>
          <label style={{display:'block',fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:8}}>Enter 6-digit OTP</label>
          <input type="number" value={otp} onChange={e=>setOtp(e.target.value.slice(0,6))} placeholder="— — — — — —" onKeyDown={e=>e.key==='Enter'&&handleVerifyOTP()}
            style={{width:'100%',padding:'16px',fontSize:24,letterSpacing:'0.3em',textAlign:'center',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,color:'#fff',outline:'none',marginBottom:8,boxSizing:'border-box',fontFamily:"'DM Sans',sans-serif"}}
            onFocus={e=>e.target.style.borderColor='#00d4c8'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}/>
          {error&&<div style={{fontSize:13,color:'#ff6b6b',marginBottom:16,padding:'10px 12px',background:'rgba(255,107,107,0.08)',borderRadius:8}}>{error}</div>}
          <button onClick={handleVerifyOTP} disabled={otp.length<6||loading}
            style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:600,background:otp.length<6||loading?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#00d4c8,#0099ff)',color:otp.length<6||loading?'rgba(255,255,255,0.3)':'#070d1a',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginBottom:16}}>
            {loading?'Verifying...':'Verify & Login →'}
          </button>
          <div style={{textAlign:'center'}}>
            {resendTimer>0?<span style={{fontSize:13,color:'rgba(255,255,255,0.3)'}}>Resend in {resendTimer}s</span>:<button onClick={()=>{setStep('mobile');setOtp('');setError('')}} style={{fontSize:13,color:'#00d4c8',background:'none',border:'none',cursor:'pointer',padding:0}}>← Try again</button>}
          </div>
        </div>}
      </div>
      <div style={{padding:'24px',textAlign:'center',color:'rgba(255,255,255,0.2)',fontSize:12}}>Need help? Call <a href="tel:+917999546362" style={{color:'rgba(255,255,255,0.4)'}}>+91 79995 46362</a></div>
    </div>
  )
}
