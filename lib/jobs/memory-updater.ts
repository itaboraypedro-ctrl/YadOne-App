// lib/jobs/memory-updater.ts — Worker que processa memória pós-conversa (T20).
//
// Lógica:
//  1. Busca até 10 sessões com status IN ('completed','expired','handoff')
//     AND memory_processed = false. Limit baixo: cada sessão dispara 2 chamadas LLM.
//  2. Para cada (loop sequencial):
//     a. Carrega histórico completo (getHistory(id, null)).
//     b. Carrega memória semântica existente (se houver).
//     c. Extrai insights consolidados (extractInsightsFromConversation).
//     d. Persiste via upsertSemantic (gera memory_summary derivado).
//     e. Extrai episódios relevantes (extractEpisodes — pode retornar []).
//     f. Para cada episódio: indexEpisode (gera embedding + persiste).
//     g. Marca sessão como memory_processed=true.
//  3. Falha antes de (g) deixa memory_processed=false → retry no próximo tick
//     (loop natural via WHERE memory_processed = false).
//  4. Erros por sessão são capturados — não bloqueiam as demais.

import { supabase } from '@/lib/db/client'
import { updateSession } from '@/lib/db/sessions'
import { getHistory } from '@/lib/db/messages'
import { getSemantic, upsertSemantic } from '@/lib/memory/semantic'
import { indexEpisode } from '@/lib/memory/episodic'
import {
  extractInsightsFromConversation,
  extractEpisodes,
  type ConversationMessage,
} from '@/lib/memory/extractor'
import { logAudit } from '@/lib/db/audit'
import type { MemoryInsights } from '@/types/memory'

interface PendingSessionRow {
  id: string
  workspace_id: string
  client_id: string
}

const MAX_SUMMARY_CHARS = 500

/**
 * Deriva um memory_summary curto a partir dos campos estruturados.
 * Necessário porque upsertSemantic exige memory_summary mas o extractor não emite.
 */
function buildMemorySummary(insights: MemoryInsights): string {
  const parts: string[] = []
  if (insights.preferred_name) parts.push(`Nome preferido: ${insights.preferred_name}`)
  if (insights.preferences.length > 0) {
    parts.push(`Preferências: ${insights.preferences.join(', ')}`)
  }
  if (insights.last_service) parts.push(`Último serviço: ${insights.last_service}`)
  if (insights.observations) parts.push(`Observações: ${insights.observations}`)
  const joined = parts.join('. ')
  if (joined.length <= MAX_SUMMARY_CHARS) return joined
  return joined.slice(0, MAX_SUMMARY_CHARS - 1) + '…'
}

/**
 * Filtra mensagens para o shape exigido pelo extractor (apenas user/assistant).
 */
function toConversationMessages(
  rows: Array<{ role: string; content: string }>,
): ConversationMessage[] {
  const out: ConversationMessage[] = []
  for (const r of rows) {
    if (r.role !== 'user' && r.role !== 'assistant') continue
    if (!r.content) continue
    out.push({ role: r.role, content: r.content })
  }
  return out
}

export async function processMemoryUpdates(): Promise<{
  processed: number
  episodes_indexed: number
  errors: number
}> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, workspace_id, client_id')
    .in('status', ['completed', 'expired', 'handoff'])
    .eq('memory_processed', false)
    .limit(10)

  if (error) {
    void logAudit('job.memory_updater_query_failed', { error: error.message }, {})
    return { processed: 0, episodes_indexed: 0, errors: 1 }
  }

  const rows = (data ?? []) as PendingSessionRow[]
  let processed = 0
  let episodes_indexed = 0
  let errors = 0

  for (const row of rows) {
    try {
      const messages = await getHistory(row.id, null)
      const conv = toConversationMessages(messages)

      const existing = await getSemantic(row.client_id, row.workspace_id)
      const insights = await extractInsightsFromConversation(
        conv,
        existing ?? undefined,
      )

      await upsertSemantic({
        client_id: row.client_id,
        workspace_id: row.workspace_id,
        memory_summary: buildMemorySummary(insights),
        preferred_name: insights.preferred_name,
        preferences: insights.preferences,
        last_service: insights.last_service,
        observations: insights.observations,
        raw_insights: insights.raw_insights,
      })

      const episodes = await extractEpisodes(conv)
      for (const ep of episodes) {
        await indexEpisode({
          client_id: row.client_id,
          workspace_id: row.workspace_id,
          session_id: row.id,
          conversation_excerpt: ep.conversation_excerpt,
          excerpt_summary: ep.excerpt_summary,
          topic_tags: ep.topic_tags,
        })
        episodes_indexed++
      }

      await updateSession(row.id, { memory_processed: true })
      processed++
    } catch (e) {
      errors++
      void logAudit(
        'job.memory_updater_failed',
        { session_id: row.id, error: (e as Error).message },
        { workspace_id: row.workspace_id, session_id: row.id },
      )
    }
  }

  return { processed, episodes_indexed, errors }
}
