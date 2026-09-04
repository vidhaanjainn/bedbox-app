# 18 — Implementation Log

Newest first.

## 2026-09-04 (part 4) · Premium admin icon + UI polish pass (UX-01/02 first slice)
- **New admin icon:** generated a distinct SVG (dark charcoal/navy gradient square, teal shield +
  checkmark — "control/authority", separate from the resident app's teal "B" monogram), rasterized
  to 192/512 PNGs via sharp. Wired into `manifest-admin.json`. Also fixed a real iOS gap:
  `apple-touch-icon` (what iOS actually uses for Add to Home Screen, not the manifest icons array)
  now gets swapped by `ManifestSwitcher` too, along with the install title ("BedBox Admin").
- **Design-system pass, done at the shared-token level for maximum leverage:** most admin pages
  already consume shared classes (`glass-card`, `bb-input`, `bb-btn-primary`, `stat-card`,
  `status-badge`, `bb-table`, `nav-item`) — upgrading `globals.css` once cascades to 20+ pages
  without touching each one individually. Added: real box-shadows (cards read as elevated, not
  flat/floating), consistent focus-visible rings across every input/button/link,
  `prefers-reduced-motion` support, `.bb-page` max-width shell applied once at
  `app/admin/layout.tsx` (fixes the "content floats at arbitrary widths" complaint on wide
  screens), `.bb-empty` for consistent empty states, `.bb-icon-btn` guaranteeing 44px touch
  targets, `.status-badge.is-*` variants so pages can stop re-deriving the same color map inline.
- **Emoji → real icons (lucide-react), the single highest-leverage "looks unprofessional" fix**
  per the UI/UX skill's explicit checklist: swept the resident-facing surfaces named as the worst
  offenders — portal bottom nav, portal home (WiFi/quick actions/nearby-places headers), portal
  notice/maintenance/receipt success states, and the full onboarding wizard (error state, success
  state, security note, file upload states, maintenance category picker). Admin pages' emoji were
  left as-is this pass (mostly inline ✓/⚠️ status glyphs, lower priority; scope note below).
- **Scope note (why not literally every screen):** doing a from-scratch redesign of all 30+ admin
  CRUD pages' individual JSX in one pass isn't a good token trade — the shared-layer fix above
  gets ~80% of the visual-consistency win for ~5% of the cost. Remaining opportunities, roughly
  in order of value: (1) an admin dashboard rebuild around a single "Today — needs your action"
  list instead of scattered stat cards (UX-03, spec'd in 04_UIUXReview.md), (2) StatCard/PageHeader
  /EmptyState as real shared components instead of copy-pasted inline styles (reduces future
  drift), (3) the remaining admin emoji sweep, (4) mobile-first pass on the wider admin tables.

## 2026-09-04 (part 3) · Fixed "Add to Home Screen" always opening resident login
- **Root cause:** `public/manifest.json`'s `start_url` was hardcoded to `/portal`, and it was
  linked once, unconditionally, in the root layout `<head>` — so "Add to Home Screen" from ANY
  page (including /login) always installed an icon that opens the resident portal.
- **Fix:** added `public/manifest-admin.json` (`start_url: /login`) + `app/manifest-switcher.tsx`
  (client component, swaps the `<link rel="manifest">` href based on the current route — admin
  areas get the admin manifest, everything else keeps the resident one). Result: adding to home
  screen from `/login` or any `/admin/*` page now installs a distinct "TheBedBox Admin" icon that
  opens straight to admin; adding from `/portal` still installs the resident icon as before.
- **Also added:** `/login` now redirects straight to `/admin/dashboard` if a session already
  exists (skips the form on repeat opens); `/admin/*` now redirects to `/login` if there's no
  session (previously it would render an empty/broken dashboard with no prompt to sign in).
  Neither change shortens session lifetime — `persistSession`/`autoRefreshToken` were already on
  by default in `lib/supabase/client.ts`, so sessions already only end on explicit sign-out.

## 2026-09-04 (part 2) · Room 205 resident + Google Form notice sync
- **Room 205:** owner confirmed someone lives there (name still unknown — same
  "⚠️ Name Pending" placeholder pattern as Room 304) and is vacating ~2026-09-20 like Zubin.
  Same single-occupancy-of-a-double-room handling as Niraj/207 (both beds locked).
- **Google Form sync built:** owner's "Notice to Vacate" form response sheet is public
  (readable via the CSV export URL — no Google service account needed at all, simpler than
  planned). Built `lib/notice-form-sync.ts` (hand-rolled CSV parser, tested against the real
  162-row sheet including multiline quoted fields) + `/api/sync-notice-form` (admin-gated) +
  wired into the daily cron automatically.
- **Important finding, changed the design:** the sheet holds notice submissions back to 2022,
  and several residents currently marked ACTIVE on the owner's fresh Sept 2026 list have old
  notice submissions on file — Pradyuman Garg submitted notice 4 times (2024×2, May 2025, May
  2026, each citing graduation/moving), Shivam Tiwari and Shourya Raikwar each submitted once in
  late 2025, Taukeer submitted in June 2026. All are still living there today. Auto-applying this
  data would have wrongly flagged paying residents as vacating with fabricated dates. **Decision:**
  built a review queue instead of an auto-apply sync — `notice_form_submissions` table, only rows
  from the last 6 months surface as 'pending' (older rows imported too, pre-marked 'dismissed' as
  historical reference, not deleted). New "Google Form review queue" section on the admin Notices
  page: each pending row shows a resident-match dropdown (pre-guessed by room number) + a last-day
  date input, with Apply (creates the real notice_periods record + flips resident status) or
  Dismiss. Verified: 157 historical rows correctly archived, exactly 5 recent ones (Rishi Varma,
  Pradumn Garg, Prakhar Gupta, Manshu Jaiswar, Taukeer khan) surfaced for the owner's review.

## 2026-09-04 · Real resident data import + resident-facing features + 2 more functional bugs found
- **Resident data import:** parsed owner's manual room list into 13 real residents (12 initial +
  Zubin/208 added mid-session), replacing 2 test/placeholder rows (matched owner's own email,
  generic data — deleted along with their fake rent history). Corrected mid-import: the "second
  number" per row is `security_deposit`, not an alternate rent guess (owner clarified true column
  headers). Every gap/ambiguity flagged in each resident's `notes` field with ⚠️/🚨 markers,
  including one resident whose name is still unknown ("⚠️ Name Pending (Room 304)"). Beds/rooms
  occupancy synced to match (`rooms.status` recomputed from actual bed occupancy). Room 207
  (physically double) locked to single occupancy for Niraj Methi per owner's note.
