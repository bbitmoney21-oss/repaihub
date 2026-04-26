import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const supabaseAdmin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export const supabaseAdminConfigured =
  !!url &&
  !!key &&
  !key.startsWith('your-') &&
  !url.startsWith('https://placeholder')
