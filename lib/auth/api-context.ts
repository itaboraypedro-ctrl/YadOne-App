// lib/auth/api-context.ts — Helper de auth compartilhado pelos Route Handlers do frontend.
// Resolve user (RLS-aware) + workspace_id + role + cliente service-role para queries multi-tenant.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server'

export interface ApiAuthContext {
  user: { id: string; email: string | null }
  workspace_id: string
  role: 'owner' | 'agent'
  svc: SupabaseClient
}

export type ApiAuthResult =
  | { ok: true; ctx: ApiAuthContext }
  | { ok: false; response: NextResponse }

export async function getApiAuthContext(): Promise<ApiAuthResult> {
  const sb = await createSupabaseServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }

  const svc = createSupabaseServiceClient()
  const { data: ws, error } = await svc
    .from('workspace_users')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !ws) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'no_workspace' }, { status: 403 }),
    }
  }

  const role: 'owner' | 'agent' = ws.role === 'owner' ? 'owner' : 'agent'

  return {
    ok: true,
    ctx: {
      user: { id: user.id, email: user.email ?? null },
      workspace_id: ws.workspace_id as string,
      role,
      svc: svc as unknown as SupabaseClient,
    },
  }
}
