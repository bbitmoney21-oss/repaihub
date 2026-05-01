-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014: Track signup completion explicitly on profiles.
--
-- WHY: The on_auth_user_created trigger inserts a profile row immediately
-- when a user fills step 1 of signup (email + password), even if they abandon
-- residency selection / KYC / bank linking. The product flagged this as a
-- data-integrity / privacy concern: incomplete profiles look like real users.
--
-- This migration adds a signup_complete boolean. It defaults to FALSE for new
-- profiles and is flipped to TRUE only when the user finishes the final
-- onboarding step (India KYC submission). Existing users are backfilled to
-- TRUE if they already have both bank accounts on file.
--
-- Run this in the Supabase SQL Editor against BOTH dev and prod projects
-- before deploying the matching code change.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: any existing user who already has both KYC flags set is treated
-- as fully onboarded. New rows default to FALSE per the column default above.
UPDATE public.profiles p
   SET signup_complete = TRUE
  FROM public.kyc_submissions k
 WHERE k.user_id = p.id
   AND k.canada_verified = TRUE
   AND k.india_verified = TRUE
   AND p.signup_complete = FALSE;

-- Optional: index for admin queries that filter by completion status
CREATE INDEX IF NOT EXISTS idx_profiles_signup_complete
  ON public.profiles (signup_complete)
  WHERE signup_complete = FALSE;
