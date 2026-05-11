// lib/memory/builder.ts — Constrói o bloco de memória do system prompt.
// SPEC §7: memória semântica injetada na Seção 2 do prompt; episódica em Seção 6
// (consolidamos as duas peças aqui — o prompt-builder T10 decide onde encaixar).

import { getSemantic } from './semantic'
import { getRecent, searchEpisodic } from './episodic'
import type {
  ClientEpisodicMemory,
  ClientMemorySemantic,
} from '@/types/memory'

const EPISODIC_TOP_K = 3

function formatDate(iso: string): string {
  // Formato curto pt-BR (YYYY-MM-DD).
  // Evitamos toLocaleDateString para não depender de ICU no runtime.
  return iso.slice(0, 10)
}

function formatSemantic(sem: ClientMemorySemantic): string {
  const lines: string[] = []
  lines.push('## Memória persistente do cliente')
  if (sem.memory_summary && sem.memory_summary.trim()) {
    lines.push(sem.memory_summary.trim())
  }
  if (sem.preferred_name && sem.preferred_name.trim()) {
    lines.push(`- Apelido preferido: ${sem.preferred_name.trim()}`)
  }
  if (sem.preferences && sem.preferences.length > 0) {
    lines.push(`- Preferências: ${sem.preferences.join(', ')}`)
  }
  if (sem.last_service && sem.last_service.trim()) {
    lines.push(`- Último serviço: ${sem.last_service.trim()}`)
  }
  if (sem.observations && sem.observations.trim()) {
    lines.push(`- Observações: ${sem.observations.trim()}`)
  }
  return lines.join('\n')
}

function formatEpisodes(episodes: ClientEpisodicMemory[]): string {
  if (episodes.length === 0) return ''
  const lines: string[] = []
  lines.push('## Conversas anteriores relevantes')
  for (const ep of episodes) {
    const summary = ep.excerpt_summary?.trim() || '(sem resumo)'
    const date = formatDate(ep.occurred_at)
    const tags =
      ep.topic_tags && ep.topic_tags.length > 0
        ? ` — tags: ${ep.topic_tags.join(', ')}`
        : ''
    lines.push(`- ${summary} (em ${date})${tags}`)
  }
  return lines.join('\n')
}

/**
 * Monta o bloco de memória (semântica + episódica) para injetar no system prompt.
 *
 * - Cliente novo (sem semantic e sem episódica): retorna string vazia (NUNCA throw).
 * - Episódica: top-3 via similaridade se `query` informada; senão últimos 3 por data.
 * - Falha de embedding (OPENAI_API_KEY ausente, API down etc): captura e cai
 *   em getRecent — episódica degradada é melhor que prompt sem memória.
 */
export async function buildMemoryContext(
  client_id: string,
  workspace_id: string,
  query?: string,
): Promise<string> {
  const semanticPromise = getSemantic(client_id, workspace_id).catch((e) => {
    console.warn(
      '[memory/builder] getSemantic falhou — seguindo sem memória semântica',
      (e as Error).message,
    )
    return null
  })

  let episodesPromise: Promise<ClientEpisodicMemory[]>
  if (query && query.trim()) {
    episodesPromise = searchEpisodic(client_id, query.trim(), EPISODIC_TOP_K).catch(
      async (e) => {
        console.warn(
          '[memory/builder] searchEpisodic falhou; degradando para getRecent',
          (e as Error).message,
        )
        return getRecent(client_id, EPISODIC_TOP_K).catch(() => [])
      },
    )
  } else {
    episodesPromise = getRecent(client_id, EPISODIC_TOP_K).catch((e) => {
      console.warn(
        '[memory/builder] getRecent falhou — seguindo sem episódica',
        (e as Error).message,
      )
      return []
    })
  }

  const [semantic, episodes] = await Promise.all([semanticPromise, episodesPromise])

  const parts: string[] = []
  if (semantic) parts.push(formatSemantic(semantic))
  const epBlock = formatEpisodes(episodes)
  if (epBlock) parts.push(epBlock)

  return parts.join('\n\n')
}
