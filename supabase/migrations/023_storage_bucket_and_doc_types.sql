-- Migration 023 — Create wallet-docs storage bucket + expand doc_type CHECK
-- RUN IN SUPABASE SQL EDITOR.
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING).

-- ── 1. Create wallet-docs storage bucket if it doesn't exist ─────────────────
-- The wallet-docs bucket is PRIVATE. All access is via server-side signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wallet-docs',
  'wallet-docs',
  false,
  52428800,   -- 50 MB max file size
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Expand wallet_documents.doc_type CHECK constraint ─────────────────────
-- Original constraint (migration 005) only had 15ca_pdf / 15cb_pdf.
-- Add form145_pdf / form146_pdf for IT Act 2025 naming.
ALTER TABLE public.wallet_documents
  DROP CONSTRAINT IF EXISTS wallet_documents_doc_type_check;

ALTER TABLE public.wallet_documents
  ADD CONSTRAINT wallet_documents_doc_type_check CHECK (
    doc_type IN (
      'bank_statement',
      'tds_certificate',
      'pan_card',
      'aadhaar',
      'property_deed',
      'investment_proof',
      '15ca_pdf',       -- IT Act 1961 legacy (keep for backward compat)
      '15cb_pdf',       -- IT Act 1961 legacy (keep for backward compat)
      'form145_pdf',    -- IT Act 2025 (Form 145 = formerly 15CA)
      'form146_pdf',    -- IT Act 2025 (Form 146 = formerly 15CB)
      'other'
    )
  );

-- ── 3. Storage RLS policies for service-role access ──────────────────────────
-- The Express backend uses SUPABASE_SERVICE_KEY (supabaseAdmin) which bypasses RLS.
-- No additional policies needed for server-side uploads.
-- If you want to block direct public access, ensure bucket public = false (already set above).

SELECT
  'Migration 023 complete' AS status,
  (SELECT COUNT(*) FROM storage.buckets WHERE id = 'wallet-docs') AS wallet_docs_bucket_exists,
  (SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE table_name = 'wallet_documents'
   AND constraint_name = 'wallet_documents_doc_type_check') AS doc_type_constraint_exists;
