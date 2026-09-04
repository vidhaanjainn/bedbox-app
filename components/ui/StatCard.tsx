export function StatCard({ label, value, color = 'var(--teal-500)' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: '20px', fontWeight: '700', color, fontFamily: 'Syne, sans-serif' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
    </div>
  )
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>{children}</div>
}
