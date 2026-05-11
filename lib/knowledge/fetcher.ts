// lib/knowledge/fetcher.ts — Estratégia híbrida de knowledge para um nó
//
// Para cada KB associado às tags do nó:
//   - token_estimate < 2000 → injeta content direto
//   - token_estimate >= 2000 E query disponível → vectorSearchChunks(top_k=3)
//   - token_estimate >= 2000 sem query → primeiro chunk como resumo
// Sempre concatena globais (@workspace.*).

import { getNodeTags } from '@/lib/db/flows'
import {
  getKnowledgeByTags,
  getKnowledgeChunks,
  vectorSearchChunks,
} from '@/lib/db/knowledge'
import type { KnowledgeBase, KnowledgeFetchResult } from '@/types/knowledge'
import { generateEmbedding } from './embeddings'
import { getKnowledgeByGlobalTags } from './global'
import { formatKnowledgeForPrompt } from './formatter'
import { countTokens } from './chunker'

const RAG_THRESHOLD_TOKENS = 2000
const RAG_TOP_K = 3

interface FormatItem {
  title: string
  content: string
}

async function resolveItemContent(
  item: KnowledgeBase,
  workspaceQueryEmbedding: number[] | null,
): Promise<{ content: string; usedRag: boolean }> {
  const estimate = item.token_estimate ?? countTokens(item.content)

  if (estimate < RAG_THRESHOLD_TOKENS) {
    return { content: item.content, usedRag: false }
  }

  if (workspaceQueryEmbedding) {
    const chunks = await vectorSearchChunks(
      item.workspace_id,
      workspaceQueryEmbedding,
      RAG_TOP_K,
      [item.id],
    )
    if (chunks.length > 0) {
      return {
        content: chunks.map((c) => c.content).join('\n\n'),
        usedRag: true,
      }
    }
  }

  // Sem query (ou RAG vazio): pega o primeiro chunk como resumo
  const allChunks = await getKnowledgeChunks(item.id)
  if (allChunks.length > 0) {
    return { content: allChunks[0].content, usedRag: false }
  }
  // Fallback: usa truncamento natural do formatter
  return { content: item.content, usedRag: false }
}

export async function getKnowledgeForNode(
  node_id: string,
  workspace_id: string,
  query?: string,
): Promise<KnowledgeFetchResult> {
  // 1. Tags do nó
  const tagRows = await getNodeTags(node_id)
  const tags = tagRows.map((t) => t.knowledge_tag)

  // 2. KB items por tag (cast estrutural — helper de DB usa interface inline equivalente)
  const tagItems = (await getKnowledgeByTags(workspace_id, tags)) as unknown as KnowledgeBase[]

  // 3. Embedding da query (uma vez), apenas se houver itens grandes
  let queryEmbedding: number[] | null = null
  const hasLargeItems = tagItems.some(
    (it) => (it.token_estimate ?? countTokens(it.content)) >= RAG_THRESHOLD_TOKENS,
  )
  if (query && hasLargeItems) {
    try {
      queryEmbedding = await generateEmbedding(query)
    } catch (err) {
      console.error('[fetcher] falha ao gerar embedding da query — fallback resumo:', err)
      queryEmbedding = null
    }
  }

  // 4. Resolve conteúdo por item
  const items: FormatItem[] = []
  let usedRag = false
  for (const item of tagItems) {
    try {
      const resolved = await resolveItemContent(item, queryEmbedding)
      if (resolved.usedRag) usedRag = true
      items.push({ title: item.title, content: resolved.content })
    } catch (err) {
      console.error(`[fetcher] falha em resolveItemContent kb=${item.id}:`, err)
    }
  }

  // 5. Globais (sempre incluídos)
  const globals = await getKnowledgeByGlobalTags(workspace_id)
  for (const g of globals) {
    items.push({ title: g.title, content: g.content })
  }

  const formatted = formatKnowledgeForPrompt(items)
  const tokens_estimate = countTokens(formatted)

  return {
    formatted,
    items_used: items.length,
    tokens_estimate,
    used_rag: usedRag,
  }
}
