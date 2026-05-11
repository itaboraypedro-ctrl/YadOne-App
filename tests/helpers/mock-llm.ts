// tests/helpers/mock-llm.ts — Sobrescreve anthropicClient/openaiClient via mutação direta.
// Suporta uma fila FIFO de respostas para Planner → Executor → Monitor.

import * as ext from '@/lib/resilience/external-clients'

type AnthropicCompleteFn = typeof ext.anthropicClient.complete
type AnthropicCompleteWithToolsFn = typeof ext.anthropicClient.completeWithTools
type OpenAIEmbedFn = typeof ext.openaiClient.embed
type OpenAITranscribeFn = typeof ext.openaiClient.transcribe

interface CompleteResponse {
  content: string
  usage_input?: number
  usage_output?: number
}

interface CompleteWithToolsResponse {
  content_blocks: Array<Record<string, unknown>>
  text: string
  stop_reason: string
  usage_input?: number
  usage_output?: number
}

interface AnthropicCallRecord {
  kind: 'complete' | 'completeWithTools'
  input: unknown
}

const ORIGINALS: {
  anthropicComplete: AnthropicCompleteFn
  anthropicCompleteWithTools: AnthropicCompleteWithToolsFn
  openaiEmbed: OpenAIEmbedFn
  openaiTranscribe: OpenAITranscribeFn
} = {
  anthropicComplete: ext.anthropicClient.complete,
  anthropicCompleteWithTools: ext.anthropicClient.completeWithTools,
  openaiEmbed: ext.openaiClient.embed,
  openaiTranscribe: ext.openaiClient.transcribe,
}

let responseQueue: CompleteResponse[] = []
let toolsResponseQueue: CompleteWithToolsResponse[] = []
const callLog: AnthropicCallRecord[] = []
let defaultResponse: CompleteResponse = {
  content: 'Resposta padrão do mock.',
  usage_input: 50,
  usage_output: 25,
}

function dequeueComplete(): CompleteResponse {
  const next = responseQueue.shift()
  return next ?? defaultResponse
}

function dequeueCompleteWithTools(): CompleteWithToolsResponse {
  const next = toolsResponseQueue.shift()
  if (next) return next
  // Default: end_turn com texto placeholder.
  return {
    content_blocks: [{ type: 'text', text: 'Resposta padrão (tools).' }],
    text: 'Resposta padrão (tools).',
    stop_reason: 'end_turn',
    usage_input: 50,
    usage_output: 25,
  }
}

function installMocks(): void {
  ext.anthropicClient.complete = (async (input: Parameters<AnthropicCompleteFn>[0]) => {
    callLog.push({ kind: 'complete', input })
    const r = dequeueComplete()
    return {
      content: r.content,
      usage_input: r.usage_input ?? 50,
      usage_output: r.usage_output ?? 25,
      raw: {},
    }
  }) as AnthropicCompleteFn

  ext.anthropicClient.completeWithTools = (async (
    input: Parameters<AnthropicCompleteWithToolsFn>[0],
  ) => {
    callLog.push({ kind: 'completeWithTools', input })
    const r = dequeueCompleteWithTools()
    return {
      content_blocks: r.content_blocks as never,
      text: r.text,
      stop_reason: r.stop_reason,
      usage_input: r.usage_input ?? 50,
      usage_output: r.usage_output ?? 25,
      raw: {},
    }
  }) as AnthropicCompleteWithToolsFn

  ext.openaiClient.embed = (async () => {
    return [Array(1536).fill(0.1)]
  }) as OpenAIEmbedFn

  ext.openaiClient.transcribe = (async () => {
    return 'transcrição mockada'
  }) as OpenAITranscribeFn
}

/**
 * Define a fila de respostas para anthropicClient.complete na ordem em que será chamada.
 *
 * Convenção típica: [plannerJSON, executorText, monitorJSON, ...]
 */
