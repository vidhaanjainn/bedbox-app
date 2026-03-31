-- ============================================
-- BEDBOX COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROPERTIES (multi-property ready)
-- ============================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'The BedBox',
  address TEXT NOT NULL DEFAULT '8, Mahabali Nagar, Kolar Road, Bhopal',
  city TEXT DEFAULT 'Bhopal',
  state TEXT DEFAULT 'Madhya Pradesh',
  owner_name TEXT DEFAULT 'Vidhaan Jain',
  owner_phone TEXT DEFAULT '7999546362',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROOMS
-- ============================================
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER DEFAULT 1,
  type TEXT CHECK (type IN ('single', 'double', 'dorm')) NOT NULL,
  total_beds INTEGER NOT NULL DEFAULT 1,
  status TEXT CHECK (status IN ('available', 'partial', 'full', 'maintenance')) DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BEDS
-- ============================================
CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  bed_number TEXT NOT NULL,
  rate_monthly NUMERIC(10,2),
  rate_daily NUMERIC(10,2),
  status TEXT CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')) DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADMINS
-- ============================================
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT CHECK (role IN ('super_admin', 'staff')) DEFAULT 'staff',
  permissions JSONB DEFAULT '{"view_financials": false, "delete_residents": false, "manage_rooms": true, "log_payments": true, "manage_maintenance": true}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RESIDENTS
-- ============================================
CREATE TABLE residents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id),
  bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  -- Personal Info
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT,
  emergency_contact_name TEXT,
  emergency_contact_number TEXT,
  hometown TEXT,
  institution TEXT,
  occupation TEXT CHECK (occupation IN ('student', 'working', 'other')) DEFAULT 'student',
  -- Stay Info
  room_number TEXT,
  rent_amount NUMERIC(10,2) NOT NULL,
  security_deposit NUMERIC(10,2) DEFAULT 0,
  date_of_joining DATE NOT NULL,
  expected_duration TEXT, -- '3-6 months', '6-12 months', etc
  stay_type TEXT CHECK (stay_type IN ('long_stay', 'short_stay')) DEFAULT 'long_stay',
  -- Documents (stored as private bucket paths)
  aadhaar_front_path TEXT,
  aadhaar_back_path TEXT,
  -- Legal
  tc_agreed_at TIMESTAMPTZ,
  tc_agreed_ip TEXT,
  agreement_path TEXT, -- admin only PDF
  -- Status
  status TEXT CHECK (status IN ('pending', 'active', 'notice', 'vacated')) DEFAULT 'pending',
  initial_electricity_reading NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BOOKINGS (Advanced booking pipeline)
-- ============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),
  bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  -- Applicant Info
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT,
  occupation TEXT,
  from_date DATE,
  duration TEXT,
  price_finalised NUMERIC(10,2),
  token_payment_screenshot TEXT,
  token_amount NUMERIC(10,2) DEFAULT 0,
  -- Pipeline Status
  status TEXT CHECK (status IN ('inquiry', 'booked', 'onboarding_sent', 'onboarded', 'cancelled')) DEFAULT 'inquiry',
  onboarding_link_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SHORT STAYS
