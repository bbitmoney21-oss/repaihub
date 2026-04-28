-- Migration 006 — Add residency column to profiles
-- Safe to re-run (IF NOT EXISTS).
-- Run in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS residency TEXT
    CHECK (residency IN ('citizen','pr','oci','work_permit'));
