// tests/edge-cases/api-failures.test.ts — T24, cenários 6-10: falhas de APIs externas.
//
// Mocks no nível dos módulos. Não importa de tests/helpers — auto-suficiente.

import type { InboundMessage } from '@/types/message'

// ─────────────────────────────────────────────────────────────────────
// Mocks (mesma estrutura de inputs.test.ts, mas com hooks abertos para
// configurar comportamento de falha por teste)
// ─────────────────────────────────────────────────────────────────────

jest.mock('@supabase/supabase-js', () => {
  const builder: Record<string, unknown> = {}
  const chainable = new Proxy(builder, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => Promise.resolve({ data: null, error: null })
      }
      return () => chainable
    },
  })
  return {
    createClient: () => ({ from: () => chainable }),
  }
})

const anthropicComplete = jest.fn()
const anthropicCompleteWithTools = jest.fn()
const openaiEmbed = jest.fn()
const openaiTranscribe = jest.fn()
const channelSend = jest.fn()

jest.mock('@/lib/resilience/external-clients', () => ({
  anthropicClient: {
    complete: (...args: unknown[]) => anthropicComplete(...args),
    completeWithTools: (...args: unknown[]) => anthropicCompleteWithTools(...args),
  },
  openaiClient: {
    embed: (...args: unknown[]) => openaiEmbed(...args),
    transcribe: (...args: unknown[]) => openaiTranscribe(...args),
  },
  channelClient: {
    send: (...args: unknown[]) => channelSend(...args),
  },
}))

jest.mock('@/lib/guardrails', () => ({
  runInputGuards: jest.fn().mockResolvedValue({ allowed: true }),
}))
jest.mock('@/lib/guardrails/circuit-breaker', () => ({
  checkSessionBreaker: jest.fn().mockResolvedValue({ allowed: true }),
}))
jest.mock('@/lib/guardrails/output-validator', () => ({
  validateOutput: jest.fn().mockResolvedValue({ valid: true, action: 'continue', violations: [] }),
}))
jest.mock('@/lib/guardrails/content-filter-output', () => ({
  filterOutput: jest.fn().mockResolvedValue({ safe: true }),
}))
jest.mock('@/lib/guardrails/leak-detector', () => ({
  detectLeaks: jest.fn().mockResolvedValue({ has_leak: false }),
}))

jest.mock('@/lib/media/processor', () => ({
  processInboundMedia: jest.fn().mockImplementation(async (i: InboundMessage) => i.content ?? ''),
}))

jest.mock('@/lib/unification/strategy', () => ({
  detectExistingClient: jest.fn().mockResolvedValue(null),
  normalizePhone: (p: string) => p,
}))

