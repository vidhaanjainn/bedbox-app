import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="bb-empty">
      <Icon size={40} />
      <div className="bb-empty-title">{title}</div>
      {hint && <div className="bb-empty-hint">{hint}</div>}
    </div>
  )
}
