import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays, addMonths } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatMonth(month: number, year: number): string {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy')
}

export function calculateLateFee(daysLate: number): number {
  return Math.max(0, daysLate) * 200
}

export function calculateNoticePeriodEnd(noticeDate: string): string {
  return format(addMonths(new Date(noticeDate), 2), 'yyyy-MM-dd')
}

export function getDaysRemaining(endDate: string): number {
  return differenceInDays(new Date(endDate), new Date())
}

export function getOccupancyColor(rate: number): string {
  if (rate >= 90) return 'text-emerald-400'
  if (rate >= 70) return 'text-teal-400'
  if (rate >= 50) return 'text-amber-400'
  return 'text-red-400'
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    notice: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    vacated: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    open: 'bg-red-500/20 text-red-400 border-red-500/30',
    in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    available: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    occupied: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    maintenance: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }
  return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-slate-500/20 text-slate-400',
    medium: 'bg-amber-500/20 text-amber-400',
    high: 'bg-orange-500/20 text-orange-400',
    urgent: 'bg-red-500/20 text-red-400',
  }
  return colors[priority] || 'bg-slate-500/20 text-slate-400'
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const STAY_DURATIONS = [
  '1-3 months', '3-6 months', '6-12 months', '12+ months'
]

export const MAINTENANCE_CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing', icon: '🔧' },
  { value: 'electrical', label: 'Electrical', icon: '⚡' },
  { value: 'carpentry', label: 'Carpentry', icon: '🪚' },
  { value: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { value: 'appliance', label: 'Appliance', icon: '📱' },
  { value: 'other', label: 'Other', icon: '❓' },
]