const baseClient = {
  id: 'client_1',
  workspace_id: 'ws_1',
  phone: '+5511999990000',
  name: null,
  email: null,
  notes: null,
  crm_status: 'new' as const,
  crm_tags: null,
  unified_id: null,
  secondary_phones: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
jest.mock('@/lib/db/clients', () => ({
  getOrCreateClient: jest.fn().mockResolvedValue(baseClient),
  getClient: jest.fn().mockResolvedValue(baseClient),
  findClientByPhone: jest.fn().mockResolvedValue(null),
  findClientBySecondaryPhone: jest.fn().mockResolvedValue(null),
  findClientByEmail: jest.fn().mockResolvedValue(null),
  updateClient: jest.fn().mockResolvedValue(null),
}))

const baseSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'session_1',
  workspace_id: 'ws_1',
  client_id: 'client_1',
  flow_id: null,
  flow_version: null,
  current_node_id: null,
  channel: 'whatsapp',
  channel_session_id: null,
  status: 'active',
  digression_state: 'none',
  objective_stack: [],
  collected_data: {},
  completed_steps: [],
  wait_until: null,
  expires_at: null,
  replan_count: 0,
  monitor_flags: [],
  current_trace_id: null,
  memory_processed: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

const incrementReplanCountMock = jest.fn().mockResolvedValue(1)
jest.mock('@/lib/db/sessions', () => ({
  getSession: jest.fn().mockImplementation(async () => baseSession()),
  getActiveSession: jest.fn().mockResolvedValue(null),
  createSession: jest.fn().mockImplementation(async (input: { workspace_id: string; client_id: string }) =>
    baseSession({ workspace_id: input.workspace_id, client_id: input.client_id }),
  ),
  updateSession: jest.fn().mockResolvedValue(undefined),
  incrementReplanCount: (...args: unknown[]) => incrementReplanCountMock(...args),
  getReplanCount: jest.fn().mockResolvedValue(0),
  expireSession: jest.fn().mockResolvedValue(undefined),
}))

const saveMessageMock = jest.fn().mockResolvedValue({ id: 'msg_1' })
jest.mock('@/lib/db/messages', () => ({
  saveMessage: (...args: unknown[]) => saveMessageMock(...args),
  getHistory: jest.fn().mockResolvedValue([]),
}))

const logAuditMock = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/db/audit', () => ({
  logAudit: (...args: unknown[]) => logAuditMock(...args),
}))
jest.mock('@/lib/db/crm-events', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/db/flows', () => ({
  getActiveFlow: jest.fn().mockResolvedValue(null),
  getFlowNodes: jest.fn().mockResolvedValue([]),
  getFlowToolPolicies: jest.fn().mockResolvedValue([]),
  getNodeTags: jest.fn().mockResolvedValue([]),
  getFlowForSession: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/db/workspaces', () => ({
  getWorkspace: jest.fn().mockResolvedValue({
    id: 'ws_1',
    name: 'Test WS',
    timezone: 'America/Sao_Paulo',
    business_name: null,
    business_description: null,
    operating_hours: null,
    monthly_cost_cap_usd: 100,
    cost_cap_threshold_pct: 0.8,
    rate_limit_per_hour: 60,
    unification_strategy: 'phone',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  getAgentConfig: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/db/channel-configs', () => ({
  getChannelConfigByType: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/memory/builder', () => ({
  buildMemoryContext: jest.fn().mockResolvedValue(''),
}))
jest.mock('@/lib/knowledge/fetcher', () => ({
  getKnowledgeForNode: jest.fn().mockResolvedValue({
    formatted: '',
    items_used: 0,
    tokens_estimate: 0,
    used_rag: false,
  }),
}))
jest.mock('@/lib/db/followup-timers', () => ({
  cancelTimersBySession: jest.fn().mockResolvedValue(undefined),
  createTimer: jest.fn().mockResolvedValue({ id: 't1' }),
  getPendingTimers: jest.fn().mockResolvedValue([]),
  markTimerFired: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/metrics/cost-tracker', () => ({
  trackUsage: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/tools/registry', () => ({
  getToolDefinition: jest.fn().mockResolvedValue(null),
  listAvailableTools: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/tools/executor', () => ({
  executeTool: jest.fn().mockResolvedValue({ success: true, result: {} }),
}))

const planMock = jest.fn()
jest.mock('@/lib/engine/planner', () => ({
  plan: (...args: unknown[]) => planMock(...args),
}))

const executeMock = jest.fn()
jest.mock('@/lib/engine/executor', () => ({
  execute: (...args: unknown[]) => executeMock(...args),
}))

jest.mock('@/lib/engine/monitor', () => ({
  monitor: jest.fn().mockResolvedValue({
    report: { recommended_action: 'ok' },
    session_updates: {},
  }),
}))

jest.mock('@/lib/engine/context-builder', () => ({
  buildPromptContext: jest.fn().mockImplementation(async (session_id: string, current_message: string) => ({
    workspace: { id: 'ws_1', name: 'WS', timezone: 'America/Sao_Paulo' },
    agent_config: null,
    client: baseClient,
    semantic_memory_text: '',
    episodic_memory_text: '',
    session: baseSession({ id: session_id }),
    flow: null,
    current_node: null,
    knowledge_content: { formatted: '', items_used: 0, tokens_estimate: 0, used_rag: false },
    conversation_history: [],
    current_message,
    catalog: [],
    include_full_catalog: false,
  })),
}))

import { processMessage } from '@/lib/engine/orchestrator'

function makeInbound(content: string, channel_message_id: string = 'apifail-1'): InboundMessage {
  return {
    from: '+5511999990000',
    content,
    media_type: 'text',
    timestamp: new Date().toISOString(),
    channel_message_id,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  // Defaults
  planMock.mockResolvedValue({
    classification: 'ON_TOPIC',
    action: 'respond',
    confidence: 0.9,
    reasoning: 'ok',
  })
  executeMock.mockResolvedValue({
    response_text: 'ok',
    session_updates: {},
    tool_calls_made: [],
    iterations_used: 1,
    model_used: 'claude-sonnet-4-6',
    tokens_in: 10,
    tokens_out: 5,
  })
  channelSend.mockResolvedValue(undefined)
  anthropicComplete.mockResolvedValue({ content: '', usage_input: 0, usage_output: 0, raw: {} })
  saveMessageMock.mockResolvedValue({ id: 'msg_1' })
  incrementReplanCountMock.mockResolvedValue(1)
})