export function setLLMResponseQueue(responses: CompleteResponse[]): void {
  responseQueue = [...responses]
}

/**
 * Adiciona uma resposta ao final da fila.
 */
export function pushLLMResponse(response: CompleteResponse): void {
  responseQueue.push(response)
}

/**
 * Define a fila de respostas para anthropicClient.completeWithTools (ReAct loop do Executor).
 */
export function setToolsLLMResponseQueue(responses: CompleteWithToolsResponse[]): void {
  toolsResponseQueue = [...responses]
}

/**
 * Helper para resposta JSON do Planner.
 */
export function plannerResponse(payload: {
  classification: string
  action: string
  confidence?: number
  reasoning?: string
  tool_call?: { name: string; input?: Record<string, unknown> } | null
  digression_topic?: string
  objective_to_push?: Record<string, unknown>
}): CompleteResponse {
  const json = JSON.stringify({
    classification: payload.classification,
    action: payload.action,
    confidence: payload.confidence ?? 0.9,
    reasoning: payload.reasoning ?? 'mock_reasoning',
    tool_call: payload.tool_call ?? null,
    digression_topic: payload.digression_topic,
    objective_to_push: payload.objective_to_push,
  })
  return {
    content: '```json\n' + json + '\n```',
    usage_input: 100,
    usage_output: 50,
  }
}

/**
 * Helper para resposta de texto livre do Executor (handleRespond/handleDigress/etc).
 */
export function executorTextResponse(text: string): CompleteResponse {
  return { content: text, usage_input: 100, usage_output: 50 }
}

/**
 * Helper para resposta JSON do Monitor (coerência + alucinação).
 */
export function monitorResponse(payload: {
  is_coherent?: boolean
  hallucination_detected?: boolean
  coherence_reason?: string
  hallucination_reason?: string
  coherence_confidence?: number
  hallucination_confidence?: number
}): CompleteResponse {
  const json = JSON.stringify({
    is_coherent: payload.is_coherent ?? true,
    hallucination_detected: payload.hallucination_detected ?? false,
    coherence_reason: payload.coherence_reason ?? 'ok',
    hallucination_reason: payload.hallucination_reason ?? 'ok',
    coherence_confidence: payload.coherence_confidence ?? 0.9,
    hallucination_confidence: payload.hallucination_confidence ?? 0.9,
  })
  return {
    content: '```json\n' + json + '\n```',
    usage_input: 100,
    usage_output: 50,
  }
}

/**
 * Empilha o set padrão (Planner → Executor → Monitor) para um cenário simples respond.
 */
export function queueSimpleRespondCycle(
  responseText: string,
  opts: {
    plannerOverride?: Parameters<typeof plannerResponse>[0]
    monitorOverride?: Parameters<typeof monitorResponse>[0]
  } = {},
): void {
  setLLMResponseQueue([
    plannerResponse(
      opts.plannerOverride ?? {
        classification: 'ON_TOPIC',
        action: 'respond',
        confidence: 0.9,
      },
    ),
    executorTextResponse(responseText),
    monitorResponse(opts.monitorOverride ?? {}),
  ])
}

export function getLLMCallLog(): ReadonlyArray<AnthropicCallRecord> {
  return callLog
}

export function resetMocks(): void {
  responseQueue = []
  toolsResponseQueue = []
  callLog.length = 0
  defaultResponse = {
    content: 'Resposta padrão do mock.',
    usage_input: 50,
    usage_output: 25,
  }
  installMocks()
}

export function restoreOriginals(): void {
  ext.anthropicClient.complete = ORIGINALS.anthropicComplete
  ext.anthropicClient.completeWithTools = ORIGINALS.anthropicCompleteWithTools
  ext.openaiClient.embed = ORIGINALS.openaiEmbed
  ext.openaiClient.transcribe = ORIGINALS.openaiTranscribe
}

// Instala mocks já no import — caller faz reset entre testes via resetMocks().
installMocks()
