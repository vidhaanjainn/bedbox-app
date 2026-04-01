import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { residentName, residentEmail, residentMobile, residentRoom } = await req.json()

  await resend.emails.send({
    from: 'TheBedBox <onboarding@resend.dev>',
    to: 'thebedbox.in@gmail.com',
    subject: `✅ ${residentName} has completed onboarding`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
        <h2 style="color: #070d1a; margin: 0 0 8px;">New onboarding submission</h2>
        <p style="color: #666; margin: 0 0 24px;">A resident has completed their onboarding and is awaiting your approval.</p>
        <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden;">
          <tr style="border-bottom: 1px solid #eee;"><td style="padding: 12px 16px; color: #999; font-size: 13px;">Name</td><td style="padding: 12px 16px; font-weight: 600;">${residentName}</td></tr>
          <tr style="border-bottom: 1px solid #eee;"><td style="padding: 12px 16px; color: #999; font-size: 13px;">Mobile</td><td style="padding: 12px 16px;">${residentMobile}</td></tr>
          <tr style="border-bottom: 1px solid #eee;"><td style="padding: 12px 16px; color: #999; font-size: 13px;">Email</td><td style="padding: 12px 16px;">${residentEmail}</td></tr>
          <tr><td style="padding: 12px 16px; color: #999; font-size: 13px;">Room</td><td style="padding: 12px 16px;">${residentRoom || 'Not assigned yet'}</td></tr>
        </table>
        <a href="https://bedbox-app-alpha.vercel.app/admin/residents" style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #00d4c8; color: #070d1a; font-weight: 700; text-decoration: none; border-radius: 8px;">
          Review in Dashboard →
        </a>
      </div>
    `,
  })

  return NextResponse.json({ success: true })
}
