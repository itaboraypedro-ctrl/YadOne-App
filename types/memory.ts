// types/memory.ts — Memória semântica + episódica do cliente

export interface MemoryInsights {
  preferred_name: string | null
  preferences: string[]
  last_service: string | null
  observations: string | null
  raw_insights: Record<string, unknown>
}

export interface ClientMemorySemantic {
  id: string
  client_id: string
  workspace_id: string
  memory_summary: string | null
  preferred_name: string | null
  preferences: string[]
  last_service: string | null
  observations: string | null
  raw_insights: Record<string, unknown>
  updated_at: string // ISO 8601
}

export interface ClientEpisodicMemory {
  id: string
  client_id: string
  workspace_id: string
  session_id: string | null
  conversation_excerpt: string | null
  excerpt_summary: string | null
  topic_tags: string[]
  embedding: number[] | null
  occurred_at: string // ISO 8601
  created_at: string // ISO 8601
}

export interface EpisodeInput {
  client_id: string
  workspace_id: string
  session_id: string | null
  conversation_excerpt: string
  excerpt_summary: string
  topic_tags: string[]
  embedding: number[]
  occurred_at?: string
}
