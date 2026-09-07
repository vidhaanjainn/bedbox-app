import type { Metadata } from 'next'
import Link from 'next/link'
import {
  LayoutDashboard, Users, CreditCard, Wrench, Bell, Receipt,
  Home as HomeIcon, ArrowRight, CheckCircle2,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'TheBedBox App | Property Management, Simplified',
  description:
    'One app for property owners to run their PG or hostel, and for residents to handle rent, maintenance, and notices - without the back and forth.',
}

const ownerPoints = [
  'One dashboard for rent, rooms, residents, and staff',
  'Automated rent reminders and digital receipts',
  'Maintenance requests routed to you instantly, WhatsApp-ready for your electrician or plumber',
  'Track staff expenses and electricity costs in one place',
  'Push notifications the moment a resident pays or files a request',
]

const residentPoints = [
  'Pay rent and report payments in seconds, no paperwork',
  'Raise a maintenance request without calling anyone',
  'File your notice to vacate straight from your phone',
  'Digital receipts always available, whenever you need them',
  'Instant push notifications for rent, notices, and updates',
]

function OwnerMockup() {
  return (
    <div style={{ borderRadius: 16, background: '#0d1729', border: '1px solid rgba(0,212,200,0.15)', padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <LayoutDashboard size={14} color="#00d4c8" />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>ADMIN DASHBOARD</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'Monthly Income', value: '₹4.2L' },
          { label: 'Pending Rent', value: '₹18,000' },
        ].map((s) => (
          <div key={s.label} style={{ background: 'rgba(0,212,200,0.06)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f4f7fb', marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { icon: Users, label: 'Residents', value: '48 active' },
          { icon: Wrench, label: 'Maintenance', value: '2 open' },
          { icon: Receipt, label: 'Receipts', value: '6 pending' },
        ].map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
            <r.icon size={13} color="rgba(255,255,255,0.4)" />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', flex: 1 }}>{r.label}</span>
            <span style={{ fontSize: 11, color: '#00d4c8', fontWeight: 600 }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResidentMockup() {
  return (
    <div style={{ borderRadius: 16, background: '#0d1729', border: '1px solid rgba(104,224,176,0.15)', padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <HomeIcon size={14} color="#68e0b0" />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>RESIDENT PORTAL</span>
      </div>
      <div style={{ background: 'rgba(104,224,176,0.08)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Room 204 · Rent due</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f4f7fb' }}>₹7,999</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#131f28', background: '#68e0b0', padding: '4px 10px', borderRadius: 999 }}>Pay Now</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { icon: Wrench, label: 'Fan not working', value: 'In progress' },
          { icon: CheckCircle2, label: 'March receipt', value: 'Ready' },
          { icon: Bell, label: 'Notice period', value: 'Not filed' },
        ].map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
            <r.icon size={13} color="rgba(255,255,255,0.4)" />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', flex: 1 }}>{r.label}</span>
            <span style={{ fontSize: 11, color: '#68e0b0', fontWeight: 600 }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AudienceCard({
  eyebrow, title, points, mockup, ctaLabel, ctaHref, accent,
}: {
  eyebrow: string; title: string; points: string[]; mockup: React.ReactNode
  ctaLabel: string; ctaHref: string; accent: string
}) {
  return (
    <div style={{
      flex: '1 1 380px', minWidth: 300, background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: accent, textTransform: 'uppercase', marginBottom: 8 }}>
        {eyebrow}
      </div>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color: '#f4f7fb', margin: '0 0 18px', letterSpacing: '-0.01em' }}>
        {title}
      </h2>

      <div style={{ marginBottom: 20 }}>{mockup}</div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {points.map((p) => (
          <li key={p} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            <CheckCircle2 size={16} color={accent} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px', borderRadius: 999, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700,
          background: accent, color: '#04120f', textDecoration: 'none',
        }}
      >
        {ctaLabel} <ArrowRight size={16} />
      </Link>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,212,200,0.08), transparent), #05070a',
      fontFamily: "'DM Sans', sans-serif",
      color: '#e8eaf0',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', color: '#00d4c8', textTransform: 'uppercase', marginBottom: 12 }}>
            TheBedBox
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700, color: '#f4f7fb', margin: '0 0 14px', letterSpacing: '-0.01em' }}>
            Running or living in a PG,<br />without the back and forth.
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            One app for property owners to run everything, and for residents to handle rent,
            maintenance, and notices, without a single phone call.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center', marginTop: 40 }}>
          <AudienceCard
            eyebrow="For Property Owners"
            title="Run your property from your pocket."
            points={ownerPoints}
            mockup={<OwnerMockup />}
            ctaLabel="Property Owner Login"
            ctaHref="/login"
            accent="#00d4c8"
          />
          <AudienceCard
            eyebrow="For Residents"
            title="Everything about your stay, in one place."
            points={residentPoints}
            mockup={<ResidentMockup />}
            ctaLabel="I'm a Resident"
            ctaHref="/portal"
            accent="#68e0b0"
          />
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 48 }}>
          © {new Date().getFullYear()} TheBedBox. Tap either button above to sign in - your
          browser will offer to install the app to your home screen automatically.
        </p>
      </div>
    </div>
  )
}
