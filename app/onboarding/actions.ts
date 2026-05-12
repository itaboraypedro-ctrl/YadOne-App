'use server'

// app/onboarding/actions.ts — Server actions do onboarding "Conte sobre o seu negócio".

import { revalidatePath } from 'next/cache'
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server'
import { generateBusinessKnowledgeChunks } from '@/lib/onboarding/knowledge-generator'
import type { BusinessProfileData } from '@/lib/onboarding/types'

type SaveResult = { success: boolean; error?: string }

export async function saveBusinessProfile(
  data: BusinessProfileData,
): Promise<SaveResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Sessão expirada. Faça login novamente.' }

  const { data: wu, error: wuErr } = await supabase
    .from('workspace_users')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (wuErr || !wu?.workspace_id) {
    return { success: false, error: 'Workspace não encontrado para o usuário.' }
  }
  const workspaceId = wu.workspace_id as string

  const profile = data.profile
  if (!profile?.name?.trim()) {
    return { success: false, error: 'Nome do negócio é obrigatório.' }
  }

  const service = createSupabaseServiceClient()

  // 1. UPDATE workspaces com o snapshot do perfil.
  const wsUpdate: Record<string, unknown> = {
    business_name: profile.name,
    google_place_id: profile.placeId || null,
    google_places_data: profile.rawData ?? null,
    address: profile.address || null,
    city: profile.city || null,
    state: profile.state || null,
    zip_code: profile.zipCode || null,
    phone: profile.phone || null,
    website: profile.website || null,
    business_hours: profile.businessHours ?? null,
    categories: profile.categories.length ? profile.categories : null,
    services: profile.services.length ? profile.services : null,
    rating: profile.rating ?? null,
    review_count: profile.reviewCount ?? null,
    logo_url: profile.logoUrl || null,
    unit_count: data.unitCount > 0 ? data.unitCount : 1,
    is_chain: data.isChain,
  }

  const { error: updErr } = await service
    .from('workspaces')
    .update(wsUpdate)
    .eq('id', workspaceId)
  if (updErr) {
    console.error('[saveBusinessProfile] update workspace:', updErr)
    return { success: false, error: 'Erro ao salvar dados do negócio.' }
  }

  // 2. INSERT workspace_units (se rede com >1 unidade).
  if (data.isChain && data.units.length > 1) {
    // Limpa unidades antigas pra evitar duplicação caso o user volte na etapa.
    await service.from('workspace_units').delete().eq('workspace_id', workspaceId)

    const rows = data.units.map((u, idx) => ({
      workspace_id: workspaceId,
      google_place_id: u.placeId ?? null,
      name: u.name,
      address: u.address || null,
      city: u.city || null,
      state: u.state || null,
      phone: u.phone || null,
      business_hours: u.businessHours ?? null,
      is_primary: idx === 0 ? true : u.isPrimary,
    }))
    const { error: unitsErr } = await service.from('workspace_units').insert(rows)
    if (unitsErr) {
      console.error('[saveBusinessProfile] insert units:', unitsErr)
      // Não bloqueia — segue com knowledge base.
    }
  }

  // 3. Gera knowledge chunks.
  const chunks = generateBusinessKnowledgeChunks(profile, data.units)

  // 4. INSERT knowledge_base. Schema real (migration 003): workspace_id, tag,
  //    title, content, content_type, is_global, is_indexed.
  if (chunks.length > 0) {
    // Limpa chunks antigos da mesma origem pra idempotência.
    await service
      .from('knowledge_base')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('tag', 'google_places_onboarding')

    const rows = chunks.map((c) => ({
      workspace_id: workspaceId,
      tag: c.source, // 'google_places_onboarding'
      title: c.title,
      content: c.content,
      content_type: 'text' as const,
      is_global: false,
      is_indexed: false,
    }))
    const { error: kbErr } = await service.from('knowledge_base').insert(rows)
    if (kbErr) {
      console.error('[saveBusinessProfile] insert knowledge_base:', kbErr)
      // Não bloqueia — dados do negócio já foram salvos.
    }
  }

  // 5. Avança onboarding_status.
  const { error: statusErr } = await service
    .from('workspaces')
    .update({ onboarding_status: 'agent_pending' })
    .eq('id', workspaceId)
  if (statusErr) {
    console.error('[saveBusinessProfile] update onboarding_status:', statusErr)
  }

  revalidatePath('/onboarding')
  revalidatePath('/onboarding/business')
  return { success: true }
}
