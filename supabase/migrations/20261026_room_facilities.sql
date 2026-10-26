-- Admin-only record of extra facilities per room (e.g. geyser). Never shown to
-- residents and never billed as a separate line: the rent already includes it.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS facilities text[] NOT NULL DEFAULT '{}';
-- What the geyser adds to the rent, for our own records (null = not charged/not applicable)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS geyser_charge numeric;
