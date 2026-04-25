-- RUN THIS IN SUPABASE SQL EDITOR MANUALLY
-- Go to Supabase → SQL Editor → paste and run this entire file
-- Safe to re-run: uses DROP IF EXISTS
--
-- WHY: Two tables existed for transfers data:
--   "Transfer"  (PascalCase) — created by an older Prisma-style schema, NOT used by the app
--   "transfers" (snake_case) — created by supabase-schema.sql, used by all app code
--
-- The app (src/lib/api.ts) exclusively queries public.transfers (lowercase).
-- "Transfer" is dead weight and must be removed to avoid confusion.
--
-- CASCADE drops any foreign keys, views, or policies that reference "Transfer".
-- If any data exists in "Transfer", this will delete it — back up first if needed.

drop table if exists public."Transfer" cascade;
