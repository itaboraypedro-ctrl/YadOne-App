// lib/engine/orchestrator.ts — Camada 5 do motor (T17).
//
// Conecta tudo: webhook → guardrails-in → mídia → contexto → planner → executor →
// monitor → guardrails-out → send. SPEC §2 (pipeline) + Bloco 6 (cérebro) + Bloco 7
// (output guards).
//
// processMessage é fire-and-forget no caller (webhook). Try/catch global aninhado
// envia mensagem de fallback ao cliente em qualquer falha — nunca propaga.
//
// Pipeline (em ordem):
//  1. Gera trace_id e contexto inicial de audit.
//  2. runInputGuards (rate-limit + cost-cap). Bloqueio → audit + return.
//  3. processInboundMedia (Whisper / Vision). Skip graceful em erro.
//  4. detectExistingClient (cross-channel) ou getOrCreateClient.
//  5. resolveOrCreateSession (fixa flow_version) + emite conversation.started se nova.
//  6. handleWaitCancelByResponse — destrava sessão se estava em waiting + advance_on_response.
//  7. updateSession({ current_trace_id }) — para que helpers leiam o trace correto.
//  8. saveMessage(user) com node_id + trace_id + channel_message_id + media_*.
//  9. checkSessionBreaker — replan_count >= 3 → forceHandoff.
// 10. Loop max 3 iterações:
//      buildPromptContext → plan → override ESCALATION/CANCELLATION → execute →
//      applySessionUpdates → monitor → applySessionUpdates →
//      monitor.recommended_action: replan/handoff → bump replan ou forceHandoff →
//      output guards: validateOutput / filterOutput / detectLeaks →
//      sucesso → break.
// 11. saveMessage(assistant) com tokens consolidados.
// 12. channelClient.send com typing simulation.
// 13. Audit message.sent + latency total.
//
// Em qualquer erro inesperado: try/catch envia "Tive um problema técnico" ao cliente;
// se o próprio send falhar, registra `orchestrator.fallback_send_failed` e desiste
// silenciosamente (não retenta — multiplicaria o problema).

import type { InboundMessage } from '@/types/message'
import type { Session, SessionStatus } from '@/types/session'
import type { PlannerDecision } from '@/types/planner'

import { runInputGuards } from '@/lib/guardrails'
import { checkSessionBreaker } from '@/lib/guardrails/circuit-breaker'
import { validateOutput } from '@/lib/guardrails/output-validator'
import { filterOutput } from '@/lib/guardrails/content-filter-output'
import { detectLeaks } from '@/lib/guardrails/leak-detector'
import { processInboundMedia } from '@/lib/media/processor'
import { detectExistingClient } from '@/lib/unification/strategy'
import { getOrCreateClient } from '@/lib/db/clients'
import { getSession, updateSession, incrementReplanCount } from '@/lib/db/sessions'
import { saveMessage } from '@/lib/db/messages'
import { logAudit } from '@/lib/db/audit'
import { emitEvent } from '@/lib/db/crm-events'
import { getAgentConfig } from '@/lib/db/workspaces'
import { getChannelConfigByType } from '@/lib/db/channel-configs'
import { channelClient } from '@/lib/resilience/external-clients'

import { buildPromptContext } from './context-builder'
import { plan } from './planner'
import { execute } from './executor'
import { monitor } from './monitor'
import {
  generateTraceId,
  resolveOrCreateSession,
  applySessionUpdates,
  handleWaitCancelByResponse,
  forceHandoff,
  calculateTypingDelay,
} from './orchestrator-helpers'

import type { ExecutorResult } from './executor'

const MAX_REPLAN_LOOP = 3

export interface ProcessMessageInput {
  workspace_id: string
  channel: string
  inbound: InboundMessage
  /**
   * Mensagem sintética (originada de followup-worker T29 ou wakeup interno).
   * Quando true: pula input guards, mídia e saveMessage(user). O motor fala
   * proativamente. `inbound.content` pode ser vazio.
   */
  synthetic?: boolean
}

export interface ProcessMessageResult {
  trace_id: string
  session_id: string | null
  status: 'sent' | 'blocked' | 'errored'
  reason?: string
}

/**
 * Pipeline end-to-end de uma mensagem inbound.
 * Não retorna ao webhook — é fire-and-forget. O ProcessMessageResult existe
 * para o endpoint /api/engine/process e para testes manuais.
 */
