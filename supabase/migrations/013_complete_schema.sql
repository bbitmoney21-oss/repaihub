-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR MANUALLY
-- Migration 013 — Complete schema for adapter-based architecture
-- Adds payment_rails_config (with who_executes), provider_events, payment_adapter_logs
-- Adds new columns to Transfer and inward_transfers tables

-- ── [GREEN] payment_rails_config ─────────────────────────────────────────────
-- Who handles each rail. Update value to 'fable' to activate real Fable API.
-- Zero code changes required to switch providers.

CREATE TABLE IF NOT EXISTS payment_rails_config (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL,               -- 'mock' or 'fable'
  description  TEXT,
  who_executes TEXT NOT NULL,               -- explicitly names who executes this
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO payment_rails_config (key, value, description, who_executes) VALUES
  ('outward_rail', 'mock',
   'NRO/NRE → CAD. AD bank debits Indian account → SWIFT to Canada',
   'Fable Fintech (AD bank: Kotak/partner) + SWIFT'),
  ('inward_collection_rail', 'mock',
   'Canadian CAD collection via Interac e-Transfer or EFT',
   'Fable Fintech (Interac/EFT/wire)'),
  ('inward_payout_rail', 'mock',
   'INR delivery to recipient Indian bank via IMPS/NEFT/UPI/RTGS',
   'Fable Fintech → Nium (IMPS/NEFT/UPI/RTGS)')
ON CONFLICT (key) DO NOTHING;

-- ── [GREY] provider_events ────────────────────────────────────────────────────
-- Every webhook logged here first, then processed. Never deleted. Idempotency key.

CREATE TABLE IF NOT EXISTS provider_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           TEXT NOT NULL,           -- 'fable' or 'mock_fable'
  event_type         TEXT NOT NULL,
  transfer_id        UUID,
  provider_reference TEXT,
  raw_payload        JSONB NOT NULL,
  processed          BOOLEAN DEFAULT false,
  processed_at       TIMESTAMP WITH TIME ZONE,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotency: same provider_reference + event_type can only be processed once
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_events_idempotency
  ON provider_events(provider_reference, event_type)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_events_transfer ON provider_events(transfer_id);
CREATE INDEX IF NOT EXISTS idx_provider_events_unprocessed ON provider_events(processed) WHERE processed = false;

-- ── [GREY] payment_adapter_logs ───────────────────────────────────────────────
-- Every outbound API call logged here. Includes mock calls.

CREATE TABLE IF NOT EXISTS payment_adapter_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_name     TEXT NOT NULL,    -- 'FableFintech' or 'MockFable'
  who_executes     TEXT,             -- label from payment_rails_config
  method           TEXT NOT NULL,    -- 'executeOutward', 'collectCAD', 'payoutINR', etc.
  transfer_id      UUID,
  request_payload  JSONB,
  response_payload JSONB,
  duration_ms      INTEGER,
  success          BOOLEAN,
  error_message    TEXT,
  is_mock          BOOLEAN DEFAULT false,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_adapter_logs_transfer ON payment_adapter_logs(transfer_id);
CREATE INDEX IF NOT EXISTS idx_payment_adapter_logs_adapter  ON payment_adapter_logs(adapter_name);

-- ── [GREEN] inward_recipients ─────────────────────────────────────────────────
-- Saved recipients for inward transfers (Remitly model)

CREATE TABLE IF NOT EXISTS inward_recipients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  bank_name      TEXT NOT NULL,
  account_last4  TEXT NOT NULL,         -- NEVER store full account number
  ifsc_code      TEXT NOT NULL,
  relationship   TEXT NOT NULL DEFAULT 'other',
  is_verified    BOOLEAN DEFAULT false,
  transfer_count INTEGER DEFAULT 0,
  last_used_at   TIMESTAMP WITH TIME ZONE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inward_recipients_user ON inward_recipients(user_id);

-- ── Add new columns to Transfer table ────────────────────────────────────────

ALTER TABLE "Transfer"
  ADD COLUMN IF NOT EXISTS "customerModel"    TEXT,          -- p2p/citizen_nro/citizen_nre
  ADD COLUMN IF NOT EXISTS "accountType"      TEXT,          -- NRO/NRE
  ADD COLUMN IF NOT EXISTS "providerReference" TEXT,
  ADD COLUMN IF NOT EXISTS "adapterName"      TEXT,
  ADD COLUMN IF NOT EXISTS "isMock"           BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "riskReason"       TEXT,
  ADD COLUMN IF NOT EXISTS "caBlocking"       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "caApprovedAt"     TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "caApprovedBy"     TEXT,
  ADD COLUMN IF NOT EXISTS "caRemarks"        TEXT,
  ADD COLUMN IF NOT EXISTS "fifteenCBRequired" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fifteenCBNumber"  TEXT,
  ADD COLUMN IF NOT EXISTS "fifteenCANumber"  TEXT,
  ADD COLUMN IF NOT EXISTS "grossAmountCAD"   DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "commissionCAD"    DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "flatFeeCAD"       DECIMAL(10,2) DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS "totalFeesCAD"     DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "netAmountCAD"     DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "promoCodeUsed"    TEXT,
  ADD COLUMN IF NOT EXISTS "promoDiscountCAD" DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "creditAppliedCAD" DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "feeConfigSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "swiftReference"   TEXT,
  ADD COLUMN IF NOT EXISTS "completedAt"      TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "testMode"         BOOLEAN DEFAULT false;

-- Also try lowercase column names (Supabase may use either)
ALTER TABLE transfers
  ADD COLUMN IF NOT EXISTS customer_model     TEXT,
  ADD COLUMN IF NOT EXISTS account_type       TEXT,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS adapter_name       TEXT,
  ADD COLUMN IF NOT EXISTS is_mock            BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS risk_reason        TEXT,
  ADD COLUMN IF NOT EXISTS ca_blocking        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS swift_reference    TEXT,
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS nro_bank_name      TEXT,
  ADD COLUMN IF NOT EXISTS nro_branch_city    TEXT,
  ADD COLUMN IF NOT EXISTS residency_type     TEXT;

-- ── Add new columns to inward_transfers ───────────────────────────────────────

ALTER TABLE inward_transfers
  ADD COLUMN IF NOT EXISTS provider_reference   TEXT,
  ADD COLUMN IF NOT EXISTS collection_reference TEXT,
  ADD COLUMN IF NOT EXISTS payout_reference      TEXT,
  ADD COLUMN IF NOT EXISTS adapter_name          TEXT,
  ADD COLUMN IF NOT EXISTS is_mock               BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS utr                   TEXT,
  ADD COLUMN IF NOT EXISTS rail_used             TEXT,
  ADD COLUMN IF NOT EXISTS collection_method     TEXT,
  ADD COLUMN IF NOT EXISTS payment_received_at   TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS customer_bank_token   TEXT,
  ADD COLUMN IF NOT EXISTS purpose               TEXT,
  ADD COLUMN IF NOT EXISTS notes                 TEXT;

-- ── Backfill existing transfers with defaults ─────────────────────────────────

UPDATE transfers
SET
  customer_model = CASE
    WHEN account_type = 'NRE' THEN 'citizen_nre'
    ELSE 'p2p'
  END,
  is_mock = true
WHERE customer_model IS NULL;

-- ── RLS policies for new tables ───────────────────────────────────────────────

ALTER TABLE payment_rails_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_adapter_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inward_recipients     ENABLE ROW LEVEL SECURITY;

-- Service role can read/write all (server-side only)
CREATE POLICY "service_role_payment_rails" ON payment_rails_config
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_provider_events" ON provider_events
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_payment_logs" ON payment_adapter_logs
  FOR ALL TO service_role USING (true);

-- Users can only see their own recipients
CREATE POLICY "users_own_recipients" ON inward_recipients
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- ── Activate Fable (when sandbox keys arrive) ─────────────────────────────────
-- Run this to switch from mock to real Fable (no code changes):
-- UPDATE payment_rails_config SET value = 'fable' WHERE key IN (
--   'outward_rail', 'inward_collection_rail', 'inward_payout_rail'
-- );
