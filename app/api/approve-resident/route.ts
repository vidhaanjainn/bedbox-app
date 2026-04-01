import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { residentName, residentEmail, residentMobile } = await req.json()

  await resend.emails.send({
    from: 'TheBedBox <onboarding@resend.dev>',
    to: residentEmail,
    subject: `Welcome to TheBedBox, ${residentName.split(' ')[0]}! 🎉`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #070d1a; border-radius: 12px; color: #fff;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #00d4c8, #0099ff); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #070d1a; margin-bottom: 24px;">B</div>
        <h2 style="margin: 0 0 8px; font-size: 22px;">You're approved, ${residentName.split(' ')[0]}! 🎉</h2>
        <p style="color: rgba(255,255,255,0.6); margin: 0 0 28px; line-height: 1.6;">Your onboarding is complete and your room at TheBedBox is ready. You can now log into your resident portal.</p>
        <a href="https://bedbox-app-alpha.vercel.app/portal" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #00d4c8, #0099ff); color: #070d1a; font-weight: 700; text-decoration: none; border-radius: 10px; font-size: 15px; margin-bottom: 24px;">
          Log into Portal →
        </a>
        <div style="background: rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; margin-bottom: 24px;">
          <div style="font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">How to log in</div>
          <div style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.8;">
            1. Open the portal link above<br/>
            2. Enter your mobile number: <strong style="color: #fff;">${residentMobile}</strong><br/>
            3. You'll receive an OTP on this email<br/>
            4. Enter the OTP and you're in
          </div>
        </div>
        <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">Questions? Call us on <a href="tel:+917999546362" style="color: #00d4c8;">+91 79995 46362</a></p>
      </div>
    `,
  })

  return NextResponse.json({ success: true })
}
