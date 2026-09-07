'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { BedBoxLogo } from '@/components/brand/BedBoxLogo'

export default function LoginPageClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Already signed in (e.g. opening the installed Admin icon with a persisted
  // session) - skip the form entirely instead of asking to log in again.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { router.replace('/admin/dashboard') } else { setCheckingSession(false) }
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/admin/dashboard')
    router.refresh()
  }

  const shell: React.CSSProperties = {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,212,200,0.08), transparent), #05070a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: "'DM Sans', sans-serif",
  }

  if (checkingSession) {
    return <div style={{ ...shell, color: 'rgba(255,255,255,0.3)', fontSize: 13, letterSpacing: '0.05em' }}>AUTHENTICATING…</div>
  }

  return (
    <div style={shell}>
      {/* Faint structural grid - reads as a console, not a consumer app */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(0,212,200,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,200,0.035) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 70% 50% at 50% 20%, black, transparent)',
      }} />

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '380px', position: 'relative' }}>
        {/* Mark */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ display: 'inline-flex', marginBottom: '20px' }}>
            <BedBoxLogo height={40} surface="dark" />
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 700, color: '#f4f7fb', margin: 0, letterSpacing: '-0.01em' }}>
            Admin Console
          </h1>
        </div>

        {/* Card */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '18px',
          padding: '32px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 48px -24px rgba(0,0,0,0.6)',
        }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@thebedbox.in"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '13px 14px 13px 40px', borderRadius: '11px', fontSize: '14px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f7fb', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                  onFocus={e => { e.target.style.borderColor = 'var(--teal-500)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,212,200,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '13px 40px 13px 40px', borderRadius: '11px', fontSize: '14px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f7fb', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                  onFocus={e => { e.target.style.borderColor = 'var(--teal-500)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,212,200,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#f87171' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', borderRadius: '11px', fontSize: '14px', fontWeight: 700,
              background: loading ? 'rgba(255,255,255,0.08)' : 'var(--teal-500)',
              color: loading ? 'rgba(255,255,255,0.3)' : '#04120f',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'box-shadow 0.2s ease, transform 0.15s ease',
              boxShadow: loading ? 'none' : '0 8px 24px -8px rgba(0,212,200,0.4)',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <>Enter Console <ArrowRight size={15} /></>}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>
          Residents use the link sent to their email, not this page.
        </p>
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <Link href="/portal" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
            Login to resident portal instead →
          </Link>
        </div>
      </div>
    </div>
  )
}
