import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import {
  TeamManager,
  type Member,
  type PendingInvite,
} from '@/components/settings/TeamManager'
import {
  DEFAULT_PROFESSIONAL_PERMISSIONS,
  type ProfessionalPermissions,
  type PermissionLevel,
} from '@/lib/permissions'

type PermissionRow = {
  workspace_user_id: string
  agenda: PermissionLevel
  crm: PermissionLevel
  conversas: PermissionLevel
  relatorios: PermissionLevel
  produtos: PermissionLevel
}

const OWNER_PERMISSIONS: ProfessionalPermissions = {
  agenda: 'edit',
  crm: 'edit',
  conversas: 'edit',
  relatorios: 'edit',
  produtos: 'edit',
}

export default async function TeamSettingsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('workspace_users')
    .select('workspace_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    redirect('/unauthorized')
  }

  const workspaceId = membership.workspace_id as string

  const { data: rows } = await supabase
    .from('workspace_users')
    .select('id, user_id, role')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)

  const memberRows = (rows ?? []) as Array<{
    id: string
    user_id: string
    role: 'owner' | 'professional'
  }>

  const service = createSupabaseServiceClient()
  const userIds = memberRows.map((r) => r.user_id)
  const workspaceUserIds = memberRows.map((r) => r.id)

  const userInfo = new Map<string, { email: string; full_name: string | null }>()
  for (const uid of userIds) {
    try {
      const { data } = await service.auth.admin.getUserById(uid)
      if (data?.user) {
        const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
        const fullName = typeof meta.full_name === 'string' ? meta.full_name : null
        userInfo.set(uid, {
          email: data.user.email ?? '',
          full_name: fullName,
        })
      }
    } catch {
      // fallback applied later
    }
  }

  const profileFilter = userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']
  const { data: profiles } = await service
    .from('user_profiles')
    .select('id, full_name, avatar_url')
    .in('id', profileFilter)

  const profileMap = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >()
  for (const p of (profiles ?? []) as Array<{
    id: string
    full_name: string | null
    avatar_url: string | null
  }>) {
    profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url })
  }

  const permissionsMap = new Map<string, ProfessionalPermissions>()
  if (workspaceUserIds.length > 0) {
    const { data: permRows } = await supabase
      .from('professional_permissions')
      .select('workspace_user_id, agenda, crm, conversas, relatorios, produtos')
      .in('workspace_user_id', workspaceUserIds)

    for (const row of (permRows ?? []) as PermissionRow[]) {
      permissionsMap.set(row.workspace_user_id, {
        agenda: row.agenda,
        crm: row.crm,
        conversas: row.conversas,
        relatorios: row.relatorios,
        produtos: row.produtos,
      })
    }
  }

  const members: Member[] = memberRows.map((r) => {
    const info = userInfo.get(r.user_id)
    const profile = profileMap.get(r.user_id)
    const permissions: ProfessionalPermissions =
      r.role === 'owner'
        ? { ...OWNER_PERMISSIONS }
        : permissionsMap.get(r.id) ?? { ...DEFAULT_PROFESSIONAL_PERMISSIONS }
    return {
      id: r.id,
      userId: r.user_id,
      email: info?.email ?? '',
      fullName: profile?.full_name ?? info?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: r.role,
      permissions,
      isActive: true,
    }
  })

  members.sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1
    if (b.role === 'owner' && a.role !== 'owner') return 1
    return (a.email || '').localeCompare(b.email || '')
  })

  const nowIso = new Date().toISOString()
  const { data: inviteRows } = await supabase
    .from('workspace_invites')
    .select('id, email, token, created_at, expires_at, accepted_at')
    .eq('workspace_id', workspaceId)
    .is('accepted_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })

  const initialInvites: PendingInvite[] = ((inviteRows ?? []) as Array<{
    id: string
    email: string
    token: string
    created_at: string
    expires_at: string
  }>).map((row) => ({
    id: row.id,
    email: row.email,
    token: row.token,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }))

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Convide profissionais e gerencie permissões de acesso ao workspace.
        </p>
      </header>
      <TeamManager
        initialMembers={members}
        initialInvites={initialInvites}
        workspaceId={workspaceId}
      />
    </div>
  )
}
