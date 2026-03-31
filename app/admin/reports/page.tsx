'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BarChart3, Loader2, Sparkles, TrendingUp, TrendingDown, RefreshCw, Download, Calendar, AlertCircle, CheckCircle, Brain } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface ReportData {
  month: number
  year: number
  totalBeds: number
  occupiedBeds: number
  occupancyRate: number
  totalRevenue: number
  pendingDues: number
  collectionRate: number
  activeResidents: number
  newResidents: number
  vacated: number
  onNotice: number
  openMaintenance: number
  resolvedMaintenance: number
  shortStayRevenue: number
  avgRent: number
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReport, setAiReport] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [activeTab, setActiveTab] = useState<'overview' | 'ai'>('overview')
  const supabase = createClient()

  useEffect(() => { fetchReport() }, [selectedMonth, selectedYear])

  const fetchReport = async () => {
    setLoading(true)
    setAiReport('')
    try {
      const [
        { data: beds },
        { data: residents },
        { data: rentPayments },
        { data: maintenance },
        { data: notices },
        { data: shortStays },
      ] = await Promise.all([
        supabase.from('beds').select('id, status'),
        supabase.from('residents').select('id, status, rent_amount, date_of_joining, created_at'),
        supabase.from('rent_payments').select('*').eq('month', selectedMonth).eq('year', selectedYear),
        supabase.from('maintenance_requests').select('id, status, created_at'),
        supabase.from('notice_periods').select('id, status, created_at'),
        supabase.from('short_stays').select('*').gte('checkin_date', `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-01`).lt('checkin_date', `${selectedYear}-${String(selectedMonth + 1).padStart(2,'0')}-01`),
      ])

      const totalBeds = beds?.length || 0
      const occupiedBeds = beds?.filter(b => b.status === 'occupied').length || 0
      const activeResidents = residents?.filter(r => r.status === 'active').length || 0
      const onNotice = residents?.filter(r => r.status === 'notice').length || 0

      const monthStart = new Date(selectedYear, selectedMonth - 1, 1)
      const monthEnd = new Date(selectedYear, selectedMonth, 1)
      const newResidents = residents?.filter(r => {
        const d = new Date(r.created_at)
        return d >= monthStart && d < monthEnd
      }).length || 0
      const vacated = residents?.filter(r => r.status === 'vacated').length || 0

      const totalRevenue = rentPayments?.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount_paid, 0) || 0
      const totalDue = rentPayments?.reduce((s, r) => s + r.total_amount, 0) || 0
      const pendingDues = rentPayments?.filter(r => r.status !== 'paid').reduce((s, r) => s + (r.total_amount - r.amount_paid), 0) || 0
      const collectionRate = totalDue > 0 ? Math.round((totalRevenue / totalDue) * 100) : 0

      const avgRent = activeResidents > 0
        ? Math.round((residents?.filter(r => r.status === 'active').reduce((s, r) => s + r.rent_amount, 0) || 0) / activeResidents)
        : 0

      const openMaintenance = maintenance?.filter(m => m.status === 'open' || m.status === 'in_progress').length || 0
      const resolvedMaintenance = maintenance?.filter(m => m.status === 'resolved').length || 0
      const shortStayRevenue = shortStays?.reduce((s, ss) => s + (ss.amount_paid || 0), 0) || 0

      setReportData({
        month: selectedMonth, year: selectedYear,
        totalBeds, occupiedBeds,
        occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        totalRevenue, pendingDues, collectionRate,
        activeResidents, newResidents, vacated, onNotice,
        openMaintenance, resolvedMaintenance,
        shortStayRevenue, avgRent,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const generateAIReport = async () => {
    if (!reportData) return
    setAiLoading(true)
    setAiReport('')
    setActiveTab('ai')

    try {
      const prompt = `You are a smart business advisor for TheBedBox, a co-living PG accommodation in Bhopal, India. Analyse this monthly data and give actionable insights.

MONTHLY DATA — ${MONTHS[reportData.month - 1]} ${reportData.year}:
- Occupancy: ${reportData.occupiedBeds}/${reportData.totalBeds} beds (${reportData.occupancyRate}%)
- Active Residents: ${reportData.activeResidents}
- On Notice Period: ${reportData.onNotice}
- New Move-ins: ${reportData.newResidents}
- Vacated: ${reportData.vacated}
- Monthly Rent Revenue: ₹${reportData.totalRevenue.toLocaleString('en-IN')}
- Short Stay Revenue: ₹${reportData.shortStayRevenue.toLocaleString('en-IN')}
- Total Revenue: ₹${(reportData.totalRevenue + reportData.shortStayRevenue).toLocaleString('en-IN')}
- Pending Dues: ₹${reportData.pendingDues.toLocaleString('en-IN')}
- Rent Collection Rate: ${reportData.collectionRate}%
- Average Rent Per Bed: ₹${reportData.avgRent.toLocaleString('en-IN')}
- Open Maintenance Issues: ${reportData.openMaintenance}
- Resolved Maintenance: ${reportData.resolvedMaintenance}

Provide a structured report in this exact format:

## 📊 Monthly Summary
[2-3 sentence overview of how the month went overall]

## ✅ What Went Well
[3 bullet points of positives]

## ⚠️ Areas of Concern
[3 bullet points of things to watch or fix]

## 💡 Action Items for Next Month
[4 specific, actionable steps Vidhaan should take]

## 🔮 Occupancy Outlook
[Based on Bhopal's seasonal patterns — college admission cycles (MANIT, RGPV, AIIMS Bhopal, NLU), job market, MPPSC exam cycles — give a 1-2 month demand forecast and what Vidhaan should do to fill beds if occupancy is low]

## 💰 Revenue Optimisation
[1-2 specific suggestions to increase revenue — pricing, short stays, retention offers]

Be direct, specific to Bhopal PG market, and use ₹ for all currency. Keep it concise and actionable.`

      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + process.env.NEXT_PUBLIC_GEMINI_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
        })
      })
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate report. Check your Gemini API key.'
      setAiReport(text)
    } catch (err) {
      setAiReport('Error generating AI report. Please check your NEXT_PUBLIC_GEMINI_API_KEY in .env.local')
    } finally {
      setAiLoading(false)
    }
  }

  const renderMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: '24px 0 12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>{line.replace('## ', '')}</h3>
        if (line.startsWith('- ')) return <li key={i} style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', marginLeft: '16px', lineHeight: '1.6' }}>{line.replace('- ', '')}</li>
        if (line.trim() === '') return <br key={i} />
        return <p key={i} style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '6px' }}>{line}</p>
      })
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', borderRadius: '10px', border: '1px solid',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    background: active ? 'rgba(0,212,200,0.1)' : 'transparent',
    borderColor: active ? 'var(--teal-500)' : 'var(--border)',
    color: active ? 'var(--teal-500)' : 'var(--text-muted)',
    display: 'flex', alignItems: 'center', gap: '6px'
  })

  return (
    <div style={{ padding: '32px', maxWidth: '1000px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Reports & Insights
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Monthly performance + AI-powered business intelligence</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            style={{ padding: '8px 14px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            style={{ padding: '8px 14px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
        <button style={tabStyle(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>
          <BarChart3 size={14} /> Overview
        </button>
        <button style={tabStyle(activeTab === 'ai')} onClick={() => setActiveTab('ai')}>
          <Sparkles size={14} /> AI Report
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Loader2 size={28} color="var(--teal-500)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : !reportData ? null : activeTab === 'overview' ? (
        <>
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            {[
              { label: 'Occupancy Rate', value: `${reportData.occupancyRate}%`, sub: `${reportData.occupiedBeds}/${reportData.totalBeds} beds`, color: reportData.occupancyRate >= 80 ? '#34d399' : reportData.occupancyRate >= 60 ? '#fbbf24' : '#f87171' },
              { label: 'Rent Revenue', value: formatCurrency(reportData.totalRevenue), sub: `${reportData.collectionRate}% collected`, color: 'var(--teal-500)' },
              { label: 'Pending Dues', value: formatCurrency(reportData.pendingDues), sub: 'Uncollected', color: reportData.pendingDues > 5000 ? '#f87171' : '#34d399' },
              { label: 'Short Stay Revenue', value: formatCurrency(reportData.shortStayRevenue), sub: 'This month', color: '#a78bfa' },
              { label: 'Active Residents', value: reportData.activeResidents, sub: `${reportData.onNotice} on notice`, color: 'var(--text-primary)' },
              { label: 'Avg Rent / Bed', value: formatCurrency(reportData.avgRent), sub: 'Per month', color: 'var(--text-primary)' },
            ].map((m, i) => (
              <div key={i} className="stat-card" style={{ padding: '18px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>{m.label}</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: '700', color: m.color }}>{m.value}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Resident Movement */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
            <div className="stat-card" style={{ padding: '20px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 16px' }}>Resident Movement</h3>
              {[
                { label: 'New Move-ins', value: reportData.newResidents, color: '#34d399', icon: '↑' },
                { label: 'Vacated', value: reportData.vacated, color: '#f87171', icon: '↓' },
                { label: 'On Notice', value: reportData.onNotice, color: '#fbbf24', icon: '⚠' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.icon} {item.label}</span>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: '700', color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="stat-card" style={{ padding: '20px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 16px' }}>Maintenance</h3>
              {[
                { label: 'Open Issues', value: reportData.openMaintenance, color: '#f87171' },
                { label: 'Resolved', value: reportData.resolvedMaintenance, color: '#34d399' },
                { label: 'Resolution Rate', value: reportData.openMaintenance + reportData.resolvedMaintenance > 0 ? `${Math.round((reportData.resolvedMaintenance / (reportData.openMaintenance + reportData.resolvedMaintenance)) * 100)}%` : '—', color: 'var(--teal-500)' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: '700', color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA to AI Report */}
          <div style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(0,212,200,0.06), rgba(167,139,250,0.06))', border: '1px solid rgba(0,212,200,0.2)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Brain size={18} color="var(--teal-500)" />
                <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Business Report</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Get Gemini AI analysis — occupancy forecast, action items, Bhopal market insights</p>
            </div>
            <button onClick={generateAIReport} className="bb-btn-primary" style={{ gap: '8px', whiteSpace: 'nowrap' }}>
              <Sparkles size={16} /> Generate AI Report
            </button>
          </div>
        </>
      ) : (
        /* AI Report Tab */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>
                AI Report — {MONTHS[selectedMonth - 1]} {selectedYear}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Powered by Gemini AI · Bhopal market context included</p>
            </div>
            <button onClick={generateAIReport} disabled={aiLoading} className="bb-btn-secondary" style={{ gap: '8px' }}>
              {aiLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              {aiLoading ? 'Generating…' : 'Regenerate'}
            </button>
          </div>

          {aiLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '16px' }}>
              <div style={{ width: '52px', height: '52px', background: 'rgba(0,212,200,0.1)', border: '1px solid rgba(0,212,200,0.2)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={24} color="var(--teal-500)" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Gemini is analysing your data…</p>
            </div>
          ) : aiReport ? (
            <div className="stat-card" style={{ padding: '28px', lineHeight: '1.7' }}>
              {renderMarkdown(aiReport)}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <Sparkles size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p>Click "Generate AI Report" to get your monthly business intelligence.</p>
              <button onClick={generateAIReport} className="bb-btn-primary" style={{ marginTop: '16px', gap: '8px' }}>
                <Sparkles size={16} /> Generate Now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
