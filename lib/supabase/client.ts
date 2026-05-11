// lib/supabase/client.ts — Browser-side Supabase client (anon key, RLS enforced).

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('[supabase/client] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ausentes.')
  }
  return createBrowserClient(url, anonKey)
}
