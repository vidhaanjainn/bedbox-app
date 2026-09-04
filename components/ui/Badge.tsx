type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`status-badge is-${tone}`}>{children}</span>
}

// Common status → tone mappings so pages stop re-deriving this per file.
export const STATUS_TONE: Record<string, Tone> = {
  active: 'success', paid: 'success', resolved: 'success', full: 'neutral',
  pending: 'warning', partial: 'warning', notice: 'warning', available: 'info',
  overdue: 'danger', vacated: 'neutral', open: 'danger', cancelled: 'neutral',
}
