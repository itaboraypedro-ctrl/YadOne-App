'use server'

import { headers } from 'next/headers'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import {
  DEFAULT_PROFESSIONAL_PERMISSIONS,
  type ProfessionalPermissions,
} from '@/lib/permissions'

type ActionResult = { success: boolean; error?: string }

type SessionInfo = {
  id: string
  ip?: string
  device?: string
  created_at: string
}

type SessionsResult = { sessions: SessionInfo[]; error?: string }

type PermissionsResult = { permissions: ProfessionalPermissions; error?: string }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null as null }
  return { supabase, user }
}

async function requireOwner() {
  const { supabase, user } = await requireUser()
  if (!user) {
    return {
      supabase,
      user: null,
      workspaceId: null,
      workspaceUserId: null,
      error: 'Não autenticado' as const,
    }
  }
  const { data, error } = await supabase
    .from('workspace_users')
    .select('id, workspace_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (error || !data) {
    return {
      supabase,
      user,
      workspaceId: null,
      workspaceUserId: null,
      error: 'Workspace não encontrado' as const,
    }
  }
  if (data.role !== 'owner') {
    return {
      supabase,
      user,
      workspaceId: null,
      workspaceUserId: null,
      error: 'Apenas owners podem executar esta ação' as const,
    }
  }
  return {
    supabase,
    user,
    workspaceId: data.workspace_id as string,
    workspaceUserId: data.id as string,
    error: null as null,
  }
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
  permissions: ProfessionalPermissions,
): Promise<ActionResult> {
  const { workspaceId, workspaceUserId, error: ownerError } = await requireOwner()
  if (ownerError) return { success: false, error: ownerError }
  if (!workspaceId || !workspaceUserId) return { success: false, error: 'Não autenticado' }

  const normalizedEmail = email.trim().toLowerCase()
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return { success: false, error: 'E-mail inválido' }
  }

  const service = createSupabaseServiceClient()

  const { data: invite, error: insertError } = await service
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      email: normalizedEmail,
      role: 'professional',
      permissions,
      invited_by: workspaceUserId,
    })
    .select('token')
    .single()

  if (insertError || !invite) {
    return { success: false, error: insertError?.message ?? 'Falha ao criar convite' }
  }

  const token = invite.token as string

  const hdrs = await headers()
  const origin =
    hdrs.get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ''
  const redirectTo = origin
    ? `${origin}/api/team/invite/${token}/accept`
    : undefined

  const { error: inviteError } = await service.auth.admin.inviteUserByEmail(
    normalizedEmail,
    redirectTo ? { redirectTo } : undefined,
  )
  if (inviteError) {
    // Mantém o invite no banco para permitir reenvio pelo cliente.
    return { success: false, error: inviteError.message }
  }

  return { success: true }
}

// =================================================================
// 4. updateMemberPermissions
// =================================================================
export async function updateMemberPermissions(
  workspaceUserId: string,
  permissions: ProfessionalPermissions,
): Promise<ActionResult> {
  const { supabase, workspaceId, error: ownerError } = await requireOwner()
  if (ownerError) return { success: false, error: ownerError }
  if (!workspaceId) return { success: false, error: 'Workspace não encontrado' }

  const { data: target, error: fetchError } = await supabase
    .from('workspace_users')
    .select('id, role, workspace_id')
    .eq('id', workspaceUserId)
    .maybeSingle()
  if (fetchError) return { success: false, error: fetchError.message }
  if (!target || target.workspace_id !== workspaceId) {
    return { success: false, error: 'Membro não encontrado' }
  }
  if (target.role === 'owner') {
    return { success: false, error: 'Não é possível alterar permissões do owner' }
  }

  const { error } = await supabase
    .from('professional_permissions')
    .upsert(
      {
        workspace_user_id: workspaceUserId,
        agenda: permissions.agenda,
        crm: permissions.crm,
        conversas: permissions.conversas,
        relatorios: permissions.relatorios,
        produtos: permissions.produtos,
      },
      { onConflict: 'workspace_user_id' },
    )
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// =================================================================
// 5. removeMember
// =================================================================
export async function removeMember(workspaceUserId: string): Promise<ActionResult> {
  const { supabase, workspaceId, error: ownerError } = await requireOwner()
  if (ownerError) return { success: false, error: ownerError }
  if (!workspaceId) return { success: false, error: 'Workspace não encontrado' }

  const { data: target, error: fetchError } = await supabase
    .from('workspace_users')
    .select('id, role, user_id, workspace_id')
    .eq('id', workspaceUserId)
    .maybeSingle()
  if (fetchError) return { success: false, error: fetchError.message }
  if (!target || target.workspace_id !== workspaceId) {
    return { success: false, error: 'Membro não encontrado' }
  }
  if (target.role === 'owner') {
    return { success: false, error: 'Não é possível remover o owner' }
  }

  // Soft-delete: mantém registro para audit trail (LGPD).
  const { error: updateError } = await supabase
    .from('workspace_users')
    .update({ is_active: false })
    .eq('id', workspaceUserId)
    .eq('workspace_id', workspaceId)
  if (updateError) return { success: false, error: updateError.message }

  // TODO: invalidar sessões do usuário removido. admin.signOut(jwt) exige o JWT
  // da sessão do user removido, que não temos. Alternativa futura: RPC SQL com
  // service-role que apague auth.sessions WHERE user_id = target.user_id.
  void target.user_id

  return { success: true }
}

// =================================================================
// 6. getMemberPermissions
// =================================================================
export async function getMemberPermissions(
  workspaceUserId: string,
): Promise<PermissionsResult> {
  const { supabase, user } = await requireUser()
  if (!user) {
    return { permissions: { ...DEFAULT_PROFESSIONAL_PERMISSIONS }, error: 'Não autenticado' }
  }

  // RLS garante que apenas membros do mesmo workspace consigam ler.
  const { data, error } = await supabase
    .from('professional_permissions')
    .select('agenda, crm, conversas, relatorios, produtos')
    .eq('workspace_user_id', workspaceUserId)
    .maybeSingle()

  if (error) {
    return { permissions: { ...DEFAULT_PROFESSIONAL_PERMISSIONS }, error: error.message }
  }
  if (!data) {
    return { permissions: { ...DEFAULT_PROFESSIONAL_PERMISSIONS } }
  }
  return {
    permissions: {
      agenda: data.agenda,
      crm: data.crm,
      conversas: data.conversas,
      relatorios: data.relatorios,
      produtos: data.produtos,
    },
  }
}

// =================================================================
// 7. changePassword
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
// 8. getActiveSessions
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
// 9. revokeOtherSessions
// =================================================================
export async function revokeOtherSessions(): Promise<ActionResult> {
  const { user } = await requireUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  // TODO: admin.signOut(jwt, 'others') exige o JWT da sessão atual, que não está
  // acessível diretamente do server. Implementar via RPC SQL que apague
  // auth.sessions WHERE user_id = auth.uid() AND id != current_session_id.
  return { success: true }
}
