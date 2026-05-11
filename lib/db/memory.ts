// lib/db/memory.ts — Memória semântica + episódica (com vector search via RPC)
// gap #4: episódica inclui topic_tags, excerpt_summary
// TODO: substituir tipos inline por import from '@/types/memory' após merge da T02.

import { supabase } from './client'

interface ClientMemorySemantic {
  id: string
  client_id: string
  workspace_id: string
  memory_summary: string | null
  preferred_name: string | null
  preferences: string[]
  last_service: string | null
  observations: string | null
  raw_insights: Record<string, unknown>
  updated_at: string
}

interface ClientEpisodicMemory {
  id: string
  client_id: string
  workspace_id: string
  session_id: string | null
  conversation_excerpt: string | null
  excerpt_summary: string | null
  topic_tags: string[]
  embedding: number[] | null
  occurred_at: string
  created_at: string
}

interface SemanticUpsertInput {
  client_id: string
  workspace_id: string
  memory_summary: string
  preferred_name: string | null
  preferences: string[]
  last_service: string | null
  observations: string | null
  raw_insights: Record<string, unknown>
}

interface EpisodeInput {
  client_id: string
  workspace_id: string
  session_id: string | null
  conversation_excerpt: string
  excerpt_summary: string
  topic_tags: string[]
  embedding: number[]
  occurred_at?: string
}

export async function getMemorySemantic(
  client_id: string,
  workspace_id: string,
): Promise<ClientMemorySemantic | null> {
  const { data, error } = await supabase
    .from('client_memory')
    .select('*')
    .eq('client_id', client_id)
    .eq('workspace_id', workspace_id)
    .maybeSingle()
  if (error) throw new Error(`getMemorySemantic failed: ${error.message}`)
  return (data as ClientMemorySemantic) ?? null
}

export async function upsertMemorySemantic(
  input: SemanticUpsertInput,
): Promise<ClientMemorySemantic> {
  const { data, error } = await supabase
    .from('client_memory')
    .upsert(
      {
        client_id: input.client_id,
        workspace_id: input.workspace_id,
        memory_summary: input.memory_summary,
        preferred_name: input.preferred_name,
        preferences: input.preferences,
        last_service: input.last_service,
        observations: input.observations,
        raw_insights: input.raw_insights,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,workspace_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(`upsertMemorySemantic failed: ${error.message}`)
  return data as ClientMemorySemantic
}

export async function getMemoryEpisodic(
  client_id: string,
  limit: number = 10,
): Promise<ClientEpisodicMemory[]> {
  const { data, error } = await supabase
    .from('client_episodic_memory')
    .select('*')
    .eq('client_id', client_id)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getMemoryEpisodic failed: ${error.message}`)
  return (data as ClientEpisodicMemory[]) ?? []
}

export async function insertMemoryEpisodic(
  input: EpisodeInput,
): Promise<ClientEpisodicMemory> {
  const { data, error } = await supabase
    .from('client_episodic_memory')
    .insert({
      client_id: input.client_id,
      workspace_id: input.workspace_id,
      session_id: input.session_id,
      conversation_excerpt: input.conversation_excerpt,
      excerpt_summary: input.excerpt_summary,
      topic_tags: input.topic_tags,
      embedding: input.embedding,
      occurred_at: input.occurred_at ?? new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) throw new Error(`insertMemoryEpisodic failed: ${error.message}`)
  return data as ClientEpisodicMemory
}

export async function vectorSearchEpisodic(
  client_id: string,
  query_embedding: number[],
  top_k: number = 3,
): Promise<ClientEpisodicMemory[]> {
  const { data, error } = await supabase.rpc('vector_search_episodes', {
    p_client_id: client_id,
    p_query: query_embedding,
    p_top_k: top_k,
  })
  if (error) throw new Error(`vectorSearchEpisodic failed: ${error.message}`)
  return (data as ClientEpisodicMemory[]) ?? []
}
