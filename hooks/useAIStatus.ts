// hooks/useAIStatus.ts — Hook de status global da IA (stub).
// TODO(F07/F18): integrar com /api/ai/status real (workspace + canal + conversa).
'use client'

import type { AIStatus } from '@/lib/types/frontend'

export interface UseAIStatusResult {
  status: AIStatus
  loading: boolean
}

/**
 * Retorna o status agregado da IA para uso na Sidebar.
 * Por ora é stub fixo em 'active'; F07/F18 trocarão por fetch real.
 */
export function useAIStatus(): UseAIStatusResult {
  return { status: 'active', loading: false }
}
