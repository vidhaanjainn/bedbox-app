import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

// Your Google Sheet ID — update via GOOGLE_SHEET_ID env var if you ever change sheets
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1Nz1daHvT4w5RyrYxkLlrEYrWtjjBvYJetwGdMo85FAs'

// Column order that matches your existing sheet structure:
// Name | Phone 1 | Phone 2 | Email | Room Type | Institution | Course/Program | Duration | Hometown | Message | Submitted At
const sheetRow = (data: Record<string, string>) => [
  data.name,
  data.mobile,
  data.altMobile || '',
  data.email || '',
  data.roomType || '',
  data.institution || '',
  data.course || '',
  data.duration || '',
  data.hometown || '',
  data.message || '',
  new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
]

async function appendToSheet(data: Record<string, string>) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key   = process.env.GOOGLE_PRIVATE_KEY

  if (!email || !key) {
    console.warn('Google Sheets not configured — skipping sheet append. Add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY to env vars.')
    return { skipped: true }
  }

  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:K',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [sheetRow(data)] },
  })

  return { ok: true }
}

async function saveToSupabase(data: Record<string, string>) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const notes = [
    data.institution && `Institution: ${data.institution}`,
    data.course      && `Course: ${data.course}`,
    data.hometown    && `Hometown: ${data.hometown}`,
    data.altMobile   && `Alt mobile: ${data.altMobile}`,
    data.message     && `Message: ${data.message}`,
  ].filter(Boolean).join(' | ')

  const { error } = await supabase.from('bookings').insert({
    full_name:  data.name,
    mobile:     data.mobile,
    email:      data.email || null,
    occupation: [data.institution, data.course].filter(Boolean).join(', ') || null,
    duration:   data.duration || null,
    status:     'inquiry',
    notes:      notes || null,
  })

  if (error) throw error
}

async function notifyAdmin(data: Record<string, string>) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'thebedbox.in@gmail.com',
        subject: `📥 New Room Inquiry — ${data.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#070d1a;color:#e8eaf0;padding:32px;border-radius:16px">
            <h2 style="color:#00d4c8;margin:0 0 24px;font-size:20px">New Booking Inquiry</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              ${[
                ['Name',        data.name],
                ['Mobile',      data.mobile],
                ['Alt Mobile',  data.altMobile || '—'],
                ['Email',       data.email     || '—'],
                ['Room Type',   data.roomType  || '—'],
                ['Institution', data.institution || '—'],
                ['Course',      data.course    || '—'],
                ['Duration',    data.duration  || '—'],
                ['Hometown',    data.hometown  || '—'],
                ['Message',     data.message   || '—'],
              ].map(([label, value]) => `
                <tr>
                  <td style="padding:8px 0;color:rgba(255,255,255,0.45);width:120px;vertical-align:top">${label}</td>
                  <td style="padding:8px 0;color:#e8eaf0;font-weight:600">${value}</td>
                </tr>
              `).join('')}
            </table>
            <div style="margin-top:28px;padding:14px 18px;background:rgba(0,212,200,0.08);border-radius:10px;border:1px solid rgba(0,212,200,0.2);font-size:13px;color:rgba(255,255,255,0.5)">
              Submitted at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST ·
              Also recorded in your <a href="https://docs.google.com/spreadsheets/d/${SHEET_ID}" style="color:#00d4c8">Google Sheet</a>
            </div>
          </div>
        `,
      }),
    })
  } catch (err) {
    console.error('Admin email failed (non-fatal):', err)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, mobile } = body

    // Validate required fields
    if (!name?.trim() || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }
    if (!mobile || mobile.replace(/\D/g, '').length !== 10) {
      return NextResponse.json({ error: 'A valid 10-digit mobile number is required.' }, { status: 400 })
    }

    const data = {
      name:        name.trim(),
      mobile:      mobile.replace(/\D/g, ''),
      altMobile:   (body.altMobile || '').replace(/\D/g, ''),
      email:       (body.email || '').trim().toLowerCase(),
      roomType:    body.roomType || '',
      institution: (body.institution || '').trim(),
      course:      (body.course || '').trim(),
      duration:    body.duration || '',
      hometown:    (body.hometown || '').trim(),
      message:     (body.message || '').trim(),
    }

    // Run all three in parallel — sheet and email failures are non-fatal
    const [supabaseResult, sheetResult] = await Promise.allSettled([
      saveToSupabase(data),
      appendToSheet(data),
      notifyAdmin(data),        // fire-and-forget, result ignored
    ])

    // Supabase is the source of truth — fail if it fails
    if (supabaseResult.status === 'rejected') {
      console.error('Supabase insert failed:', supabaseResult.reason)
      return NextResponse.json(
        { error: 'Could not save your inquiry. Please try again or call us directly.' },
        { status: 500 }
      )
    }

    // Sheet failure is non-fatal (service account might not be set up yet)
    if (sheetResult.status === 'rejected') {
      console.error('Google Sheets append failed (non-fatal):', sheetResult.reason)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('booking-form error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
