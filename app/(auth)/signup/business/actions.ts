'use server'

import { redirect } from 'next/navigation'
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server'

export type BusinessState = { error: string | null }

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

export async function createBusinessAction(
  _prev: BusinessState,
  formData: FormData,
): Promise<BusinessState> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada. Faça login novamente.' }

  const businessName = String(formData.get('business_name') ?? '').trim()
  const segment = String(formData.get('segment') ?? '').trim()
  const unitsRaw = String(formData.get('units_count') ?? '').trim()
  const city = String(formData.get('city') ?? '').trim()
  const state = String(formData.get('state') ?? '').trim()
  const challenge = String(formData.get('biggest_challenge') ?? '').trim()
  const contactPhone = String(formData.get('contact_phone') ?? '').trim()

  if (!businessName) return { error: 'Informe o nome do negócio.' }
  if (!segment) return { error: 'Selecione o segmento.' }
  if (!unitsRaw) return { error: 'Informe quantas unidades.' }
  const unitsCount = Number.parseInt(unitsRaw, 10)
  if (!Number.isFinite(unitsCount) || unitsCount < 1) {
    return { error: 'Número de unidades inválido.' }
  }
  if (!city || !state) return { error: 'Informe cidade e UF.' }
  if (!challenge) return { error: 'Conte qual é o maior desafio hoje.' }

  const service = createSupabaseServiceClient()

  // Já existe workspace pra esse user? (ex: voltou na página depois de criar). Se sim, redirect.
  const { data: existing } = await service
    .from('workspace_users')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (existing) {
    redirect('/conversations')
  }

  const slug = `${slugify(businessName) || 'workspace'}-${randomSuffix()}`

  const { data: ws, error: wsErr } = await service
    .from('workspaces')
    .insert({
      name: businessName,
      slug,
      segment,
      status: 'active',
      owner_id: user.id,
      units_count: unitsCount,
      city,
      state,
      biggest_challenge: challenge,
      contact_phone: contactPhone || null,
      pending_team_setup: true,
    })
    .select('id')
    .single()

  if (wsErr || !ws) {
    return { error: 'Não foi possível criar o workspace. Tente novamente.' }
  }

  const { error: wuErr } = await service.from('workspace_users').insert({
    workspace_id: ws.id,
    user_id: user.id,
    role: 'owner',
    is_active: true,
  })

  if (wuErr) {
    // rollback do workspace pra não deixar órfão
    await service.from('workspaces').delete().eq('id', ws.id)
    return { error: 'Não foi possível associar você ao workspace. Tente novamente.' }
  }

  redirect('/conversations')
}
