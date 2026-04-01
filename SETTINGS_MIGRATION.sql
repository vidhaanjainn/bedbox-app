CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_settings" ON settings FOR ALL USING (is_admin());
INSERT INTO settings (key, value) VALUES
  ('property_name', 'TheBedBox'),
  ('property_address', '8, Mahabali Nagar, Kolar Road, Bhopal'),
  ('property_phone', '7999546362'),
  ('property_email', 'thebedbox.in@gmail.com'),
  ('electricity_rate', '10'),
  ('rate_card', '{"single":"7000","double":"6000","triple":"5500"}')
ON CONFLICT (key) DO NOTHING;
