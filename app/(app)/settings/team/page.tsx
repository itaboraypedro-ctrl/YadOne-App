import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { TeamManager, type Member } from '@/components/settings/TeamManager'
import {
  DEFAULT_PERMISSIONS,
  type PermissionsMap,
  type ModuleId,
  type PermissionLevel,
} from '@/lib/permissions'

function normalizePermissions(raw: unknown): PermissionsMap {
  const out: PermissionsMap = { ...DEFAULT_PERMISSIONS }
  if (!raw || typeof raw !== 'object') return out
  const obj = raw as Record<string, unknown>
  for (const mod of Object.keys(out) as ModuleId[]) {
    const v = obj[mod]
    if (v === 'view' || v === 'edit' || v === 'none') {
      out[mod] = v as PermissionLevel
    }
  }
  return out
}

export default async function TeamSettingsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('workspace_users')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    redirect('/unauthorized')
  }

  const workspaceId = membership.workspace_id as string

  const { data: rows } = await supabase
    .from('workspace_users')
    .select('id, user_id, role, permissions, invited_at, accepted_at')
    .eq('workspace_id', workspaceId)

  const service = createSupabaseServiceClient()
  const userIds = (rows ?? []).map((r) => r.user_id as string)

  const userInfo = new Map<string, { email: string; full_name: string | null }>()
  for (const uid of userIds) {
    const { data } = await service.auth.admin.getUserById(uid)
    if (data?.user) {
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
      const fullName = typeof meta.full_name === 'string' ? meta.full_name : null
      userInfo.set(uid, {
        email: data.user.email ?? '',
        full_name: fullName,
      })
    }
  }

  const { data: profiles } = await service
    .from('user_profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

  const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>()
  for (const p of (profiles ?? []) as Array<{
    id: string
    full_name: string | null
    avatar_url: string | null
  }>) {
    profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url })
  }

  const members: Member[] = (rows ?? []).map((r) => {
    const uid = r.user_id as string
    const info = userInfo.get(uid)
    const profile = profileMap.get(uid)
    return {
      id: r.id as string,
      user_id: uid,
      email: info?.email ?? '',
      full_name: profile?.full_name ?? info?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: r.role as 'owner' | 'member' | 'agent',
      permissions: normalizePermissions(r.permissions),
      invited_at: (r.invited_at as string | null) ?? null,
      accepted_at: (r.accepted_at as string | null) ?? null,
    }
  })

  members.sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1
    if (b.role === 'owner' && a.role !== 'owner') return 1
    return (a.email || '').localeCompare(b.email || '')
  })

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Convide membros e gerencie permissões de acesso ao workspace.
        </p>
      </header>
      <TeamManager initialMembers={members} workspaceId={workspaceId} />
    </div>
  )
}
