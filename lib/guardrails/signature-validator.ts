// lib/guardrails/signature-validator.ts — Validação centralizada de signatures
// Delega para o adapter correto sem hit no banco. Cada adapter implementa
// a verificação HMAC/secret específica do seu canal.

import { ChannelAdapter, ChannelCredentials, ChannelType } from '@/lib/channels/types'
import { YCloudAdapter } from '@/lib/channels/ycloud'
import { ZAPIAdapter } from '@/lib/channels/zapi'
import { EvolutionAdapter } from '@/lib/channels/evolution'

function buildAdapter(
  channel_type: ChannelType,
  credentials: ChannelCredentials,
): ChannelAdapter {
  switch (channel_type) {
    case 'ycloud':
      return new YCloudAdapter(credentials)
    case 'zapi':
      return new ZAPIAdapter(credentials)
    case 'evolution':
      return new EvolutionAdapter(credentials)
    default: {
      const exhaustive: never = channel_type
      throw new Error(
        `[guardrails/signature-validator] channel_type desconhecido: ${exhaustive as string}`,
      )
    }
  }
}

/**
 * Valida a signature de um webhook delegando ao adapter do canal.
 * Não consulta o banco; o caller deve fornecer credentials já carregadas.
 */
export function validateChannelSignature(
  channel_type: ChannelType,
  credentials: ChannelCredentials,
  headers: Record<string, string>,
  rawBody: string,
): boolean {
  const adapter = buildAdapter(channel_type, credentials)
  return adapter.validateSignature(headers, rawBody)
}