- **WiFi + Nearby Places (RES-01/RES-02):** `nearby_places` table (admin-editable via Settings,
  portal-readable), `settings.wifi_password`/`wifi_network_name`, portal home page redesigned to
  show both. Nearby places seeded from a live web search for the Kolar Road/Bhopal area (hospitals,
  grocery, attractions, transport) — flagged to owner as general-area info, not verified exact
  distances from the property.
- **Fixed: portal home page was completely broken.** It queried `rooms`/`beds` via a nonexistent
  `room_id` join and a `rent_records` table that doesn't exist at all — every load would have
  errored. Rewritten against the real schema (`residents.room_number` direct, `rent_payments`
  with integer month/year).
- **Fixed: portal notice-to-vacate page was completely broken.** Referenced
  `residents.notice_period_start` (doesn't exist) and `notice_periods.expected_vacate_date`
  (doesn't exist — real column is `last_day_of_stay`, and `last_day_per_agreement` turned out to
  be a DB-generated column, better than committed SQL suggested). Rewritten to use the real
  `notice_periods` table correctly.
- **Fixed: 6 more dead RLS policies (functional bug, not security)** — `rent_payments`,
  `electricity_readings`, `maintenance_requests` (x2), `notice_periods` (x2) all had "residents
  see/submit their own X" policies keyed on `residents.user_id`, a column the app never
  populates (`portal_user_id` is what's actually set). Every one of these was silently
  non-functional — residents could never see their own rent/electricity/maintenance history or
  submit a notice/maintenance request through the portal. Rewrote all 6 to use
  `portal_user_id = auth.uid()`. Added a `resident_update_own_status` policy so a resident's
  status can flip to `notice` when they submit.
- **Auto-tracking for notice periods (owner's ask):** as soon as ANY notice_periods row exists
  (resident-submitted via the now-fixed portal form, or admin-entered), the admin Residents list
  shows a "⏳ Nd left" badge and the Rooms page shows "Available from {date}" on that bed —
  entirely derived from the DB, no manual re-entry, no extra step. Verified live against Zubin's
  real notice (room 208, vacating 2026-09-20 → correctly shows 16 days left).
- **Not built — needs owner input:** syncing notice submissions from the owner's *external*
  Google Form. No form/sheet ID was provided; once shared, this would need a small poll-based
  sync (Sheets API → notice_periods) similar to `lib/sheets.ts` but in the read direction.
- **Legal/KYC additions:** `residents.aadhaar_number` column added; onboarding wizard now
  collects and validates a 12-digit Aadhaar number alongside the existing image uploads.
  `lib/agreement-clauses.ts` extracted as the single source of truth for clause text (was
  duplicated risk between onboarding page and any future PDF generator). `lib/documents.ts`
  generates two admin-only PDFs via jsPDF — a signed-agreement copy (clauses + signature
  metadata) and a police tenant-verification form (standard fields; NOT an auto-submission —
  no public API exists for MP/Bhopal police tenant verification to integrate against, owner
  should confirm the current process with their local station). Both stored in the `private-docs`
  bucket (admin-only RLS), never resident-downloadable, with buttons on the admin resident detail
  page to generate/regenerate/view.
- **Staff & Expenses (Phase 3, STAFF-01/EXP-01):** `staff`, `staff_payouts`, `expenses` tables
  (admin-only RLS) + new `/admin/staff` page — add staff, log monthly payouts (salary/advance/
  bonus, payment mode), log expenses by category, with month/year filtering and running totals.

## 2026-09-03 (part 2) · Found and fixed the same open-RLS drift on 6 more tables
While building the multi-admin feature, checked `admins` table RLS and found any authenticated
user could INSERT themselves as super_admin (with_check `auth.uid() IS NOT NULL`, no ownership
check at all). Widened the check to ALL public tables in one query — found the identical drift
pattern on `beds`, `rooms`, `electricity_readings`, `maintenance_requests`, `rent_payments`
(broad `auth.uid() IS NOT NULL` policies alongside/instead of correct admin/own-row scoping).
With owner approval, applied 2 migrations dropping all the unsafe policies; verified via
`pg_policies` query that zero broad policies remain anywhere except the correct
`portal_user_id = auth.uid()` one on residents. `is_admin()` hardened to also require
`is_active = true`. Full writeup: 12_Security.md §6.

## 2026-07-12 (part 2) · Found & fixed the real "prod DB unreachable" root cause + a live P0 hole
- **Investigation:** owner unpaused a Supabase project named "bedbox" (ref `rskbrdzbbfyyhaxucmgg`)
  but the app's env vars (Vercel + `.env.local`) pointed at a *different* ref
  (`nbhmjqkhpdpdxkkzfgca`) that still didn't resolve. First check of `rskbrdzbbfyyhaxucmgg`
  showed 0 rows everywhere (looked like a stale scaffold) — but that was a momentary
  just-unpaused read; a repeat query moments later showed real data (2 residents, 20 rooms, 31
  beds, 1 rent payment, 6 settings). Owner then independently confirmed via the Supabase
  dashboard that `rskbrdzbbfyyhaxucmgg` is the one shown as connected to the bedbox app — this
  is the real production database and always has been.
- **Root cause confirmed:** forced a fresh Vercel production build (empty commit → deploy) and
  inspected the freshly-built client JS bundle; it still baked in the dead
  `nbhmjqkhpdpdxkkzfgca` URL. This proves Vercel's saved Production env var for
  `NEXT_PUBLIC_SUPABASE_URL` is genuinely wrong (not a stale-build artifact) — at some point it
  was pointed at the wrong/now-dead project while everyone kept using the real one directly via
  the Supabase dashboard.
- **Bigger finding while investigating:** the live `residents` table had RLS policies (edited
  directly in the Supabase dashboard at some point, never committed to git) that were WORSE than
  the already-known SEC-01 bug: `allow_token_lookup` (SELECT, roles=public, qual=`true`) let
  ANYONE with the anon key read every resident's full record including Aadhaar file paths with
  zero authentication; `allow_onboard_token_update` (UPDATE, qual=`true`, with_check=`true`) let
  anyone overwrite any resident; `residents_select/update/insert/delete` (all
  `auth.uid() IS NOT NULL`) let any logged-in user read/edit/delete every other resident.
  `storage.objects` had zero policies at all (not even the admin ones).
- **Fix applied (with owner's explicit approval — platform's safety classifier correctly required
  it for a production DB migration):** migration `sec01_close_open_residents_rls` dropped all of
  the above dangerous policies, kept the legitimate `Admins full access to residents` (is_admin()
  based — verified it now checks a real `admins` table membership, not a hardcoded email as the
  repo's SQL implied), added a correctly-scoped `resident_read_own` (portal_user_id = auth.uid()),
  and added back admin read/delete on `resident-docs` + admin-all on `private-docs` in storage.
- **Verified closed:** live curl against `rskbrdzbbfyyhaxucmgg` with the real anon key —
  anonymous SELECT on residents returns `[]`; anonymous UPDATE affects 0 rows. Confirmed via
  `pg_policies` that only 2 policies remain on `residents`.
- **Also discovered:** production's `is_admin()` already reads from a real `admins` table (1 row)
  and a `properties` table already exists (1 row) — SEC-03 is effectively done live; the repo's
  `SUPABASE_SETUP.sql` and `lib/types.ts` are BOTH out of sync with the real schema, in different
  directions than originally audited. DATA-01 needs to re-pull live schema truth via Supabase
  MCP/CLI, not trust either committed file.
- **Fixed `.env.local`:** URL and anon key corrected to the real project; service-role line
  blanked with instructions (never fetched/handled directly — that secret was not accessible to
  the AI session and shouldn't be pasted into chat).
- **Still needed (owner, blocking):** Vercel Production (and Preview/Dev) env vars —
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — must
  be updated in the Vercel dashboard to match `rskbrdzbbfyyhaxucmgg` (values in
  PROJECT_STATUS.md's Blocked By section). The AI session has no tool that can write Vercel env
  vars and the local `vercel` CLI's saved login is expired, so this cannot be done by AI right
  now. After the owner updates it, trigger a redeploy and re-verify the full onboarding + admin +
  portal flow against real data.

## 2026-07-12 · SEC-01 + SEC-02 (code deployed; migration pending owner)
- **What:** New `app/api/onboard/[token]/route.ts` — GET validates token server-side (service
  role) and returns only name/email/mobile; POST issues signed upload URLs for Aadhaar images
  (`onboarding/{id}/…` paths) and accepts a whitelisted, length-clamped submit payload; captures
  IP from request headers (removed ipify call); guards double-submit with
  `.eq('onboard_token_used', false)`. Rewired `app/onboard/[token]/page.tsx` to use the API +
  `uploadToSignedUrl`. Removed unsafe policies from SUPABASE_SETUP.sql with explanatory notes;
  wrote `supabase/migrations/20260712_sec01_secure_onboarding.sql` (drops `onboard_token_select`,
  `allow_onboard_token_update`, `anon_upload_resident_docs`).
- **Why:** P0 — anon could read/overwrite any pending resident and spam the docs bucket.
- **Testing:** `npm run build` clean; local dev: GET/POST with short/invalid tokens → correct
  400/404 JSON; prod deploy verified live (route responds). Full happy-path retest requires a
  live DB (blocked — see below).
- **Blocked:** prod Supabase project `nbhmjqkhpdpdxkkzfgca` is NXDOMAIN (paused/deleted; in an
  account not connected here) → migration NOT applied, DB-backed prod features currently down.
- **Verify after owner restores + runs migration:**
  `curl "https://<proj>.supabase.co/rest/v1/residents?select=id&limit=1" -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>"`
  must return `[]`; then complete one real onboarding link end-to-end. Every completed task adds: date · task ID · what changed · why · files · testing ·
remaining work.

## 2026-07-12 · DOC-01 · Documentation operating system installed
- **What:** Full repo audit; created docs/ (status, audit, roadmap, backlog, security, UX review,
  vision, monetization, decision/implementation logs, supporting guides); AGENTS.md pointed at
  the execution guide.
- **Why:** Turn the repo into a self-driving project any AI model can resume (owner directive).
- **Files:** docs/* (new), AGENTS.md (pointer added). No app code changed.
- **Testing:** n/a (docs only).
- **Remaining:** deep specs (10_FeatureSpecifications.md) get written per-task before coding;
  next code task = SEC-01.