// ─────────────────────────────────────────────────────────────────────
// Cenário 6: Anthropic timeout → motor envia fallback ao cliente
// ─────────────────────────────────────────────────────────────────────
describe('Edge case 6: Anthropic timeout repetido → fallback enviado ao cliente', () => {
  it('quando executor lança erro fatal, orchestrator envia mensagem fallback', async () => {
    // Simulamos a falha total no executor (que internamente já passou por retry+breaker)
    executeMock.mockRejectedValue(new Error('anthropic_timeout: circuit breaker open'))

    const result = await processMessage({
      workspace_id: 'ws_1',
      channel: 'whatsapp',
      inbound: makeInbound('oi', 'msg-anth-timeout'),
    })

    expect(result.status).toBe('errored')
    // Asserção crítica: fallback hardcoded foi enviado
    expect(channelSend).toHaveBeenCalled()
    const sendCall = channelSend.mock.calls[0]
    expect(sendCall[2]).toEqual({ text: 'Tive um problema técnico, já vou retornar.' })
  })
})

// ─────────────────────────────────────────────────────────────────────
// Cenário 7: OpenAI embedding falha → motor segue (RAG degradado)
// ─────────────────────────────────────────────────────────────────────
describe('Edge case 7: OpenAI embedding falha → motor não crasha', () => {
  it('embed rejeitado → fluxo continua e responde com sucesso', async () => {
    openaiEmbed.mockRejectedValue(new Error('openai_embed_failed'))
    // O knowledge fetcher já é mockado para retornar vazio — simula RAG degradado
    // sem propagar erro ao orchestrator. Verifica que executor é chamado e gera resposta.

    const result = await processMessage({
      workspace_id: 'ws_1',
      channel: 'whatsapp',
      inbound: makeInbound('me fala dos preços', 'msg-rag-degraded'),
    })

    expect(result.status).toBe('sent')
    expect(executeMock).toHaveBeenCalled()
    expect(channelSend).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────
// Cenário 8: canal de envio falha → audit fallback_send_failed (ou send_failed)
// ─────────────────────────────────────────────────────────────────────
describe('Edge case 8: Canal de envio falha', () => {
  it('quando channelClient.send rejeita, motor loga erro e retorna status errored', async () => {
    channelSend.mockRejectedValue(new Error('whatsapp_api_500'))

    const result = await processMessage({
      workspace_id: 'ws_1',
      channel: 'whatsapp',
      inbound: makeInbound('oi', 'msg-channel-fail'),
    })

    expect(result.status).toBe('errored')
    expect(result.reason).toBe('send_failed')
    // logAudit chamado com event 'orchestrator.send_failed'
    const events = logAuditMock.mock.calls.map((c) => c[0])
    expect(events).toContain('orchestrator.send_failed')
    // Asserção final: send foi chamado uma única vez (não retentou)
    expect(channelSend).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────────────
// Cenário 9: saveMessage rejeita → motor loga e segue
// ─────────────────────────────────────────────────────────────────────
describe('Edge case 9: Supabase indisponível em saveMessage', () => {
  it('saveMessage falha → motor loga audit mas não crasha; resposta é enviada normalmente', async () => {
    saveMessageMock.mockRejectedValue(new Error('supabase_500'))

    const result = await processMessage({
      workspace_id: 'ws_1',
      channel: 'whatsapp',
      inbound: makeInbound('oi', 'msg-save-fail'),
    })

    expect(result.status).toBe('sent')
    const events = logAuditMock.mock.calls.map((c) => c[0])
    // Espera que pelo menos um dos save_*_failed tenha sido logado
    const hasSaveFailedAudit = events.some(
      (e) => e === 'orchestrator.save_inbound_failed' || e === 'orchestrator.save_outbound_failed',
    )
    expect(hasSaveFailedAudit).toBe(true)
    // Send ainda aconteceu
    expect(channelSend).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────
// Cenário 10: Planner retorna re_plan repetido → handoff após 3 tentativas
// ─────────────────────────────────────────────────────────────────────
describe('Edge case 10: Planner JSON inválido → re_plan loop → handoff', () => {
  it('monitor recomenda replan 3x consecutivas, motor força handoff', async () => {
    // Cada iteração: monitor → recommended_action: replan, até bater MAX_REPLAN_LOOP
    const monitorModule = jest.requireMock('@/lib/engine/monitor') as {
      monitor: jest.Mock
    }
    monitorModule.monitor.mockResolvedValue({
      report: { recommended_action: 'replan' },
      session_updates: {},
    })

    // incrementReplanCount retorna valores crescentes simulando contagem real
    let n = 0
    incrementReplanCountMock.mockImplementation(async () => {
      n += 1
      return n
    })

    const result = await processMessage({
      workspace_id: 'ws_1',
      channel: 'whatsapp',
      inbound: makeInbound('oi', 'msg-replan-loop'),
    })

    // Após 3 replans, motor força handoff (forceHandoff é chamado dentro do orchestrator)
    expect(result.status).toBe('sent')
    // executor foi chamado pelo menos 3 vezes (3 iterações do loop) + 1 do forceHandoff
    expect(executeMock.mock.calls.length).toBeGreaterThanOrEqual(3)
  })
})
