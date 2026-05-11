// lib/supabase/server.ts — Server-side Supabase clients para Route Handlers e Server Components.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente que respeita a sessão do usuário via cookies (RLS aplicado).
 * Use em Route Handlers e Server Components que precisam do contexto autenticado.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('[supabase/server] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ausentes.')
  }
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // setAll dentro de Server Component — silencioso (middleware refresca a sessão).
        }
      },
    },
  })
}

/**
 * Cliente com service-role (bypassa RLS). Uso restrito a operações administrativas
 * de servidor — nunca expor ao browser.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('[supabase/server] NEXT_PUBLIC_SUPABASE_URL/SERVICE_ROLE_KEY ausentes.')
  }
  return createServerClient(url, serviceKey, {
    cookies: {
      getAll() { return [] },
      setAll() {},
    },
  })
}
