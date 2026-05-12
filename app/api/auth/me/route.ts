// app/api/auth/me/route.ts — GET retorna CurrentUser (user + workspace + role).

import { NextResponse } from 'next/server'
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server'
import type { CurrentUser } from '@/lib/types/frontend'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // Service role para bypass de RLS no lookup de workspace_users + workspaces.
  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from('workspace_users')
    .select('workspace_id, role, workspaces:workspace_id ( id, name )')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'no_workspace' }, { status: 403 })
  }

  // Postgrest pode retornar a relação como objeto ou array, dependendo do schema cache.
  const ws = Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces
  const workspaceName = (ws as { name?: string } | null | undefined)?.name ?? ''

  const role: CurrentUser['role'] = data.role === 'owner' ? 'owner' : 'professional'

  const payload: CurrentUser = {
    user_id: user.id,
    email: user.email ?? '',
    workspace_id: data.workspace_id as string,
    workspace_name: workspaceName,
    role,
  }

  return NextResponse.json(payload)
}
