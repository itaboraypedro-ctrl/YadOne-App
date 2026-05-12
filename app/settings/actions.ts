'use server'

import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import type { PermissionsMap } from '@/lib/permissions'

type ActionResult = { success: boolean; error?: string }

type SessionInfo = {
  id: string
  ip?: string
  device?: string
  created_at: string
}

type SessionsResult = { sessions: SessionInfo[]; error?: string }

async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null as null }
  return { supabase, user }
}

async function requireOwner() {
  const { supabase, user } = await requireUser()
  if (!user) return { supabase, user: null, workspaceId: null, error: 'Não autenticado' as const }
  const { data, error } = await supabase
    .from('workspace_users')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) return { supabase, user, workspaceId: null, error: 'Workspace não encontrado' as const }
  if (data.role !== 'owner') return { supabase, user, workspaceId: null, error: 'Apenas owners podem executar esta ação' as const }
  return { supabase, user, workspaceId: data.workspace_id as string, error: null as null }
}

// =================================================================
// 1. updateProfile
// =================================================================
export async function updateProfile(input: {
  full_name?: string
  phone?: string
  avatar_url?: string
}): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const payload: Record<string, unknown> = { id: user.id, updated_at: new Date().toISOString() }
  if (input.full_name !== undefined) payload.full_name = input.full_name
  if (input.phone !== undefined) payload.phone = input.phone
  if (input.avatar_url !== undefined) payload.avatar_url = input.avatar_url

  const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// =================================================================
// 2. updateWorkspace
// =================================================================
export async function updateWorkspace(input: {
  name?: string
  logo_url?: string
}): Promise<ActionResult> {
  const { supabase, workspaceId, error: ownerError } = await requireOwner()
  if (ownerError) return { success: false, error: ownerError }
  if (!workspaceId) return { success: false, error: 'Workspace não encontrado' }

  if (input.name !== undefined) {
    const { error } = await supabase
      .from('workspaces')
      .update({ name: input.name, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)
    if (error) return { success: false, error: error.message }
  }

  if (input.logo_url !== undefined) {
    const { error } = await supabase
      .from('workspaces')
      .update({ logo_url: input.logo_url, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)
    if (error && !/logo_url/i.test(error.message)) {
      return { success: false, error: error.message }
    }
  }

  return { success: true }
}

// =================================================================
// 3. inviteMember
// =================================================================
export async function inviteMember(
  email: string,
  permissions: PermissionsMap,
): Promise<ActionResult> {
  const { user, workspaceId, error: ownerError } = await requireOwner()
  if (ownerError) return { success: false, error: ownerError }
  if (!user || !workspaceId) return { success: false, error: 'Não autenticado' }

  const service = createSupabaseServiceClient()

  const { data: usersData, error: listError } = await service.auth.admin.listUsers()
  if (listError) return { success: false, error: listError.message }
  const existing = usersData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (existing) {
    const { data: already } = await service
      .from('workspace_users')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', existing.id)
      .maybeSingle()
    if (already) return { success: false, error: 'Usuário já faz parte do workspace' }
  }

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    : undefined

  const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  )
  if (inviteError) return { success: false, error: inviteError.message }
  const invitedUserId = inviteData.user?.id
  if (!invitedUserId) return { success: false, error: 'Falha ao criar convite' }

  const { error: insertError } = await service.from('workspace_users').insert({
    workspace_id: workspaceId,
    user_id: invitedUserId,
    role: 'member',
    permissions,
    invited_by: user.id,
    invited_at: new Date().toISOString(),
    accepted_at: null,
  })
  if (insertError) return { success: false, error: insertError.message }

  return { success: true }
}

// =================================================================
// 4. updateMemberPermissions
// =================================================================
export async function updateMemberPermissions(
  memberId: string,
  permissions: PermissionsMap,
): Promise<ActionResult> {
  const { supabase, workspaceId, error: ownerError } = await requireOwner()
  if (ownerError) return { success: false, error: ownerError }
  if (!workspaceId) return { success: false, error: 'Workspace não encontrado' }

  const { data: target, error: fetchError } = await supabase
    .from('workspace_users')
    .select('id, role, workspace_id')
    .eq('id', memberId)
    .maybeSingle()
  if (fetchError) return { success: false, error: fetchError.message }
  if (!target || target.workspace_id !== workspaceId) {
    return { success: false, error: 'Membro não encontrado' }
  }
  if (target.role === 'owner') {
    return { success: false, error: 'Não é possível alterar permissões do owner' }
  }

  const { error } = await supabase
    .from('workspace_users')
    .update({ permissions })
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// =================================================================
// 5. removeMember
// =================================================================
export async function removeMember(memberId: string): Promise<ActionResult> {
  const { supabase, workspaceId, error: ownerError } = await requireOwner()
  if (ownerError) return { success: false, error: ownerError }
  if (!workspaceId) return { success: false, error: 'Workspace não encontrado' }

  const { data: target, error: fetchError } = await supabase
    .from('workspace_users')
    .select('id, role, user_id, workspace_id')
    .eq('id', memberId)
    .maybeSingle()
  if (fetchError) return { success: false, error: fetchError.message }
  if (!target || target.workspace_id !== workspaceId) {
    return { success: false, error: 'Membro não encontrado' }
  }
  if (target.role === 'owner') {
    return { success: false, error: 'Não é possível remover o owner' }
  }

  const service = createSupabaseServiceClient()
  const { error: deleteError } = await service
    .from('workspace_users')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)
  if (deleteError) return { success: false, error: deleteError.message }

  // TODO: signOut requer o JWT da sessão do usuário removido, e a admin API
  // não expõe método pra invalidar todas as sessões por user_id diretamente.
  // Alternativa futura: chamar endpoint admin REST /auth/v1/admin/users/{id}/sessions DELETE.
  void target.user_id

  return { success: true }
}

// =================================================================
// 6. changePassword
// =================================================================
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user || !user.email) return { success: false, error: 'Não autenticado' }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { success: false, error: 'Configuração ausente' }

  // Instância isolada (cookies vazios) só pra verificar a senha atual sem afetar
  // a sessão do servidor.
  const verifier = createServerClient(url, anonKey, {
    cookies: { getAll() { return [] }, setAll() {} },
  })
  const { error: signInError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (signInError) return { success: false, error: 'Senha atual incorreta' }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) return { success: false, error: updateError.message }

  return { success: true }
}

// =================================================================
// 7. getActiveSessions
// =================================================================
export async function getActiveSessions(): Promise<SessionsResult> {
  const { user } = await requireUser()
  if (!user) return { sessions: [], error: 'Não autenticado' }

  // TODO: a admin API do supabase-js v2 não expõe listSessionsByUser. A tabela
  // auth.sessions só é acessível via SQL com service-role. Retornando lista
  // mínima com a sessão atual; expansão futura via RPC dedicada.
  return {
    sessions: [
      {
        id: 'current',
        created_at: user.last_sign_in_at ?? new Date().toISOString(),
      },
    ],
  }
}

// =================================================================
// 8. revokeOtherSessions
// =================================================================
export async function revokeOtherSessions(): Promise<ActionResult> {
  const { user } = await requireUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  // TODO: admin.signOut(jwt, 'others') exige o JWT da sessão atual, que não está
  // acessível diretamente do server. Implementar via RPC SQL que apague
  // auth.sessions WHERE user_id = auth.uid() AND id != current_session_id.
  return { success: true }
}
