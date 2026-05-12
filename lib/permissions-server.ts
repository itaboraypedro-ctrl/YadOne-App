import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  DEFAULT_PERMISSIONS,
  LEVEL_RANK,
  normalizePermissions,
  type ModuleId,
  type PermissionLevel,
  type PermissionsMap,
} from '@/lib/permissions'

export async function getWorkspaceRole(): Promise<'owner' | 'member' | 'agent' | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('workspace_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) return null
  const role = data.role as string
  if (role === 'owner' || role === 'member' || role === 'agent') return role
  return null
}

export async function getMyPermissions(): Promise<PermissionsMap> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ...DEFAULT_PERMISSIONS }
  const { data, error } = await supabase
    .from('workspace_users')
    .select('role, permissions')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) return { ...DEFAULT_PERMISSIONS }
  if (data.role === 'owner') {
    return { chat: 'edit', flows: 'edit', ai_config: 'edit', crm: 'edit', settings: 'edit' }
  }
  return normalizePermissions(data.permissions)
}

export async function hasPermission(module: ModuleId, level: PermissionLevel): Promise<boolean> {
  const role = await getWorkspaceRole()
  if (role === 'owner') return true
  const perms = await getMyPermissions()
  return LEVEL_RANK[perms[module]] >= LEVEL_RANK[level]
}
