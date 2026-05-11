// lib/jobs/knowledge-indexer.ts — Worker que indexa KB items dirty (T21).
//
// Wrapper minimalista sobre indexAllDirty (T08) — itera workspaces ativos
// e delega o trabalho real (chunk/embedding/insert) ao módulo /lib/knowledge/indexer.ts.
//
// Lógica:
//  1. Busca até 50 workspaces com status='active'.
//  2. Para cada (loop sequencial):
//     - count = await indexAllDirty(workspace_id)
//     - acumula em total_kb_items_indexed.
//  3. Erros por workspace são capturados — não bloqueiam os demais.

import { supabase } from '@/lib/db/client'
import { indexAllDirty } from '@/lib/knowledge/indexer'
import { logAudit } from '@/lib/db/audit'

interface WorkspaceRow {
  id: string
}

export async function processKnowledgeIndexing(): Promise<{
  workspaces_processed: number
  total_kb_items_indexed: number
  errors: number
}> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('status', 'active')
    .limit(50)

  if (error) {
    void logAudit('job.knowledge_indexer_query_failed', { error: error.message }, {})
    return { workspaces_processed: 0, total_kb_items_indexed: 0, errors: 1 }
  }

  const rows = (data ?? []) as WorkspaceRow[]
  let workspaces_processed = 0
  let total_kb_items_indexed = 0
  let errors = 0

  for (const row of rows) {
    try {
      const count = await indexAllDirty(row.id)
      total_kb_items_indexed += count
      workspaces_processed++
    } catch (e) {
      errors++
      void logAudit(
        'job.knowledge_indexer_failed',
        { workspace_id: row.id, error: (e as Error).message },
        { workspace_id: row.id },
      )
    }
  }

  return { workspaces_processed, total_kb_items_indexed, errors }
}
