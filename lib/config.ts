// Single source of truth for the app's own public URL, used in emails and
// links that must work outside a request context (server-side, no
// window.location to fall back on). Set NEXT_PUBLIC_APP_URL once the
// custom domain is fully live; until then this defaults to the working
// Vercel URL rather than silently pointing at whatever the wrong hardcoded
// domain used to be.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bedbox-app-alpha.vercel.app'
