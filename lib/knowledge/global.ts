// lib/knowledge/global.ts — Tags @workspace.* (knowledge global do workspace)
// Wrapper sobre getGlobalKnowledge que aceita filtro opcional por tags.

import { getGlobalKnowledge } from '@/lib/db/knowledge'
import type { KnowledgeBase } from '@/types/knowledge'

export async function getKnowledgeByGlobalTags(
  workspace_id: string,
  tags?: string[],
): Promise<KnowledgeBase[]> {
  // getGlobalKnowledge retorna o tipo do helper inline (estruturalmente compatível
  // com KnowledgeBase de @/types/knowledge). Cast seguro pelo shape.
  const items = (await getGlobalKnowledge(workspace_id)) as unknown as KnowledgeBase[]
  if (!tags || tags.length === 0) return items
  const tagSet = new Set(tags)
  return items.filter((item) => tagSet.has(item.tag))
}
