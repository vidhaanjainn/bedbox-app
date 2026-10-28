/*
 * Resilience regression check - run after changing anything in lib/supabase/,
 * proxy.ts, next.config.ts, the admin layout, login or dashboard:
 *
 *   node scripts/resilience-check.cjs
 *
 * Builds the app against a fake Supabase (this script) and drives it with a
 * real browser (Playwright must be installed) through the failures that used
 * to leave the admin app hanging:
 *   A. direct route to Supabase blocked  -> login + dashboard still work via /sb
 *   B. database fully down               -> clear error, never a hang, never zeros
 *   C. database returns temporary 500s   -> reads retry and recover
 *   D. signed in with a non-admin account -> clear "not an admin" screen, not empty data
 *   E. app scripts fail to load (what a black screen is) -> visible recovery message after 10s
 * Exits non-zero if any case fails.
 */
const http = require('http')
const { spawn, execSync } = require('child_process')
const { chromium } = require('playwright')

const FAKE = 4010
const APP = 41000 + Math.floor(Math.random() * 8000)   // fresh port each run: a leftover server can never be mistaken for ours

// `next start` spawns a child server that survives killing its parent, so
// kill whatever is listening on our port instead.
function killPort(port) {
  try {
    const out = execSync(`ss -ltnp "sport = :${port}" 2>/dev/null || true`).toString()
    const pids = [...out.matchAll(/pid=(\d+)/g)].map(m => m[1])
    if (!pids.length) pids.push(...execSync(`lsof -ti tcp:${port} 2>/dev/null || true`).toString().split(/\s+/).filter(Boolean))
    pids.forEach(pid => { try { process.kill(Number(pid)) } catch {} })
  } catch {}
}
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'a@b.c', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }

let mode = 'ok'           // ok | down | flaky
let flakyLeft = 0
let isAdmin = true        // what rpc/is_admin answers
const seen = []           // paths the fake database received

const fake = http.createServer((req, res) => {
  seen.push(req.url)
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' }
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  if (mode === 'down') { res.writeHead(503, cors); return res.end('{}') }
  if (req.url.startsWith('/rest/v1/rpc/is_admin')) { res.writeHead(200, cors); return res.end(JSON.stringify(isAdmin)) }
  if (req.url.startsWith('/rest/v1/') && mode === 'flaky' && flakyLeft > 0) { flakyLeft--; res.writeHead(500, cors); return res.end('{"code":"57014"}') }
  if (req.url.startsWith('/auth/v1/token')) {
    res.writeHead(200, cors)
    return res.end(JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }))
  }
  if (req.url.startsWith('/auth/v1/user')) { res.writeHead(200, cors); return res.end(JSON.stringify(user)) }
  if (req.url.startsWith('/auth/v1/health')) { res.writeHead(200, cors); return res.end('{}') }
  res.writeHead(200, { ...cors, 'content-range': '0-0/0' }); res.end('[]')
})

const results = []
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  - ' + extra : ''}`) }

function watch(page, tag) {
  if (!process.env.DEBUG) return
  page.on('pageerror', e => console.log(`[${tag}] PAGEERROR`, String(e).slice(0, 300)))
  page.on('console', m => { if (m.type() === 'error') console.log(`[${tag}] console.error`, m.text().slice(0, 200)) })
}

async function login(page) {
  await page.goto(`http://localhost:${APP}/login`)
  await page.waitForSelector('input[type=email]', { timeout: 20000 })
  await page.fill('input[type=email]', 'a@b.c')
  await page.fill('input[type=password]', 'secret1')
  await page.click('button[type=submit]')
}

