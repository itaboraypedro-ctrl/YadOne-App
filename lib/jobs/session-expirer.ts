// lib/jobs/session-expirer.ts — Worker que expira sessões inativas (T19).
//
// Lógica:
//  1. Busca sessões com status='active' e updated_at < now - 24h (limit 200).
//  2. Para cada (loop sequencial — não Promise.all):
//     a. Marca sessão como expired (updateSession).
//     b. Cancela todos os timers pendentes da sessão.
//     c. Emite evento CRM session.expired (fire-and-forget).
//     d. Registra audit log.
//  3. Erros por sessão são capturados — não bloqueiam as demais.

import { supabase } from '@/lib/db/client'
import { updateSession } from '@/lib/db/sessions'
import { cancelTimersBySession } from '@/lib/db/followup-timers'
import { emitEvent } from '@/lib/db/crm-events'
import { logAudit } from '@/lib/db/audit'

interface ExpiringSessionRow {
  id: string
  workspace_id: string
  client_id: string
  current_trace_id: string | null
  updated_at: string
}

export async function processExpiredSessions(): Promise<{
  expired: number
  errors: number
}> {
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('sessions')
    .select('id, workspace_id, client_id, current_trace_id, updated_at')
    .eq('status', 'active')
    .lt('updated_at', threshold)
    .limit(200)

  if (error) {
    void logAudit('job.session_expirer_query_failed', { error: error.message }, {})
    return { expired: 0, errors: 1 }
  }

  const rows = (data ?? []) as ExpiringSessionRow[]
  let expired = 0
  let errors = 0

  for (const row of rows) {
    try {
      await updateSession(row.id, { status: 'expired' })
      await cancelTimersBySession(row.id)

      const duration_hours =
        (Date.now() - new Date(row.updated_at).getTime()) / (60 * 60 * 1000)

      void emitEvent(
        'session.expired',
        { duration_hours, last_message_at: row.updated_at },
        {
          workspace_id: row.workspace_id,
          session_id: row.id,
          client_id: row.client_id,
          trace_id: row.current_trace_id,
        },
      )

      void logAudit(
        'session.expired',
        { session_id: row.id },
        { workspace_id: row.workspace_id, session_id: row.id },
      )

      expired++
    } catch (e) {
      errors++
      void logAudit(
        'job.session_expirer_failed',
        { session_id: row.id, error: (e as Error).message },
        { workspace_id: row.workspace_id, session_id: row.id },
      )
    }
  }

  return { expired, errors }
}
