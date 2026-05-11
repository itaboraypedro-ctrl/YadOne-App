// lib/engine/monitor.ts — Camada 4 do motor (Monitor / self-evaluation).
// Modelo: claude-sonnet-4-6, temperature 0.0, max_tokens 400.
// SPEC §15 + GAP #2 (persistência em monitor_decisions).
//
// Roda 5 verificações pós-hoc na resposta gerada pelo Executor:
//   1. Coerência com objetivo do nó atual
//   2. Alucinação (claims sem suporte no contexto)
//   3. Loop (3+ ações iguais consecutivas)
//   4. Sentiment (frustração crescente nas últimas 3 msgs)
//   5. Low confidence do Planner (< 0.5)
//
// Toda flag é persistida em monitor_decisions. sessions.monitor_flags recebe
// snapshot leve (últimas 10 flags) para queries rápidas (e fallback do loop-detector).
//
// Desabilitável:
//   - env MONITOR_ENABLED=false → retorna report vazio sem chamar LLM
//   - por nó: current_node?.config?.monitor_enabled === false (campo opcional)

import { anthropicClient } from '@/lib/resilience/external-clients'
import { trackUsage } from '@/lib/metrics/cost-tracker'
import { detectLoop } from './loop-detector'
import { analyzeSentiment } from './sentiment-analyzer'
import { recordMonitorDecision } from '@/lib/db/monitor-decisions'
import { logAudit } from '@/lib/db/audit'
import type { PromptContext } from './context-builder'
import type { ExecutorResult } from './executor'
import type { PlannerDecision } from '@/types/planner'
import type {
  MonitorAction,
  MonitorFlag,
  MonitorFlagType,
  MonitorReport,
} from '@/types/monitor'
import type { MonitorFlagSnapshot, Session } from '@/types/session'

const MONITOR_MODEL = 'claude-sonnet-4-6'
const MONITOR_TEMPERATURE = 0.0
const MONITOR_MAX_TOKENS = 400
const LOW_CONFIDENCE_THRESHOLD = 0.5
const MONITOR_FLAGS_SNAPSHOT_LIMIT = 10

interface CoherenceHallucinationOutput {
  is_coherent?: boolean
  coherence_reason?: string
  hallucination_detected?: boolean
  hallucination_reason?: string
  hallucination_confidence?: number
  coherence_confidence?: number
}

function isMonitorEnabled(ctx: PromptContext): boolean {
  if (process.env.MONITOR_ENABLED === 'false') return false
  const node = ctx.current_node
  const cfg = node?.config as unknown as { monitor_enabled?: boolean } | undefined
  if (cfg?.monitor_enabled === false) return false
  return true
}

function emptyReport(): MonitorReport {
  return { flags: [], recommended_action: 'continue', reasoning: 'monitor_disabled' }
}

function extractJsonBlock(raw: string): string | null {
  if (!raw) return null
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) return fenced[1].trim()
  const first = raw.indexOf('{')
  if (first < 0) return null
  let depth = 0
  for (let i = first; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return raw.slice(first, i + 1)
    }
  }
  return null
}

function clampConfidence(v: unknown, fallback = 0.5): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fallback
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

async function checkCoherenceAndHallucination(
  ctx: PromptContext,
  decision: PlannerDecision,
  result: ExecutorResult,
): Promise<{ coherence?: MonitorFlag; hallucination?: MonitorFlag }> {
  // Sem resposta a verificar → skip.
  if (!result.response_text || result.response_text.trim() === '') return {}

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return {}

  const objective = ctx.current_node?.config?.objective ?? '(sem objetivo definido)'
  const knowledge = ctx.knowledge_content?.formatted?.slice(0, 1500) ?? ''
  const memory = ctx.semantic_memory_text?.slice(0, 800) ?? ''
  const catalogSummary = ctx.catalog
    .slice(0, 20)
    .map((p) => `- ${p.name}${p.price ? ` (R$ ${p.price.toFixed(2)})` : ''}`)
    .join('\n')

  const prompt = `Você é o componente MONITOR de um agente de atendimento. NÃO converse, apenas avalie.

Avalie a resposta gerada considerando:
1. COERÊNCIA: a resposta endereça o objetivo da etapa atual?
2. ALUCINAÇÃO: a resposta afirma fatos (preços, horários, serviços, nomes) que NÃO têm suporte no contexto fornecido?

Objetivo da etapa: ${objective}

Catálogo disponível:
${catalogSummary || '(vazio)'}

Conhecimento ativo (trecho):
${knowledge || '(nenhum)'}

Memória do cliente (trecho):
${memory || '(nenhuma)'}

Última mensagem do cliente: ${ctx.current_message}

Resposta gerada pelo agente: ${result.response_text}

Responda APENAS com um bloco JSON neste formato:
\`\`\`json
{
  "is_coherent": true,
  "coherence_reason": "1 frase",
  "coherence_confidence": 0.8,
  "hallucination_detected": false,
  "hallucination_reason": "1 frase",
  "hallucination_confidence": 0.7
}
\`\`\``

  try {
    const resp = await anthropicClient.complete({
      model: MONITOR_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: MONITOR_MAX_TOKENS,
      temperature: MONITOR_TEMPERATURE,
    })
    void trackUsage(
      ctx.workspace.id,
      MONITOR_MODEL,
      resp.usage_input,
      resp.usage_output,
      ctx.session.id,
      { component: 'monitor', trace_id: ctx.session.current_trace_id ?? null },
    )
    const block = extractJsonBlock(resp.content ?? '')
    if (!block) return {}
    const parsed = JSON.parse(block) as CoherenceHallucinationOutput
    const flags: { coherence?: MonitorFlag; hallucination?: MonitorFlag } = {}
    if (parsed.is_coherent === false) {
      flags.coherence = {
        type: 'incoherent',
        confidence: clampConfidence(parsed.coherence_confidence, 0.6),
        details: parsed.coherence_reason ?? 'response does not address current objective',
      }
    }
    if (parsed.hallucination_detected === true) {
      flags.hallucination = {
        type: 'hallucination',
        confidence: clampConfidence(parsed.hallucination_confidence, 0.6),
        details: parsed.hallucination_reason ?? 'unsupported factual claim',
      }
    }
    return flags
  } catch {
    return {}
  }
}