export async function processMessage(
  input: ProcessMessageInput,
): Promise<ProcessMessageResult> {
  const start_ms = Date.now()
  const trace_id = generateTraceId()
  const { workspace_id, channel, inbound, synthetic } = input

  const baseAuditCtx: Record<string, unknown> = {
    workspace_id,
    trace_id,
    channel,
  }

  void logAudit(
    'message.received',
    {
      trace_id,
      channel,
      from: inbound.from,
      media_type: inbound.media_type,
      channel_message_id: inbound.channel_message_id,
      content_length: inbound.content?.length ?? 0,
      synthetic: synthetic ?? false,
    },
    { workspace_id, trace_id },
  )

  let session_id: string | null = null

  try {
    // ═══ 2. Input guards (rate limit + cost cap) — pulado se synthetic ═══
    if (!synthetic) {
      const guards = await runInputGuards({ workspace_id, phone: inbound.from })
      if (!guards.allowed) {
        // Não envia resposta — rate-limit/cost-cap não devem spammar cliente.
        return { trace_id, session_id: null, status: 'blocked', reason: guards.reason }
      }
    }

    // ═══ 3. Pré-processamento de mídia ═══
    const processed_content = synthetic
      ? inbound.content
      : await processInboundMedia(inbound, {
          workspace_id,
          trace_id,
        })

    // Detecta se houve transcrição/descrição para popular media_transcription
    const had_media =
      !synthetic && inbound.media_type !== 'text' && Boolean(inbound.media_url)
    const media_transcription = had_media ? processed_content : null

    // ═══ 4. Resolve cliente (cross-channel via T28) ═══
    const existing_client = await detectExistingClient(workspace_id, inbound.from)
    const client = existing_client
      ?? (await getOrCreateClient(workspace_id, inbound.from))

    // ═══ 5. Resolve sessão ═══
    const { session: initial_session, is_new } = await resolveOrCreateSession({
      workspace_id,
      client_id: client.id,
      channel,
      trace_id,
    })
    session_id = initial_session.id

    if (is_new) {
      void emitEvent(
        'conversation.started',
        { channel, source: synthetic ? 'synthetic' : 'inbound' },
        {
          workspace_id,
          session_id: initial_session.id,
          client_id: client.id,
          trace_id,
        },
      )
    }

    // ═══ 6. Wait-cancel-by-response ═══
    let session = is_new
      ? initial_session
      : await handleWaitCancelByResponse(initial_session)

    // ═══ 7. Atualiza current_trace_id na sessão para que helpers leiam o trace certo ═══
    if (session.current_trace_id !== trace_id) {
      await updateSession(session.id, { current_trace_id: trace_id })
      session = { ...session, current_trace_id: trace_id }
    }

    // ═══ 8. saveMessage(user) — pulado se synthetic ═══
    if (!synthetic) {
      try {
        await saveMessage(session.id, 'user', processed_content, {
          workspace_id,
          client_id: client.id,
          node_id: session.current_node_id ?? null,
          trace_id,
          channel_message_id: inbound.channel_message_id ?? null,
          media_type: inbound.media_type,
          media_url: inbound.media_url ?? null,
          media_transcription,
        })
      } catch (e) {
        void logAudit(
          'orchestrator.save_inbound_failed',
          { ...baseAuditCtx, error: (e as Error).message },
          { workspace_id, session_id: session.id, trace_id },
        )
      }
    }

    // ═══ 8.5. Skip se IA está pausada (F13) ═══
    // Cascata em 3 níveis: conversation > channel > workspace.
    // Inserido APÓS saveMessage(user) intencionalmente: a mensagem inbound
    // precisa ficar persistida para o atendente humano ver no chat e responder
    // manualmente — só desistimos de gerar a resposta da IA.
    const auditCtxAi = {
      workspace_id,
      session_id: session.id,
      client_id: client.id,
      trace_id,
    }

    // 1. Por conversa
    if (session.ai_paused === true) {
      void logAudit(
        'orchestrator.ai_paused_skip',
        {
          level: 'conversation',
          session_id: session.id,
          ai_paused_by: session.ai_paused_by ?? null,
        },
        auditCtxAi,
      )
      return {
        trace_id,
        session_id: session.id,
        status: 'blocked',
        reason: 'ai_paused_by_human',
      }
    }

    // 2. Por canal
    try {
      const channelConfig = await getChannelConfigByType(workspace_id, channel)
      if (channelConfig && channelConfig.ai_enabled === false) {
        void logAudit(
          'orchestrator.ai_paused_skip',
          {
            level: 'channel',
            channel_config_id: channelConfig.id,
            channel_type: channel,
          },
          auditCtxAi,
        )
        return {
          trace_id,
          session_id: session.id,
          status: 'blocked',
          reason: 'ai_disabled_channel',
        }
      }
    } catch (e) {
      // Falha de leitura do channel_config não deve derrubar a conversa: loga e segue.
      void logAudit(
        'orchestrator.ai_paused_check_failed',
        { level: 'channel', error: (e as Error).message },
        auditCtxAi,
      )
    }

    // 3. Por workspace
    try {
      const agentConfig = await getAgentConfig(workspace_id)
      if (agentConfig && agentConfig.ai_enabled === false) {
        void logAudit(
          'orchestrator.ai_paused_skip',
          { level: 'workspace', workspace_id },
          auditCtxAi,
        )
        return {
          trace_id,
          session_id: session.id,
          status: 'blocked',
          reason: 'ai_disabled_workspace',
        }
      }
    } catch (e) {
      void logAudit(
        'orchestrator.ai_paused_check_failed',
        { level: 'workspace', error: (e as Error).message },
        auditCtxAi,
      )
    }

    // ═══ 9. Session breaker (replan_count >= 3) ═══
    const breaker = await checkSessionBreaker(session.id)

    // ═══ 10. Loop Planner → Executor → Monitor → Output guards ═══
    let exec_result: ExecutorResult | null = null
    let final_replan_count = 0
    let break_reason: string | null = null

    if (!breaker.allowed) {
      // Sessão estourou replan_count — força handoff direto.
      const ctx0 = await buildPromptContext(session.id, processed_content)
      exec_result = await forceHandoff(ctx0, breaker.reason ?? 'session_breaker_open')
      await applySessionUpdates(session.id, exec_result.session_updates)
      break_reason = 'session_breaker'
    } else {
      for (let i = 0; i < MAX_REPLAN_LOOP; i++) {
        // Carrega contexto fresco a cada iteração
        const ctx = await buildPromptContext(session.id, processed_content)

        // PLANNER
        const decision = await plan(ctx)

        // Override defensivo — Planner LLM pode classificar mas não escolher handoff
        if (
          decision.classification === 'ESCALATION'
          || decision.classification === 'CANCELLATION'
        ) {
          ;(decision as PlannerDecision).action = 'handoff'
        }

        // EXECUTOR
        const result = await execute(decision, ctx)
        await applySessionUpdates(session.id, result.session_updates)

        // MONITOR
        const monitor_out = await monitor(ctx, decision, result)
        await applySessionUpdates(session.id, monitor_out.session_updates)

        // Monitor recomenda replan
        if (monitor_out.report.recommended_action === 'replan') {
          const next = await incrementReplanCount(session.id)
          final_replan_count = next
          if (next >= MAX_REPLAN_LOOP) {
            const ctx_h = await buildPromptContext(session.id, processed_content)
            exec_result = await forceHandoff(ctx_h, 'monitor_replan_limit')
            await applySessionUpdates(session.id, exec_result.session_updates)
            break_reason = 'monitor_replan_limit'
            break
          }
          continue
        }

        // Monitor recomenda handoff
        if (monitor_out.report.recommended_action === 'handoff') {
          const ctx_h = await buildPromptContext(session.id, processed_content)
          exec_result = await forceHandoff(ctx_h, 'monitor_handoff')
          await applySessionUpdates(session.id, exec_result.session_updates)
          break_reason = 'monitor_handoff'
          break
        }

        // ═══ Output guards ═══
        if (result.response_text) {
          const guard_ctx = {
            workspace_id,
            session_id: session.id,
            client_id: client.id,
            trace_id,
          }

          const validation = await validateOutput(result.response_text, guard_ctx)
          if (validation.action === 'truncate' && validation.sanitized_text) {
            result.response_text = validation.sanitized_text
          } else if (!validation.valid && validation.action === 're_plan') {
            const next = await incrementReplanCount(session.id)
            final_replan_count = next
            if (next >= MAX_REPLAN_LOOP) {
              const ctx_h = await buildPromptContext(session.id, processed_content)
              exec_result = await forceHandoff(ctx_h, 'output_validator_replan_limit')
              await applySessionUpdates(session.id, exec_result.session_updates)
              break_reason = 'output_validator_replan_limit'
              break
            }
            continue
          }

          const filt = await filterOutput(result.response_text, guard_ctx)
          if (!filt.safe) {
            const ctx_h = await buildPromptContext(session.id, processed_content)
            exec_result = await forceHandoff(ctx_h, `output_filter:${filt.pattern_matched}`)
            await applySessionUpdates(session.id, exec_result.session_updates)
            break_reason = 'output_filter'
            break
          }

          const leak = await detectLeaks(result.response_text, {
            ...guard_ctx,
            client_phone: client.phone,
          })
          if (leak.has_leak) {
            const ctx_h = await buildPromptContext(session.id, processed_content)
            exec_result = await forceHandoff(ctx_h, 'leak_detected')
            await applySessionUpdates(session.id, exec_result.session_updates)
            break_reason = 'leak_detected'
            break
          }
        }

        exec_result = result
        break_reason = 'ok'
        break
      }

      // Loop terminou sem sucesso (saiu por completar 3 iterações sem break)
      if (!exec_result) {
        const ctx_h = await buildPromptContext(session.id, processed_content)
        exec_result = await forceHandoff(ctx_h, 'replan_loop_exhausted')
        await applySessionUpdates(session.id, exec_result.session_updates)
        break_reason = 'replan_loop_exhausted'
      }
    }

    if (!exec_result) {
      throw new Error('processMessage: exec_result is null after loop — bug')
    }

    // ═══ 11. saveMessage(assistant) ═══
    const session_after = (await getSession(session.id)) as unknown as Session | null
    const node_id_after = session_after?.current_node_id ?? session.current_node_id ?? null

    if (exec_result.response_text) {
      try {
        await saveMessage(session.id, 'assistant', exec_result.response_text, {
          workspace_id,
          client_id: client.id,
          node_id: node_id_after,
          trace_id,
          llm_model: exec_result.model_used,
          tokens_used:
            (exec_result.tokens_in ?? 0) + (exec_result.tokens_out ?? 0),
        })
      } catch (e) {
        void logAudit(
          'orchestrator.save_outbound_failed',
          { ...baseAuditCtx, error: (e as Error).message },
          { workspace_id, session_id: session.id, trace_id },
        )
      }
    }

    // ═══ 12. Envio via channelClient ═══
    if (exec_result.response_text) {
      try {
        await channelClient.send(workspace_id, inbound.from, {
          text: exec_result.response_text,
        })
        // typing_delay calculado mas não usado aqui (channel adapter pode usar
        // internamente). Preservado como sinal para futuro typing_simulation.
        void calculateTypingDelay(exec_result.response_text)
      } catch (e) {
        void logAudit(
          'orchestrator.send_failed',
          { ...baseAuditCtx, error: (e as Error).message },
          { workspace_id, session_id: session.id, trace_id },
        )
        return {
          trace_id,
          session_id: session.id,
          status: 'errored',
          reason: 'send_failed',
        }
      }
    }

    // ═══ 13. Audit final ═══
    void logAudit(
      'message.sent',
      {
        trace_id,
        length: exec_result.response_text?.length ?? 0,
        latency_ms_total: Date.now() - start_ms,
        replan_count: final_replan_count,
        break_reason,
        forced_handoff: exec_result.forced_handoff ?? false,
        synthetic: synthetic ?? false,
      },
      { workspace_id, session_id: session.id, client_id: client.id, trace_id },
    )

    return {
      trace_id,
      session_id: session.id,
      status: 'sent',
      reason: break_reason ?? 'ok',
    }
  } catch (error) {
    // Catch externo: tenta enviar fallback ao cliente.
    const err = error as Error
    void logAudit(
      'orchestrator.error',
      {
        trace_id,
        error: err.message,
        stack: err.stack?.slice(0, 1000) ?? null,
        synthetic: synthetic ?? false,
      },
      { workspace_id, session_id: session_id ?? undefined, trace_id },
    )

    if (!synthetic) {
      try {
        await channelClient.send(workspace_id, inbound.from, {
          text: 'Tive um problema técnico, já vou retornar.',
        })
      } catch (sendErr) {
        // Catch aninhado: canal fora também — registra e desiste. Não retenta.
        void logAudit(
          'orchestrator.fallback_send_failed',
          {
            trace_id,
            original_error: err.message,
            send_error: (sendErr as Error).message,
          },
          { workspace_id, session_id: session_id ?? undefined, trace_id },
        )
      }
    }

    return {
      trace_id,
      session_id,
      status: 'errored',
      reason: err.message,
    }
  }
}
