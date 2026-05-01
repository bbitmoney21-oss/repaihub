-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — Compliance Requests + Digital Document Wallet
-- Run in Supabase SQL Editor (top to bottom, safe to re-run with IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. compliance_requests ────────────────────────────────────────────────────
-- One row per transfer, created the moment a transfer is initiated.
-- The CA sees all rows; customers see only their own.

CREATE TABLE IF NOT EXISTS public.compliance_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id         UUID        NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Workflow status
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','under_review','approved','rejected')),

  -- 15CA / 15CB metadata
  fifteen_ca_part     TEXT        CHECK (fifteen_ca_part IN ('A','B','C','D')),
  fifteen_cb_required BOOLEAN     NOT NULL DEFAULT FALSE,
  fifteen_cb_number   TEXT,       -- assigned by CA on approval
  fifteen_ca_number   TEXT,       -- assigned after 15CA is filed
  ca_remarks          TEXT,
  ca_reviewed_by      TEXT,       -- CA name
  ca_reviewed_at      TIMESTAMPTZ,
  rejection_reason    TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT compliance_requests_transfer_unique UNIQUE (transfer_id)
);

ALTER TABLE public.compliance_requests ENABLE ROW LEVEL SECURITY;

-- Users: read own rows only
CREATE POLICY "compliance_select_own" ON public.compliance_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (Express admin client) manages inserts + updates — no direct user writes needed.

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER compliance_requests_set_updated_at
  BEFORE UPDATE ON public.compliance_requests
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── 2. wallet_documents ───────────────────────────────────────────────────────
-- Every document uploaded (by user OR by CA) lives here.
-- token_id is a 64-char hex string, crypto-random, non-guessable.
-- Storage path points to the private Supabase Storage bucket 'wallet-docs'.

CREATE TABLE IF NOT EXISTS public.wallet_documents (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Secure, non-guessable token — acts as the document's external reference
  token_id              TEXT        NOT NULL UNIQUE
                          DEFAULT encode(gen_random_bytes(32), 'hex'),

  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compliance_request_id UUID        REFERENCES public.compliance_requests(id) ON DELETE SET NULL,
  transfer_id           UUID        REFERENCES public.transfers(id) ON DELETE SET NULL,

  -- Document classification
  doc_type              TEXT        NOT NULL
                          CHECK (doc_type IN (
                            'bank_statement','tds_certificate','pan_card',
                            'aadhaar','property_deed','investment_proof',
                            '15ca_pdf','15cb_pdf','other'
                          )),
  doc_label             TEXT        NOT NULL,  -- human-readable label set by uploader

  -- Storage reference (private bucket — never exposed directly)
  storage_path          TEXT        NOT NULL,  -- e.g. {user_id}/2026/{token_id}_bank.pdf
  bucket_name           TEXT        NOT NULL DEFAULT 'wallet-docs',

  -- File metadata
  file_name             TEXT        NOT NULL,
  file_size_bytes       BIGINT,
  mime_type             TEXT,

  -- Organisation
  year                  INTEGER     NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  uploaded_by           TEXT        NOT NULL DEFAULT 'user'
                          CHECK (uploaded_by IN ('user','ca')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wallet_documents ENABLE ROW LEVEL SECURITY;

-- Users: read own documents only
CREATE POLICY "wallet_select_own" ON public.wallet_documents
  FOR SELECT USING (auth.uid() = user_id);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS compliance_user_id_idx
  ON public.compliance_requests(user_id);
CREATE INDEX IF NOT EXISTS compliance_transfer_id_idx
  ON public.compliance_requests(transfer_id);
CREATE INDEX IF NOT EXISTS compliance_status_idx
  ON public.compliance_requests(status);
CREATE INDEX IF NOT EXISTS compliance_created_idx
  ON public.compliance_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_user_id_idx
  ON public.wallet_documents(user_id);
CREATE INDEX IF NOT EXISTS wallet_token_id_idx
  ON public.wallet_documents(token_id);
CREATE INDEX IF NOT EXISTS wallet_compliance_id_idx
  ON public.wallet_documents(compliance_request_id);
CREATE INDEX IF NOT EXISTS wallet_year_idx
  ON public.wallet_documents(year);
CREATE INDEX IF NOT EXISTS wallet_doc_type_idx
  ON public.wallet_documents(doc_type);

-- ── 4. Supabase Storage setup instructions ────────────────────────────────────
-- Create ONE private bucket named exactly: wallet-docs
--
-- In Supabase Dashboard → Storage → New bucket:
--   Name: wallet-docs
--   Public: OFF  (all access via signed URLs generated server-side)
--
-- No storage RLS policies needed — all reads/writes go through
-- Express (supabaseAdmin / service role key) which bypasses RLS.
-- Signed URLs expire after 1 hour and are issued per-request.
-- ─────────────────────────────────────────────────────────────────────────────
