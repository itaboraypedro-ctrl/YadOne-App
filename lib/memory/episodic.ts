// lib/memory/episodic.ts — Memória episódica com vector search.
// GAP #4: episódica inclui topic_tags + excerpt_summary + embedding (1536 dim).

import {
  getMemoryEpisodic,
  insertMemoryEpisodic,
  vectorSearchEpisodic,
} from '@/lib/db/memory'
import { embedText } from './embedding'
import type { ClientEpisodicMemory } from '@/types/memory'

interface IndexEpisodeInput {
  client_id: string
  workspace_id: string
  session_id: string | null
  conversation_excerpt: string
  excerpt_summary: string
  topic_tags: string[]
}

/**
 * Episódios mais recentes do cliente (sem similaridade — uso para "últimas conversas").
 */
export async function getRecent(
  client_id: string,
  limit: number = 10,
): Promise<ClientEpisodicMemory[]> {
  return getMemoryEpisodic(client_id, limit)
}

/**
 * Busca episódios semanticamente similares à query.
 * Embedding via OpenAI text-embedding-3-small + RPC vector_search_episodes.
 */
export async function searchEpisodic(
  client_id: string,
  query: string,
  top_k: number = 3,
): Promise<ClientEpisodicMemory[]> {
  const queryEmbedding = await embedText(query)
  return vectorSearchEpisodic(client_id, queryEmbedding, top_k)
}

/**
 * Indexa um novo episódio. Embedding gerado a partir do excerpt_summary
 * (não do excerpt completo) para manter signal/noise alto.
 */
export async function indexEpisode(
  input: IndexEpisodeInput,
): Promise<ClientEpisodicMemory> {
  const embedding = await embedText(input.excerpt_summary)
  return insertMemoryEpisodic({
    client_id: input.client_id,
    workspace_id: input.workspace_id,
    session_id: input.session_id,
    conversation_excerpt: input.conversation_excerpt,
    excerpt_summary: input.excerpt_summary,
    topic_tags: input.topic_tags,
    embedding,
  })
}
