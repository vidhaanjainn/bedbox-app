import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { syncSheetSnapshot } from '@/lib/sheets'

// One-click "sync current dues to Google Sheets" for the admin Rent Tracker page.
// Auth: caller must be a logged-in admin (checked server-side via is_active admins row).
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: adminRow } = await admin.from('admins').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!adminRow) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { month, year } = await req.json()
  const m = Number(month) || new Date().getMonth() + 1
  const y = Number(year) || new Date().getFullYear()

  const { data: rows, error } = await admin
    .from('rent_payments')
    .select('total_amount, amount_paid, status, resident_id, residents(name, mobile, room_number)')
    .eq('month', m)
    .eq('year', y)
    .order('status')

  if (error) return NextResponse.json({ error: 'Could not load rent data.' }, { status: 500 })

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const sheetRows = (rows || []).map((r: any) => [
    r.residents?.name || '',
    r.residents?.mobile || '',
    r.residents?.room_number || '',
    Number(r.total_amount) || 0,
    Number(r.amount_paid) || 0,
    Math.max(0, Number(r.total_amount) - Number(r.amount_paid)),
    r.status,
  ])

  const result = await syncSheetSnapshot({
    tabName: `Rent Dues ${monthNames[m - 1]} ${y}`,
    header: ['Name', 'Mobile', 'Room', 'Total Due', 'Paid', 'Outstanding', 'Status'],
    rows: sheetRows,
  })

  if ('skipped' in result) return NextResponse.json({ error: result.reason }, { status: 400 })
  if ('error' in result) return NextResponse.json({ error: 'Sync failed. Check server logs.' }, { status: 500 })
  return NextResponse.json({ success: true, url: result.url, count: sheetRows.length })
}
