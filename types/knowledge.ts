// types/knowledge.ts — Base de conhecimento + chunks vetorizados (RAG)

export type KnowledgeContentType = 'text' | 'document' | 'url' | 'qa_pairs'

export interface KnowledgeBase {
  id: string
  workspace_id: string
  tag: string
  title: string
  content: string
  content_type: KnowledgeContentType
  is_global: boolean
  is_indexed: boolean
  token_estimate: number | null
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

export interface KnowledgeChunk {
  id: string
  kb_id: string
  workspace_id: string
  chunk_index: number
  content: string
  embedding: number[] | null
  token_count: number | null
  created_at: string // ISO 8601
}

export interface KnowledgeChunkInput {
  kb_id: string
  workspace_id: string
  chunk_index: number
  content: string
  embedding: number[]
  token_count: number
}

export interface KnowledgeFetchResult {
  formatted: string
  items_used: number
  tokens_estimate: number
  used_rag: boolean
}