;(async () => {
  await new Promise(r => fake.listen(FAKE, r))
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${FAKE}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon', RESEND_API_KEY: 're_x', SUPABASE_SERVICE_ROLE_KEY: 'x' }
  console.log('building...')
  if (!process.env.SKIP_BUILD) execSync('npx next build', { env, stdio: 'ignore' })
  // detached => own process group, so the whole tree (npx -> next-server) can be killed
  const server = spawn('npx', ['next', 'start', '-p', String(APP)], { env, stdio: 'ignore', detached: true })
  await new Promise(r => setTimeout(r, 6000))
  const browser = await chromium.launch()

  try {
    // A. direct route blocked
    {
      const ctx = await browser.newContext(); const page = await ctx.newPage(); watch(page, 'A')
      await ctx.route(`http://127.0.0.1:${FAKE}/**`, r => r.abort())   // browser cannot reach Supabase directly
      seen.length = 0; mode = 'ok'
      await login(page)
      await page.waitForURL('**/admin/dashboard', { timeout: 30000 }).catch(() => {})
      check('A1 login succeeds with direct route blocked', page.url().includes('/admin/dashboard'))
      const greeted = await page.getByText(/Good (morning|afternoon|evening)/).first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false)
      check('A2 dashboard loads data through the backup route', greeted)
      check('A3 requests reached the database via /sb', seen.some(p => p.startsWith('/auth/v1/token')) && seen.some(p => p.startsWith('/rest/v1/')))
      await ctx.close()
    }
    // B. database fully down
    {
      const ctx = await browser.newContext(); const page = await ctx.newPage()
      mode = 'down'
      const t = Date.now()
      await login(page)
      const msg = await page.getByText(/Can't reach the server|timed out|went wrong/i).first().waitFor({ timeout: 60000 }).then(() => true).catch(() => false)
      const brace = await page.getByText(/^\{\}$/).count()
      check('B1 login shows a clear error when the database is down', msg && brace === 0, `${Math.round((Date.now() - t) / 1000)}s`)
      check('B2 sign-in button is usable again (not spinning forever)', await page.locator('button[type=submit]').isEnabled())
      await ctx.close()
    }
    // C. temporary 500s on reads recover by retry
    {
      const ctx = await browser.newContext(); const page = await ctx.newPage()
      mode = 'ok'
      await login(page)
      await page.waitForURL('**/admin/dashboard', { timeout: 30000 }).catch(() => {})
      mode = 'flaky'; flakyLeft = 4
      await page.reload()
      const ok = await page.getByText(/Good (morning|afternoon|evening)/).first().waitFor({ timeout: 45000 }).then(() => true).catch(() => false)
      check('C1 dashboard recovers from temporary database 500s', ok)
      // persistent failure: must show an error card, not zeros
      mode = 'down'
      await page.reload()
      const errCard = await page.getByText("Couldn't load the dashboard").waitFor({ timeout: 60000 }).then(() => true).catch(() => false)
      const zeros = await page.getByText('Beds Occupied').count()
      check('C2 persistent failure shows an error, not fake zeros', errCard && zeros === 0)
      await ctx.close()
    }
    // D. signed in but not an admin
    {
      const ctx = await browser.newContext(); const page = await ctx.newPage()
      mode = 'ok'; isAdmin = false
      await login(page)
      const shown = await page.getByText("This isn't an admin account").waitFor({ timeout: 30000 }).then(() => true).catch(() => false)
      check('D1 non-admin login gets a clear explanation, not an empty app', shown)
      isAdmin = true
      await ctx.close()
    }
    // E. start-up watchdog
    {
      const ctx = await browser.newContext(); const page = await ctx.newPage()
      await page.goto(`http://localhost:${APP}/portal`)
      await page.waitForTimeout(12000)
      check('E1 watchdog stays hidden on a normal start', (await page.locator('#bb-boot-fail').count()) === 0)
      await ctx.close()
      const ctx2 = await browser.newContext(); const page2 = await ctx2.newPage()
      await ctx2.route('**/_next/static/chunks/**', r => r.abort())   // app code never arrives
      await page2.goto(`http://localhost:${APP}/portal`).catch(() => {})
      const shown = await page2.getByText('TheBedBox is taking too long to start').waitFor({ timeout: 20000 }).then(() => true).catch(() => false)
      const buttons = shown && (await page2.locator('#bb-boot-reload').count()) === 1 && (await page2.locator('#bb-boot-reset').count()) === 1
      check('E2 failed start shows a recovery message with Reload + Reset, not a black screen', shown && buttons)
      await ctx2.close()
    }
  } finally {
    await browser.close(); try { process.kill(-server.pid) } catch {} killPort(APP); fake.close()
  }
  const failed = results.filter(r => !r).length
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll resilience checks passed')
  process.exit(failed ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
