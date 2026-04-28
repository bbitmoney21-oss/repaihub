import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'

export const supabaseAdminConfigured =
  url !== 'https://placeholder.supabase.co' &&
  key !== 'placeholder-key' &&
  !key.startsWith('your-') &&
  !url.startsWith('https://placeholder')

// createClient requires non-empty strings — use placeholders so the import
// never throws; supabaseAdminConfigured guards all actual DB calls.
export const supabaseAdmin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})
