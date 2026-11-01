import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const schema = (import.meta.env.VITE_SUPABASE_SCHEMA as string | undefined) || 'public'

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Only the anon key ever reaches the browser; row-level security does the rest.
export const supabase = createClient(
  supabaseUrl ?? 'https://unconfigured.supabase.co',
  supabaseAnonKey ?? 'unconfigured',
  { db: { schema } },
)
