import { createClient } from '@supabase/supabase-js'

// Use placeholders when env vars are missing so the module never throws on
// import. Every call site already has try/catch — they'll fail gracefully.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co'
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-anon-key'

export const supabase = createClient(url, key)
export const supabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY
