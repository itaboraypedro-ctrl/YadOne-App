// lib/db/knowledge.ts — Knowledge base + chunks vetorizados (RAG)
// TODO: substituir tipos inline por import from '@/types/knowledge' após merge da T02.

import { supabase } from './client'

interface KnowledgeBase {
  id: string
  workspace_id: string
  tag: string
  title: string
  content: string
  content_type: string
  is_global: boolean
  is_indexed: boolean
  token_estimate: number | null
  created_at: string
  updated_at: string
}

interface KnowledgeChunk {
  id: string
  kb_id: string
  workspace_id: string
  chunk_index: number
  content: string
  embedding: number[] | null
  token_count: number | null
  created_at: string
}

interface ChunkInput {
  kb_id: string
  workspace_id: string
  chunk_index: number
  content: string
  embedding: number[]
  token_count: number
}

export async function getKnowledgeByTags(
  workspace_id: string,
  tags: string[],
): Promise<KnowledgeBase[]> {
  if (tags.length === 0) return []
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('workspace_id', workspace_id)
    .in('tag', tags)
  if (error) throw new Error(`getKnowledgeByTags failed: ${error.message}`)
  return (data as KnowledgeBase[]) ?? []
}

export async function getGlobalKnowledge(workspace_id: string): Promise<KnowledgeBase[]> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('is_global', true)
  if (error) throw new Error(`getGlobalKnowledge failed: ${error.message}`)
  return (data as KnowledgeBase[]) ?? []
}

export async function getKnowledgeChunks(kb_id: string): Promise<KnowledgeChunk[]> {
  const { data, error } = await supabase
    .from('knowledge_chunks')
    .select('*')
    .eq('kb_id', kb_id)
    .order('chunk_index', { ascending: true })
  if (error) throw new Error(`getKnowledgeChunks(${kb_id}) failed: ${error.message}`)
  return (data as KnowledgeChunk[]) ?? []
}

export async function vectorSearchChunks(
  workspace_id: string,
  query_embedding: number[],
  top_k: number = 3,
  kb_ids?: string[],
): Promise<KnowledgeChunk[]> {
  const { data, error } = await supabase.rpc('vector_search_chunks', {
    p_workspace_id: workspace_id,
    p_query: query_embedding,
    p_top_k: top_k,
    p_kb_ids: kb_ids ?? null,
  })
  if (error) throw new Error(`vectorSearchChunks failed: ${error.message}`)
  return (data as KnowledgeChunk[]) ?? []
}

export async function insertChunk(input: ChunkInput): Promise<KnowledgeChunk> {
  const { data, error } = await supabase
    .from('knowledge_chunks')
    .insert(input)
    .select('*')
    .single()
  if (error) throw new Error(`insertChunk failed: ${error.message}`)
  return data as KnowledgeChunk
}

export async function deleteChunksByKbId(kb_id: string): Promise<void> {
  const { error } = await supabase.from('knowledge_chunks').delete().eq('kb_id', kb_id)
  if (error) throw new Error(`deleteChunksByKbId(${kb_id}) failed: ${error.message}`)
}

export async function markKbIndexed(kb_id: string, indexed: boolean = true): Promise<void> {
  const { error } = await supabase
    .from('knowledge_base')
    .update({ is_indexed: indexed, updated_at: new Date().toISOString() })
    .eq('id', kb_id)
  if (error) throw new Error(`markKbIndexed(${kb_id}) failed: ${error.message}`)
}
