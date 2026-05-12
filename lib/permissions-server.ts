import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  AREAS_ALWAYS_BLOCKED_FOR_PROFESSIONAL,
  DEFAULT_PERMISSIONS,
  LEVEL_RANK,
  normalizePermissions,
  type ModuleId,
  type PermissionLevel,
  type PermissionsMap,
} from '@/lib/permissions'

export async function getWorkspaceRole(): Promise<'owner' | 'professional' | null> {
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
  if (role === 'owner' || role === 'professional') return role
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
  if ((AREAS_ALWAYS_BLOCKED_FOR_PROFESSIONAL as readonly string[]).includes(module)) {
    return false
  }
  const perms = await getMyPermissions()
  return LEVEL_RANK[perms[module]] >= LEVEL_RANK[level]
}
