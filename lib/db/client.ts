// lib/db/client.ts — Singleton Supabase server-side com connection pooling (gap #18)
//
// Em produção, usa o pooler (PgBouncer) — preencha SUPABASE_POOLER_URL com a URL
// "transaction mode" do projeto. Em dev, conexão direta para evitar limitações
// do pooler com features como prepared statements + LISTEN/NOTIFY.
//
// SUPABASE_SERVICE_ROLE_KEY é OBRIGATÓRIO server-side: bypass das RLS para o motor.
// auth.persistSession=false porque rodamos sem sessão de usuário (multi-tenant via workspace_id).

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const isProd = process.env.NODE_ENV === 'production'

const supabaseUrl =
  (isProd ? process.env.SUPABASE_POOLER_URL : process.env.SUPABASE_DIRECT_URL) ||
  process.env.NEXT_PUBLIC_SUPABASE_URL

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error(
    '[lib/db/client] Missing Supabase URL: defina SUPABASE_POOLER_URL/SUPABASE_DIRECT_URL ou NEXT_PUBLIC_SUPABASE_URL.',
  )
}
if (!supabaseKey) {
  throw new Error(
    '[lib/db/client] Missing Supabase key: defina SUPABASE_SERVICE_ROLE_KEY (server) ou NEXT_PUBLIC_SUPABASE_ANON_KEY (fallback dev).',
  )
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'public' },
})
