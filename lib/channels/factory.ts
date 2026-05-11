// lib/channels/factory.ts — Resolução do adapter correto por workspace ou phone_number.
// TODO: substituir query direta por import from '@/lib/db/channel-configs.ts' após T03.

import { createClient } from '@supabase/supabase-js'
import { ChannelAdapter, ChannelCredentials, ChannelType } from './types'
import { YCloudAdapter } from './ycloud'
import { ZAPIAdapter } from './zapi'
import { EvolutionAdapter } from './evolution'

interface ChannelConfigRow {
  id: string
  workspace_id: string
  channel_type: ChannelType
  credentials: ChannelCredentials
  phone_number: string
  is_active: boolean
}

function getServerClient() {
  const url = process.env.SUPABASE_DIRECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('[channels/factory] Faltam env vars de Supabase (URL/KEY).')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

function buildAdapter(config: ChannelConfigRow): ChannelAdapter {
  switch (config.channel_type) {
    case 'ycloud':
      return new YCloudAdapter(config.credentials)
    case 'zapi':
      return new ZAPIAdapter(config.credentials)
    case 'evolution':
      return new EvolutionAdapter(config.credentials)
    default: {
      const exhaustive: never = config.channel_type
      throw new Error(`[channels/factory] channel_type desconhecido: ${exhaustive as string}`)
    }
  }
}

export async function getChannelAdapter(workspace_id: string): Promise<ChannelAdapter> {
  const supabase = getServerClient()
  const { data, error } = await supabase
    .from('channel_configs')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`[channels/factory] query falhou: ${error.message}`)
  if (!data) throw new Error(`[channels/factory] nenhum channel_config ativo para workspace ${workspace_id}`)
  return buildAdapter(data as ChannelConfigRow)
}

export async function getChannelAdapterByPhoneNumber(phone_number: string): Promise<ChannelAdapter> {
  const supabase = getServerClient()
  const { data, error } = await supabase
    .from('channel_configs')
    .select('*')
    .eq('phone_number', phone_number)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`[channels/factory] query falhou: ${error.message}`)
  if (!data) {
    throw new Error(
      `[channels/factory] nenhum channel_config ativo para phone_number ${phone_number}`,
    )
  }
  return buildAdapter(data as ChannelConfigRow)
}

export interface ChannelResolution {
  adapter: ChannelAdapter
  workspace_id: string
  channel_type: ChannelType
  phone_number: string
}

/**
 * Resolve adapter + workspace_id + channel_type a partir do phone_number conectado.
 * Usado pelos webhooks para passar `workspace_id` ao orchestrator (T17).
 */
export async function resolveChannelByPhoneNumber(
  phone_number: string,
): Promise<ChannelResolution> {
  const supabase = getServerClient()
  const { data, error } = await supabase
    .from('channel_configs')
    .select('*')
    .eq('phone_number', phone_number)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`[channels/factory] query falhou: ${error.message}`)
  if (!data) {
    throw new Error(
      `[channels/factory] nenhum channel_config ativo para phone_number ${phone_number}`,
    )
  }
  const row = data as ChannelConfigRow
  return {
    adapter: buildAdapter(row),
    workspace_id: row.workspace_id,
    channel_type: row.channel_type,
    phone_number: row.phone_number,
  }
}