-- ============================================
CREATE TABLE short_stays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),
  bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  -- Guest Info
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT,
  aadhaar_front_path TEXT,
  aadhaar_back_path TEXT,
  tc_agreed_at TIMESTAMPTZ,
  -- Stay Info
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  daily_rate NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2),
  -- Payment
  payment_mode TEXT CHECK (payment_mode IN ('upi', 'bank_transfer', 'cash')),
  payment_status TEXT CHECK (payment_status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
  amount_paid NUMERIC(10,2) DEFAULT 0,
  status TEXT CHECK (status IN ('active', 'checked_out', 'cancelled')) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RENT PAYMENTS
-- ============================================
CREATE TABLE rent_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  month INTEGER NOT NULL, -- 1-12
  year INTEGER NOT NULL,
  rent_amount NUMERIC(10,2) NOT NULL,
  late_fee NUMERIC(10,2) DEFAULT 0,
  electricity_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  payment_mode TEXT CHECK (payment_mode IN ('upi', 'bank_transfer', 'cash')),
  payment_screenshot_path TEXT,
  paid_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
  receipt_requested_at TIMESTAMPTZ,
  receipt_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ELECTRICITY READINGS
-- ============================================
CREATE TABLE electricity_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bed_id UUID REFERENCES beds(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  previous_reading NUMERIC(10,2) NOT NULL,
  current_reading NUMERIC(10,2) NOT NULL,
  units_consumed NUMERIC(10,2) GENERATED ALWAYS AS (current_reading - previous_reading) STORED,
  rate_per_unit NUMERIC(5,2) DEFAULT 10.00,
  bill_amount NUMERIC(10,2) GENERATED ALWAYS AS ((current_reading - previous_reading) * 10.00) STORED,
  reading_date DATE DEFAULT CURRENT_DATE,
  added_to_rent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTICE PERIODS
-- ============================================
CREATE TABLE notice_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  notice_date DATE NOT NULL,
  last_day_per_agreement DATE GENERATED ALWAYS AS (notice_date + INTERVAL '60 days') STORED,
  last_day_of_stay DATE, -- actual checkout, can be different
  reason TEXT,
  status TEXT CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  submitted_via TEXT CHECK (submitted_via IN ('app', 'form', 'manual')) DEFAULT 'app',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MAINTENANCE REQUESTS
-- ============================================
CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  -- Details
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('plumbing', 'electrical', 'carpentry', 'cleaning', 'appliance', 'other')) NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  -- Status
  status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')) DEFAULT 'open',
  assigned_to TEXT,
  resolution_notes TEXT,
  -- Source
  submitted_by TEXT CHECK (submitted_by IN ('resident', 'admin')) DEFAULT 'resident',
  -- Media
  image_path TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS (in-app)
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('rent_reminder', 'late_fee', 'maintenance', 'notice', 'receipt', 'general')) DEFAULT 'general',
  is_read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_residents_status ON residents(status);
CREATE INDEX idx_residents_property ON residents(property_id);
CREATE INDEX idx_rent_payments_resident ON rent_payments(resident_id);
CREATE INDEX idx_rent_payments_month_year ON rent_payments(month, year);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX idx_notice_periods_status ON notice_periods(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_electricity_readings_resident ON electricity_readings(resident_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admin policies (full access)
CREATE POLICY "Admins full access to properties" ON properties FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
CREATE POLICY "Admins full access to rooms" ON rooms FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
CREATE POLICY "Admins full access to beds" ON beds FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
CREATE POLICY "Admins full access to residents" ON residents FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
CREATE POLICY "Admins full access to bookings" ON bookings FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
CREATE POLICY "Admins full access to short_stays" ON short_stays FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
CREATE POLICY "Admins full access to rent_payments" ON rent_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
CREATE POLICY "Admins full access to electricity" ON electricity_readings FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
CREATE POLICY "Admins full access to notice_periods" ON notice_periods FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
CREATE POLICY "Admins full access to maintenance" ON maintenance_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);
CREATE POLICY "Admins full access to admins table" ON admins FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);

-- Resident policies (own data only)
CREATE POLICY "Residents view own profile" ON residents FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "Residents update own profile" ON residents FOR UPDATE USING (
  user_id = auth.uid()
);
CREATE POLICY "Residents view own rent payments" ON rent_payments FOR SELECT USING (
  resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
);
CREATE POLICY "Residents view own electricity" ON electricity_readings FOR SELECT USING (
  resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
);
CREATE POLICY "Residents create maintenance requests" ON maintenance_requests FOR INSERT WITH CHECK (
  resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
);
CREATE POLICY "Residents view own maintenance" ON maintenance_requests FOR SELECT USING (
  resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
);
CREATE POLICY "Residents create notice periods" ON notice_periods FOR INSERT WITH CHECK (
  resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
);
CREATE POLICY "Residents view own notice" ON notice_periods FOR SELECT USING (
  resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
);
CREATE POLICY "Users view own notifications" ON notifications FOR ALL USING (
  user_id = auth.uid()
);

-- ============================================
-- SEED DATA - Default property
-- ============================================
INSERT INTO properties (name, address, city, state, owner_name, owner_phone)
VALUES ('The BedBox', '8, Mahabali Nagar, Kolar Road, Bhopal', 'Bhopal', 'Madhya Pradesh', 'Vidhaan Jain', '7999546362');
