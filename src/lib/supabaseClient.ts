import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** True jika env Supabase tersedia. Jika false, aplikasi berjalan dengan data simulasi. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Client Supabase (null jika belum dikonfigurasi, agar build di Vercel tidak gagal). */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null
