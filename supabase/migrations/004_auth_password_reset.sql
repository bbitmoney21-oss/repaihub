-- Add columns required for custom password management
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_hash        TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_hash     TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expiry   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_reset_token_hash
  ON profiles(reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;
