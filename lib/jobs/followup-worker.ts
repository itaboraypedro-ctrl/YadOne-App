// lib/jobs/followup-worker.ts — Worker que processa followup_timers vencidos (T29).
//
// Lógica:
//  1. Busca até 100 timers pendentes com scheduled_at <= now (getPendingTimers).
//  2. Para cada timer (loop sequencial — não Promise.all, evita sobrecarregar o motor):
//     a. Verifica se a sessão existe e está em status 'waiting'.
//     b. Carrega o cliente da sessão para obter o telefone.
//     c. Avança sessão (status → active, current_node_id → target_node_id, wait_until → null).
//     d. Dispara processMessage com synthetic: true (pula input guards, mídia, saveMessage(user)).
//     e. Marca timer como fired.
//     f. Emite evento CRM (fire-and-forget).
//  3. Erros por timer são capturados individualmente — não bloqueiam os demais.

import { getPendingTimers, markTimerFired } from '@/lib/db/followup-timers'
import { getSession, updateSession } from '@/lib/db/sessions'
import { getClient } from '@/lib/db/clients'
import { logAudit } from '@/lib/db/audit'
import { emitEvent } from '@/lib/db/crm-events'
import { processMessage } from '@/lib/engine/orchestrator'

export async function processFollowupTimers(): Promise<{
  fired: number
  errors: number
  skipped: number
}> {
  const pending = await getPendingTimers(100)

  let fired = 0
  let errors = 0
  let skipped = 0

  for (const timer of pending) {
    try {
      const session = await getSession(timer.session_id)
      if (!session || session.status !== 'waiting') {
        await markTimerFired(timer.id)
        skipped++
        continue
      }

      // Carrega o cliente para obter o telefone (necessário para o inbound.from)
      const client = await getClient(session.client_id)
      if (!client) {
        await markTimerFired(timer.id)
        skipped++
        continue
      }

      // Avança sessão para o nó alvo e reativa
      await updateSession(session.id, {
        status: 'active',
        current_node_id: timer.target_node_id,
        wait_until: null,
      })

      // Dispara processMessage com synthetic=true.
      // processMessage tem try/catch interno — não propaga. Mas envolvemos por segurança.
      await processMessage({
        workspace_id: session.workspace_id,
        channel: session.channel,
        inbound: {
          from: client.phone,
          content: '',
          media_type: 'text',
          channel_message_id: `timer:${timer.id}`,
          timestamp: new Date().toISOString(),
        },
        synthetic: true,
      })

      await markTimerFired(timer.id)

      void emitEvent(
        'followup.fired',
        { timer_id: timer.id, target_node_id: timer.target_node_id },
        {
          workspace_id: session.workspace_id,
          session_id: session.id,
          client_id: session.client_id,
          trace_id: session.current_trace_id ?? null,
        },
      )

      fired++
    } catch (e) {
      errors++
      void logAudit(
        'job.followup_failed',
        { timer_id: timer.id, error: (e as Error).message },
        { workspace_id: timer.workspace_id, session_id: timer.session_id },
      )
    }
  }

  return { fired, errors, skipped }
}
