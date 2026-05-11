// lib/db/audit.ts — Audit logs (fire-and-forget; nunca bloqueia o caller)
// TODO: substituir tipos inline por import from '@/types/metrics' após merge da T02.

import { supabase } from './client'

interface AuditContext {
  workspace_id?: string | null
  client_id?: string | null
  session_id?: string | null
  trace_id?: string | null
}

/**
 * Registra um evento de auditoria.
 * Não throws em caso de falha — apenas loga no console e segue.
 * Motor não pode quebrar por causa de logging.
 */
export async function logAudit(
  event_type: string,
  payload: Record<string, unknown>,
  ctx: AuditContext = {},
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      event_type,
      workspace_id: ctx.workspace_id ?? null,
      client_id: ctx.client_id ?? null,
      session_id: ctx.session_id ?? null,
      payload,
      trace_id: ctx.trace_id ?? null,
    })
    if (error) {
      console.error('[audit] insert failed', { event_type, error: error.message })
    }
  } catch (e) {
    console.error('[audit] unexpected error', { event_type, error: (e as Error).message })
  }
}
