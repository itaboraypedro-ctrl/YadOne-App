// lib/knowledge/indexer.ts — Indexação de KB → chunks vetorizados
// Algoritmo: chunkText → batchEmbeddings → deleteChunksByKbId → insertChunk(*) → markKbIndexed
// Em erro deixa is_indexed=false e re-throw para o caller decidir retry.

import { supabase } from '@/lib/db/client'
import {
  deleteChunksByKbId,
  insertChunk,
  markKbIndexed,
} from '@/lib/db/knowledge'
import { batchEmbeddings } from './embeddings'
import { chunkText } from './chunker'

interface IndexResult {
  chunks_created: number
}

interface KnowledgeRow {
  id: string
  workspace_id: string
  content: string
  is_indexed: boolean
}

async function getKbForIndex(kb_id: string): Promise<KnowledgeRow | null> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id, workspace_id, content, is_indexed')
    .eq('id', kb_id)
    .maybeSingle()
  if (error) throw new Error(`indexer.getKbForIndex(${kb_id}) failed: ${error.message}`)
  return (data as KnowledgeRow) ?? null
}

export async function indexKnowledgeBase(kb_id: string): Promise<IndexResult> {
  const kb = await getKbForIndex(kb_id)
  if (!kb) throw new Error(`indexKnowledgeBase: kb ${kb_id} não encontrado`)

  const chunks = chunkText(kb.content)
  if (chunks.length === 0) {
    // Conteúdo vazio: limpa chunks antigos e marca indexado.
    await deleteChunksByKbId(kb_id)
    await markKbIndexed(kb_id, true)
    return { chunks_created: 0 }
  }

  const embeddings = await batchEmbeddings(chunks.map((c) => c.text))

  // Substitui chunks antigos atomicamente do ponto de vista lógico:
  // delete primeiro, depois inserts.
  await deleteChunksByKbId(kb_id)

  for (let i = 0; i < chunks.length; i += 1) {
    await insertChunk({
      kb_id: kb.id,
      workspace_id: kb.workspace_id,
      chunk_index: i,
      content: chunks[i].text,
      embedding: embeddings[i],
      token_count: chunks[i].token_count,
    })
  }

  await markKbIndexed(kb_id, true)
  return { chunks_created: chunks.length }
}

export async function indexAllDirty(workspace_id: string): Promise<number> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('is_indexed', false)
  if (error) throw new Error(`indexAllDirty(${workspace_id}) failed: ${error.message}`)

  const rows = (data as { id: string }[]) ?? []
  let success = 0
  for (const row of rows) {
    try {
      await indexKnowledgeBase(row.id)
      success += 1
    } catch (err) {
      // Loga e segue — caller pode reler e tentar de novo no próximo ciclo do Job T21.
      console.error(`[indexer.indexAllDirty] kb=${row.id} falhou:`, err)
    }
  }
  return success
}
