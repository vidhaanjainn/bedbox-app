# 09 — Component Architecture

## Today
No shared component layer: each page is a self-contained client component with inline UI
(residents/new = 570 lines). Radix primitives installed but used ad hoc. This is the root cause
of UI inconsistency.

## Target (built via UX-01/02)
```
components/
  ui/        Button, Input, Select, Card, StatusBadge, StatCard, EmptyState,
             Skeleton, ConfirmDialog, Toast (Radix-wrapped, token-styled)
  layout/    PageHeader (title+actions), AdminShell, PortalShell (bottom nav)
  domain/    ResidentCard, RentRow, PaymentModeIcon, MoneyText (₹, tabular-nums)
lib/tokens (Tailwind theme in globals.css @theme — teal palette, spacing, radius)
```

## Rules
- New UI goes through `components/ui`; refactor old pages opportunistically per UX task
- One StatusBadge maps every status enum → color+label (single file to update)
- Pages stay client components for now; extract data hooks (`lib/hooks/useResidents.ts`) only
  when a query is needed in 2+ places — no premature abstraction
- Forms: chunked sections, validate on blur, disable submit while pending, toast on result
