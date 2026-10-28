# Database backup & restore

**What:** `.github/workflows/backup.yml` runs every night at 02:00 IST (and on demand: GitHub →
Actions → "Database backup" → Run workflow). It dumps the Supabase database with a dedicated
read-only login (`backup_ro`), checks the dump really contains residents, encrypts it, and keeps it
as a GitHub Actions artifact for **30 days**. A failed run emails the repo owner.

**Why encrypted:** the repo is public and artifacts of public repos are downloadable by anyone.
The file is AES-256 encrypted with `BACKUP_PASSPHRASE` (a GitHub secret). **Keep a copy of the
passphrase in a password manager - without it every backup is permanently unreadable.**

**Covers:** everything in the `public` schema (tables, data, RLS policies, functions) plus login
accounts (`auth.users`, `auth.identities`, kept as CSV via the private `backup` schema views). **Does not cover** uploaded files in Storage
(Aadhaar / payment photos) - those are not in any backup yet.

## Secrets (GitHub repo → Settings → Secrets and variables → Actions)
- `SUPABASE_BACKUP_DB_URL` = `postgresql://backup_ro.<project-ref>:<password>@<session-pooler-host>:5432/postgres`
  (host from Supabase → Connect → *Session pooler*; GitHub's runners are IPv4-only, so the direct
  `db.<ref>.supabase.co` address does not work on the free plan). The password of `backup_ro` is
  not stored in this repo; to rotate: `alter role backup_ro password '...'` in the Supabase SQL editor.
- `BACKUP_PASSPHRASE` = long random passphrase, 20+ characters.

## Restore
1. GitHub → Actions → "Database backup" → pick a run → download the artifact (a `.enc` file).
2. Decrypt and unpack:
   ```
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in bedbox-YYYY-MM-DD.tar.gz.enc -out backup.tar.gz
   tar xzf backup.tar.gz        # -> public.dump, auth_users.csv, auth_identities.csv
   ```
3. Into a **new, empty** Supabase project (or the same project after wiping `public`):
   ```
   pg_restore --no-owner --no-privileges --clean --if-exists -d "$TARGET_DB_URL" public.dump
   # login accounts (generated columns are already excluded from the CSVs):
   COLS=$(head -1 auth_users.csv)
   psql "$TARGET_DB_URL" -c "\copy auth.users ($COLS) from auth_users.csv csv header"
   COLS=$(head -1 auth_identities.csv)
   psql "$TARGET_DB_URL" -c "\copy auth.identities ($COLS) from auth_identities.csv csv header"
   ```
   then point the app's `NEXT_PUBLIC_SUPABASE_URL` / keys at that project.
4. Verify: `select count(*) from residents;` matches what you expect.

Test a restore into a scratch project once, so the first real restore isn't also the first attempt.
