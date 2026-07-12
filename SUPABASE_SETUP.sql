-- ============================================================
-- BEDBOX COMPLETE SUPABASE SETUP
-- Paste this entire script into Supabase SQL Editor → Run
-- ============================================================
-- After running, do these 3 manual steps in the Supabase dashboard:
--   1. Auth → Users → Add User → email: thebedbox.in@gmail.com, set password
--   2. Storage → New bucket: "resident-docs"  (private, no public access)
--   3. Storage → New bucket: "private-docs"   (private, no public access)
-- ============================================================


-- ─── HELPER: admin check ─────────────────────────────────────────────────────
-- All RLS policies use this function. It checks if the logged-in user's email
-- matches the admin email. Change the email below if yours is different.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') = 'thebedbox.in@gmail.com';
$$;


-- ─── 1. ROOMS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number    TEXT NOT NULL UNIQUE,
  floor          INTEGER NOT NULL DEFAULT 1,
  type           TEXT NOT NULL DEFAULT 'double'  -- single | double | triple | dorm
                 CHECK (type IN ('single','double','triple','dorm')),
  total_beds     INTEGER NOT NULL DEFAULT 2,
  status         TEXT NOT NULL DEFAULT 'available'
                 CHECK (status IN ('available','partial','full','maintenance')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 2. BEDS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beds (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        UUID REFERENCES rooms(id) ON DELETE CASCADE,
  bed_number     INTEGER NOT NULL DEFAULT 1,
  rate_monthly   NUMERIC(10,2) DEFAULT 0,
  rate_daily     NUMERIC(10,2) DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'available'
                 CHECK (status IN ('available','reserved','occupied','maintenance')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (room_id, bed_number)
);


-- ─── 3. RESIDENTS ─────────────────────────────────────────────────────────────
-- The core table. Includes onboarding, portal, and document columns.
CREATE TABLE IF NOT EXISTS residents (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Core identity
  name                          TEXT NOT NULL,
  mobile                        TEXT,
  email                         TEXT,
  -- Personal details (filled via onboarding wizard)
  emergency_contact_name        TEXT,
  emergency_contact_phone       TEXT,   -- used by onboarding form
  emergency_contact_number      TEXT,   -- alias used in some admin screens
  hometown                      TEXT,
  institution                   TEXT,
  occupation                    TEXT,
  -- Stay details
  bed_id                        UUID REFERENCES beds(id) ON DELETE SET NULL,
  room_number                   TEXT,
  rent_amount                   NUMERIC(10,2),
  security_deposit              NUMERIC(10,2) DEFAULT 0,
  date_of_joining               DATE,
  expected_duration             TEXT,
  stay_type                     TEXT DEFAULT 'long_stay'
                                CHECK (stay_type IN ('long_stay','short_stay')),
  initial_electricity_reading   NUMERIC DEFAULT 0,
  notes                         TEXT,
  -- Status & lifecycle
  status                        TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('active','pending','notice','vacated')),
  onboarding_status             TEXT NOT NULL DEFAULT 'pending',
                                -- pending | submitted | active | archived
  -- Portal access
  portal_user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Onboarding invite token
  onboard_token                 TEXT UNIQUE,
  onboard_token_used            BOOLEAN DEFAULT false,
  onboard_token_expires_at      TIMESTAMPTZ,
  -- Documents (paths in storage)
  aadhaar_front_url             TEXT,   -- used by onboarding form (resident-docs bucket)
  aadhaar_back_url              TEXT,
  aadhaar_front_path            TEXT,   -- used by manual admin upload (private-docs bucket)
  aadhaar_back_path             TEXT,
  -- Agreement / T&C
  tc_agreed_at                  TIMESTAMPTZ,  -- manual admin onboarding
  agreement_signed_at           TIMESTAMPTZ,  -- resident self-onboarding
  agreement_ip                  TEXT,
  agreement_pdf_url             TEXT,
  agreement_path                TEXT,
  -- Timestamps
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 4. RENT PAYMENTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rent_payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id               UUID REFERENCES residents(id) ON DELETE CASCADE NOT NULL,
  month                     INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                      INTEGER NOT NULL,
  rent_amount               NUMERIC(10,2) DEFAULT 0,
  electricity_amount        NUMERIC(10,2) DEFAULT 0,
  late_fee                  NUMERIC(10,2) DEFAULT 0,
  total_amount              NUMERIC(10,2) DEFAULT 0,
  amount_paid               NUMERIC(10,2) DEFAULT 0,
  payment_mode              TEXT CHECK (payment_mode IN ('upi','bank_transfer','cash',NULL)),
  payment_screenshot_path   TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','partial','paid')),
  paid_at                   TIMESTAMPTZ,
  receipt_requested_at      TIMESTAMPTZ,
  receipt_sent_at           TIMESTAMPTZ,
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 5. ELECTRICITY READINGS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS electricity_readings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id       UUID REFERENCES residents(id) ON DELETE CASCADE NOT NULL,
  bed_id            UUID REFERENCES beds(id) ON DELETE SET NULL,
  month             INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year              INTEGER NOT NULL,
  previous_reading  NUMERIC DEFAULT 0,
  current_reading   NUMERIC DEFAULT 0,
  units_consumed    NUMERIC GENERATED ALWAYS AS (current_reading - previous_reading) STORED,
  rate_per_unit     NUMERIC(6,2) DEFAULT 10,
  bill_amount       NUMERIC(10,2) DEFAULT 0,
  reading_date      DATE,
  added_to_rent     BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 6. NOTICE PERIODS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notice_periods (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id              UUID REFERENCES residents(id) ON DELETE CASCADE NOT NULL,
  notice_date              DATE NOT NULL,
  last_day_per_agreement   DATE,  -- notice_date + 60 days
  last_day_of_stay         DATE,  -- resident's actual requested last day
  reason                   TEXT,
  status                   TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','completed','cancelled')),
  submitted_via            TEXT DEFAULT 'manual'
                           CHECK (submitted_via IN ('app','form','manual')),
  created_at               TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 7. MAINTENANCE REQUESTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id       UUID REFERENCES residents(id) ON DELETE CASCADE,
  title             TEXT,
  description       TEXT,
  category          TEXT DEFAULT 'other'
                    CHECK (category IN ('plumbing','electrical','carpentry','cleaning','appliance','other')),
  priority          TEXT DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','urgent')),
  status            TEXT DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','resolved','cancelled')),
  assigned_to       TEXT,
  resolution_notes  TEXT,
  submitted_by      TEXT DEFAULT 'admin'
                    CHECK (submitted_by IN ('resident','admin')),
  image_path        TEXT,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 8. BOOKINGS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id                    UUID REFERENCES beds(id) ON DELETE SET NULL,
  full_name                 TEXT,
  mobile                    TEXT,
  email                     TEXT,
  occupation                TEXT,
  from_date                 DATE,
  duration                  TEXT,
  price_finalised           NUMERIC(10,2),
  token_amount              NUMERIC(10,2) DEFAULT 0,
  token_payment_screenshot  TEXT,
  status                    TEXT DEFAULT 'inquiry'
                            CHECK (status IN ('inquiry','booked','onboarding_sent','onboarded','cancelled')),
  onboarding_link_sent_at   TIMESTAMPTZ,
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 9. SHORT STAYS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS short_stays (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id              UUID REFERENCES beds(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  mobile              TEXT,
  email               TEXT,
  aadhaar_front_path  TEXT,
  aadhaar_back_path   TEXT,
  tc_agreed_at        TIMESTAMPTZ,
  checkin_date        DATE NOT NULL,
  checkout_date       DATE,
  daily_rate          NUMERIC(10,2) DEFAULT 0,
  total_amount        NUMERIC(10,2) DEFAULT 0,
  payment_mode        TEXT CHECK (payment_mode IN ('upi','bank_transfer','cash',NULL)),
  payment_status      TEXT DEFAULT 'pending'
                      CHECK (payment_status IN ('pending','partial','paid')),
  amount_paid         NUMERIC(10,2) DEFAULT 0,
  status              TEXT DEFAULT 'active'
                      CHECK (status IN ('active','checked_out','cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 10. RECEIPT REQUESTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipt_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id  UUID REFERENCES residents(id) ON DELETE CASCADE NOT NULL,
  month        TEXT NOT NULL,  -- e.g. "March 2025" or YYYY-MM
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','sent')),
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 11. SETTINGS ─────────────────────────────────────────────────────────────
-- Key-value store for property config (electricity rate, rate card, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO settings (key, value) VALUES
  ('property_name',    'TheBedBox'),
  ('property_address', '8, Mahabali Nagar, Kolar Road, Bhopal (M.P.)'),
  ('property_phone',   '+91 79995 46362'),
  ('property_email',   'thebedbox.in@gmail.com'),
  ('electricity_rate', '10'),
  ('rate_card',        '{"single": 8000, "double": 6500, "triple": 5500}')
ON CONFLICT (key) DO NOTHING;


-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_residents_mobile           ON residents(mobile);
CREATE INDEX IF NOT EXISTS idx_residents_status           ON residents(status);
CREATE INDEX IF NOT EXISTS idx_residents_onboard_token    ON residents(onboard_token);
CREATE INDEX IF NOT EXISTS idx_residents_portal_user_id   ON residents(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_resident     ON rent_payments(resident_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_month_year   ON rent_payments(year, month);
CREATE INDEX IF NOT EXISTS idx_electricity_resident       ON electricity_readings(resident_id);
CREATE INDEX IF NOT EXISTS idx_notice_resident            ON notice_periods(resident_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_resident       ON maintenance_requests(resident_id);
CREATE INDEX IF NOT EXISTS idx_receipt_requests_resident  ON receipt_requests(resident_id);


-- ─── GENERATE ONBOARD TOKEN FUNCTION ─────────────────────────────────────────
-- Called from both admin pages and API routes.
-- Generates a UUID-based token, sets 7-day expiry, resets used flag.
CREATE OR REPLACE FUNCTION generate_onboard_token(p_resident_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Generate a random token using two UUIDs concatenated (extra entropy)
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  UPDATE residents SET
    onboard_token            = v_token,
    onboard_token_used       = false,
    onboard_token_expires_at = NOW() + INTERVAL '7 days',
    updated_at               = NOW()
  WHERE id = p_resident_id;

  RETURN v_token;
END;
$$;


-- ─── ENABLE ROW LEVEL SECURITY ────────────────────────────────────────────────
ALTER TABLE rooms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds                ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_periods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_stays         ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings            ENABLE ROW LEVEL SECURITY;


-- ─── RLS POLICIES ─────────────────────────────────────────────────────────────

-- ── rooms ──
CREATE POLICY "admin_all_rooms" ON rooms
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── beds ──
CREATE POLICY "admin_all_beds" ON beds
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── residents ──
-- Admin has full access
CREATE POLICY "admin_all_residents" ON residents
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Resident can read their own row (via portal login)
CREATE POLICY "resident_read_own" ON residents
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND portal_user_id = auth.uid());

-- NOTE (SEC-01): self-onboarding does NOT use anon RLS policies. The wizard talks to
-- /api/onboard/[token], which validates the token server-side with the service-role key.
-- Do not add anon SELECT/UPDATE policies on residents — RLS cannot compare a
-- client-supplied token to the row, so any such policy exposes every pending resident.

-- ── rent_payments ──
CREATE POLICY "admin_all_rent_payments" ON rent_payments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "resident_read_own_rent" ON rent_payments
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    resident_id IN (
      SELECT id FROM residents WHERE portal_user_id = auth.uid()
    )
  );

-- ── electricity_readings ──
CREATE POLICY "admin_all_electricity" ON electricity_readings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "resident_read_own_electricity" ON electricity_readings
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    resident_id IN (
      SELECT id FROM residents WHERE portal_user_id = auth.uid()
    )
  );

-- ── notice_periods ──
CREATE POLICY "admin_all_notices" ON notice_periods
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "resident_own_notices" ON notice_periods
  FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    resident_id IN (
      SELECT id FROM residents WHERE portal_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    resident_id IN (
      SELECT id FROM residents WHERE portal_user_id = auth.uid()
    )
  );

-- ── maintenance_requests ──
CREATE POLICY "admin_all_maintenance" ON maintenance_requests
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "resident_own_maintenance" ON maintenance_requests
  FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    resident_id IN (
      SELECT id FROM residents WHERE portal_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    resident_id IN (
      SELECT id FROM residents WHERE portal_user_id = auth.uid()
    )
  );

-- ── bookings ──
CREATE POLICY "admin_all_bookings" ON bookings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── short_stays ──
CREATE POLICY "admin_all_short_stays" ON short_stays
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── receipt_requests ──
CREATE POLICY "admin_all_receipt_requests" ON receipt_requests
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "resident_own_receipt_requests" ON receipt_requests
  FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    resident_id IN (
      SELECT id FROM residents WHERE portal_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    resident_id IN (
      SELECT id FROM residents WHERE portal_user_id = auth.uid()
    )
  );

-- ── settings ──
CREATE POLICY "admin_all_settings" ON settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Residents (and anon) can read non-sensitive settings (e.g. electricity rate shown in portal)
CREATE POLICY "public_read_settings" ON settings
  FOR SELECT
  USING (key IN ('electricity_rate', 'property_name', 'property_phone'));


-- ─── STORAGE POLICIES ─────────────────────────────────────────────────────────
-- Run these AFTER creating the two buckets in the Supabase Dashboard:
--   Storage → New bucket → "resident-docs"  (private)
--   Storage → New bucket → "private-docs"   (private)

-- resident-docs: residents upload their own Aadhaar during onboarding (anon key)
INSERT INTO storage.buckets (id, name, public) VALUES ('resident-docs', 'resident-docs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('private-docs', 'private-docs', false)
ON CONFLICT (id) DO NOTHING;

-- NOTE (SEC-02): no anon upload policy. Onboarding uploads use signed upload URLs
-- issued by /api/onboard/[token] after token validation (service role).

-- Admin can read all files in resident-docs
CREATE POLICY "admin_read_resident_docs" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'resident-docs' AND is_admin());

-- Admin can delete files in resident-docs
CREATE POLICY "admin_delete_resident_docs" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'resident-docs' AND is_admin());

-- Admin full access to private-docs
CREATE POLICY "admin_all_private_docs" ON storage.objects
  FOR ALL
  USING (bucket_id = 'private-docs' AND is_admin())
  WITH CHECK (bucket_id = 'private-docs' AND is_admin());


-- ─── DONE ─────────────────────────────────────────────────────────────────────
-- After running this script, open Supabase Dashboard and:
--
-- 1. Auth → Users → "Add user" → invite user (or "Create new user")
--    Email: thebedbox.in@gmail.com
--    Password: (choose a strong one)
--    ⚠️ Make sure the email matches exactly what's in is_admin() above
--
-- 2. Confirm Storage → New bucket → "resident-docs"  (Private: ON)
--    (if the INSERT above failed due to permissions, create manually)
--    Confirm Storage → New bucket → "private-docs"   (Private: ON)
--
-- 3. Add your Supabase env vars to Vercel:
--    NEXT_PUBLIC_SUPABASE_URL    = https://YOUR-PROJECT.supabase.co
--    NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
--    SUPABASE_SERVICE_ROLE_KEY   = eyJ...  (Settings → API → service_role)
--
-- 4. Go to Settings → API → copy your new anon key + URL
--    Update .env.local with the new values
--    Update Vercel env vars with the new values
--
-- 5. Auth → URL Configuration → add:
--    Site URL: https://bedbox-app-alpha.vercel.app
--    Redirect URLs: https://bedbox-app-alpha.vercel.app/**
--
-- 6. Auth → Email Templates → confirm OTP template is set up
--    (default Supabase template works fine)
--
-- ─── SEED YOUR ROOMS & BEDS ───────────────────────────────────────────────────
-- Uncomment and customise this section for your actual room layout.
-- Example for 3 floors, 20 rooms:
--
-- INSERT INTO rooms (room_number, floor, type, total_beds) VALUES
--   ('101', 1, 'double', 2), ('102', 1, 'double', 2), ('103', 1, 'double', 2),
--   ('104', 1, 'double', 2), ('105', 1, 'single', 1), ('106', 1, 'single', 1),
--   ('201', 2, 'double', 2), ('202', 2, 'double', 2), ('203', 2, 'double', 2),
--   ('204', 2, 'double', 2), ('205', 2, 'single', 1), ('206', 2, 'single', 1),
--   ('301', 3, 'double', 2), ('302', 3, 'double', 2), ('303', 3, 'double', 2),
--   ('304', 3, 'double', 2), ('305', 3, 'single', 1), ('306', 3, 'single', 1);
--
-- Then for each room, insert its beds:
-- INSERT INTO beds (room_id, bed_number, rate_monthly, rate_daily)
-- SELECT id, 1, 6500, 400 FROM rooms WHERE room_number = '101';
-- INSERT INTO beds (room_id, bed_number, rate_monthly, rate_daily)
-- SELECT id, 2, 6500, 400 FROM rooms WHERE room_number = '101';
-- ... repeat for all rooms
