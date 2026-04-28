// Server-side Supabase client using the anon key (for auth operations).
// For admin/service-role operations (bypassing RLS), use supabaseServer.ts instead.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
