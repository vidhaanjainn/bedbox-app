import { X } from 'lucide-react'

export function Modal({ children, onClose, title, maxWidth = '460px' }: { children: React.ReactNode; onClose: () => void; title: string; maxWidth?: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }} onClick={onClose}>
      <div className="glass-card" style={{ width: '100%', maxWidth, padding: '28px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
          <button onClick={onClose} className="bb-icon-btn" aria-label="Close" style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FormField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>{label}</label>
      <input className="bb-input" type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
