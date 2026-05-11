// lib/db/channel-configs.ts — Helpers de leitura para `channel_configs`.
//
// Criado em F13 para suportar a checagem de `ai_enabled` por canal no
// orchestrator (cascata workspace > channel > conversation). Mantém leitura
// desacoplada de `lib/channels/factory.ts` (que carrega credenciais e instancia
// adapters), pois aqui só queremos o flag de habilitação.

import { supabase } from './client'

export interface ChannelConfigRow {
  id: string
  workspace_id: string
  channel_type: string
  phone_number: string
  is_active: boolean
  ai_enabled: boolean
}

/**
 * Retorna o channel_config ativo correspondente ao workspace + channel_type.
 * Usa o primeiro ativo (mesmo critério do factory). null se não houver.
 */
export async function getChannelConfigByType(
  workspace_id: string,
  channel_type: string,
): Promise<ChannelConfigRow | null> {
  const { data, error } = await supabase
    .from('channel_configs')
    .select('id, workspace_id, channel_type, phone_number, is_active, ai_enabled')
    .eq('workspace_id', workspace_id)
    .eq('channel_type', channel_type)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (error) {
    throw new Error(
      `getChannelConfigByType(${workspace_id}, ${channel_type}) failed: ${error.message}`,
    )
  }
  return (data as ChannelConfigRow) ?? null
}