function recommendAction(flags: MonitorFlag[]): MonitorAction {
  const types = new Set(flags.map((f) => f.type))
  if (types.has('loop')) return 'handoff'
  if (types.has('hallucination')) return 'replan'
  if (flags.length === 0) return 'continue'
  return 'alert'
}

function buildSnapshot(flags: MonitorFlag[]): MonitorFlagSnapshot[] {
  const now = new Date().toISOString()
  return flags.map((f) => ({
    type: f.type,
    confidence: f.confidence,
    details: f.details,
    flagged_at: now,
  }))
}

/**
 * Roda o Monitor sobre a decisão do Planner e o resultado do Executor.
 *
 * Retorna o report e — separadamente — os updates a aplicar em sessions
 * (snapshot de monitor_flags). O orchestrator (T17) é quem aplica via updateSession.
 *
 * Para cada flag, persiste imediatamente em monitor_decisions (gap #2).
 */
export async function monitor(
  ctx: PromptContext,
  decision: PlannerDecision,
  result: ExecutorResult,
): Promise<{ report: MonitorReport; session_updates: Partial<Session> }> {
  const auditCtx = {
    workspace_id: ctx.workspace.id,
    session_id: ctx.session.id,
    trace_id: ctx.session.current_trace_id ?? null,
  }

  if (!isMonitorEnabled(ctx)) {
    return { report: emptyReport(), session_updates: {} }
  }

  const flags: MonitorFlag[] = []

  // Check 5 (sync, sem LLM): low_confidence do Planner.
  if (decision.low_confidence_flag || decision.confidence < LOW_CONFIDENCE_THRESHOLD) {
    flags.push({
      type: 'low_confidence',
      confidence: 1 - decision.confidence,
      details: `planner confidence ${decision.confidence.toFixed(2)} < ${LOW_CONFIDENCE_THRESHOLD}`,
    })
  }

  // Check 4 (sync c/ frustration_signal já vindo do Planner): sentiment.
  // Roda em paralelo com 1+2.
  const sentimentP = analyzeSentiment(ctx.conversation_history)

  // Check 3: loop detector (lê audit_logs + fallback monitor_flags).
  const loopP = detectLoop(ctx.session.id)

  // Check 1+2 (LLM): coerência + alucinação.
  const coherenceHallucinationP = checkCoherenceAndHallucination(ctx, decision, result)

  const [sentiment, loop, ch] = await Promise.all([sentimentP, loopP, coherenceHallucinationP])

  // Aplica resultados.
  if (loop.is_looping) {
    flags.push({
      type: 'loop',
      confidence: 0.9,
      details: `${loop.same_action_count}x consecutive '${loop.looping_action}' (source=${loop.source})`,
    })
  }

  if (sentiment.is_escalating || decision.frustration_signal) {
    flags.push({
      type: 'frustration',
      confidence: sentiment.is_escalating ? 0.8 : 0.6,
      details: `trend=${sentiment.trend.join('->')}; planner_frustration=${decision.frustration_signal ?? false}`,
    })
  }

  if (ch.coherence) flags.push(ch.coherence)
  if (ch.hallucination) flags.push(ch.hallucination)

  const recommended_action = recommendAction(flags)
  const reasoning = flags.length === 0
    ? 'no_flags_raised'
    : flags.map((f) => `${f.type}:${f.confidence.toFixed(2)}`).join(',')

  const report: MonitorReport = { flags, recommended_action, reasoning }

  // Persistência em monitor_decisions (gap #2). Uma row por flag.
  for (const flag of flags) {
    try {
      await recordMonitorDecision({
        session_id: ctx.session.id,
        message_id: null,
        flag: flag.type as MonitorFlagType,
        confidence: flag.confidence,
        details: {
          flag,
          planner_decision: {
            classification: decision.classification,
            action: decision.action,
            confidence: decision.confidence,
          },
          executor_iterations: result.iterations_used,
          forced_handoff: result.forced_handoff ?? false,
          loop_source: flag.type === 'loop' ? loop.source : undefined,
          sentiment_trend: flag.type === 'frustration' ? sentiment.trend : undefined,
        },
        action_taken: recommended_action,
      })
    } catch (e) {
      void logAudit(
        'monitor.persist_failed',
        { error: (e as Error).message, flag_type: flag.type },
        auditCtx,
      )
    }
  }

  // Snapshot leve em sessions.monitor_flags (deixa as últimas N flags).
  const session_updates: Partial<Session> = {}
  if (flags.length > 0) {
    const existing = (ctx.session.monitor_flags ?? []) as MonitorFlagSnapshot[]
    const merged = [...existing, ...buildSnapshot(flags)].slice(-MONITOR_FLAGS_SNAPSHOT_LIMIT)
    session_updates.monitor_flags = merged
  }

  void logAudit(
    'monitor.report',
    {
      flags: flags.map((f) => ({ type: f.type, confidence: f.confidence })),
      recommended_action,
      planner_action: decision.action,
    },
    auditCtx,
  )

  return { report, session_updates }
}
