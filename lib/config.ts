// Single source of truth for the app's own public URL - used everywhere a
// link gets generated, not just server-side. Residents are handed links on
// this domain constantly (portal login, onboarding invites), so this must
// never resolve to the raw Vercel URL, which happened whenever an admin
// generated a link while browsing the app from bedbox-app-alpha.vercel.app
// instead of the custom domain (a couple of admin pages used
// window.location.origin directly instead of this constant - fixed to use
// this everywhere instead, so which URL an admin happens to be on can never
// leak into a link a resident receives).
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.thebedbox.in'
