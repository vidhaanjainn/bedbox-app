import { Resend } from 'resend'

// Central notification layer (D-004). Every send goes through here so channels
// (email today, WhatsApp/push later) can be added without touching call sites.
// All sends are treated as non-fatal side effects by callers — never throw for
// a missing/misconfigured provider, just skip and log.

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Sender identity. Falls back to the Resend sandbox sender until the domain
// verifies (Resend rejects sends from an unverified domain, so this fails soft).
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'TheBedBox <onboarding@resend.dev>'

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn('sendEmail skipped — RESEND_API_KEY not configured:', opts.subject)
    return { skipped: true }
  }
  if (!opts.to) {
    console.warn('sendEmail skipped — no recipient:', opts.subject)
    return { skipped: true }
  }
  try {
    const { error } = await resend.emails.send({ from: FROM_EMAIL, to: opts.to, subject: opts.subject, html: opts.html })
    if (error) {
      console.error('sendEmail failed:', error)
      return { error }
    }
    return { ok: true }
  } catch (err) {
    console.error('sendEmail threw:', err)
    return { error: err }
  }
}

// WhatsApp via Meta's WhatsApp Cloud API (free tier: Meta does not charge for
// "service" conversations and India-region marketing/utility conversations have
// a free monthly allowance). Requires WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID,
// which only exist once the owner completes Meta's own Business/WhatsApp Platform
// setup — see docs/13_Notifications.md. No-ops safely until then.
export async function sendWhatsApp(opts: { to: string; templateName: string; params?: string[] }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    console.warn('sendWhatsApp skipped — WhatsApp Cloud API not configured yet:', opts.templateName)
    return { skipped: true }
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: opts.to.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: opts.templateName,
          language: { code: 'en' },
          ...(opts.params?.length
            ? { components: [{ type: 'body', parameters: opts.params.map(text => ({ type: 'text', text })) }] }
            : {}),
        },
      }),
    })
    if (!res.ok) {
      console.error('sendWhatsApp failed:', await res.text())
      return { error: true }
    }
    return { ok: true }
  } catch (err) {
    console.error('sendWhatsApp threw:', err)
    return { error: err }
  }
}

export function moneyINR(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

export const emailShell = (title: string, bodyHtml: string) => `
  <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fafaf9; border-radius: 16px; border: 1px solid #eee;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
      <div style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#00d4c8,#0099ff);display:flex;align-items:center;justify-content:center;color:#070d1a;font-weight:700;font-size:14px">B</div>
      <span style="font-weight:700;color:#0f172a;font-size:14px">TheBedBox</span>
    </div>
    <h2 style="color:#0f172a;margin:0 0 16px;font-size:20px">${title}</h2>
    ${bodyHtml}
  </div>
`
