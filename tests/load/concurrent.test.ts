// tests/load/concurrent.test.ts — T24, cenários 14-15: concorrência.
//
// Cenários:
//  14. 10 mensagens paralelas do MESMO cliente — rate-limit é incrementado 10x.
//  15. 5 sessões em workspaces DIFERENTES — isolation: nenhum cross-contamination
//      nas chamadas a getActiveSession e channelClient.send.

import type { InboundMessage } from '@/types/message'

// ─────────────────────────────────────────────────────────────────────
// Mocks
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
  return { createClient: () => ({ from: () => chainable }) }
})

const anthropicComplete = jest.fn()
const anthropicCompleteWithTools = jest.fn()
const channelSend = jest.fn()

jest.mock('@/lib/resilience/external-clients', () => ({
  anthropicClient: {
    complete: (...args: unknown[]) => anthropicComplete(...args),
    completeWithTools: (...args: unknown[]) => anthropicCompleteWithTools(...args),
  },
  openaiClient: {
    embed: jest.fn().mockResolvedValue([[0.1]]),
    transcribe: jest.fn().mockResolvedValue(''),
  },
  channelClient: {
    send: (...args: unknown[]) => channelSend(...args),
  },
}))

// Hooks que os testes vão configurar
const incrementBucketMock = jest.fn().mockResolvedValue(1)
const checkRateLimitMock = jest.fn()

jest.mock('@/lib/db/rate-limits', () => ({
  incrementBucket: (...args: unknown[]) => incrementBucketMock(...args),
}))
jest.mock('@/lib/guardrails/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}))

// runInputGuards real (vai usar checkRateLimit mockado) — mas como não importamos
// do `@/lib/guardrails`, vamos re-mockar para chamar o checkRateLimitMock direto.
jest.mock('@/lib/guardrails', () => ({
  runInputGuards: jest.fn().mockImplementation(async (input: { workspace_id: string; phone: string }) => {
    const r = await checkRateLimitMock(input.workspace_id, input.phone)
    if (r && r.allowed === false) {
      return { allowed: false, reason: 'rate_limit_exceeded' }
    }
    return { allowed: true }
  }),
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

const getOrCreateClientMock = jest.fn().mockImplementation(async (workspace_id: string, phone: string) => ({
  id: `client_${workspace_id}_${phone}`,
  workspace_id,
  phone,
  name: null,
  email: null,
  notes: null,
  crm_status: 'new' as const,
  crm_tags: null,
  unified_id: null,
  secondary_phones: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}))
const getClientMock = jest.fn().mockResolvedValue(null)
jest.mock('@/lib/db/clients', () => ({
  getOrCreateClient: (...args: unknown[]) => getOrCreateClientMock(...args),
  getClient: (...args: unknown[]) => getClientMock(...args),
  findClientByPhone: jest.fn().mockResolvedValue(null),
  findClientBySecondaryPhone: jest.fn().mockResolvedValue(null),
  findClientByEmail: jest.fn().mockResolvedValue(null),
  updateClient: jest.fn().mockResolvedValue(null),
}))

// Sessões: cada workspace tem sua própria sessão isolada — guardamos um Map.
const sessionByWorkspace = new Map<string, string>() // workspace_id → session_id

const baseSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'session_default',
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

const getActiveSessionMock = jest.fn()
const createSessionMock = jest.fn()
const getSessionMock = jest.fn()

jest.mock('@/lib/db/sessions', () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args),
  getActiveSession: (...args: unknown[]) => getActiveSessionMock(...args),
  createSession: (...args: unknown[]) => createSessionMock(...args),
  updateSession: jest.fn().mockResolvedValue(undefined),
  incrementReplanCount: jest.fn().mockResolvedValue(1),
  getReplanCount: jest.fn().mockResolvedValue(0),
  expireSession: jest.fn().mockResolvedValue(undefined),
}))

const saveMessageMock = jest.fn().mockResolvedValue({ id: 'msg_1' })
jest.mock('@/lib/db/messages', () => ({
  saveMessage: (...args: unknown[]) => saveMessageMock(...args),
  getHistory: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/db/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
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
  getWorkspace: jest.fn().mockImplementation(async (id: string) => ({
    id,
    name: `WS ${id}`,
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
  })),
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

// Executor: gera resposta com workspace_id no texto para validar isolation
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
  buildPromptContext: jest.fn().mockImplementation(async (session_id: string, current_message: string) => {
    // session_id segue padrão "session_<workspace_id>_<client_id>" definido em createSessionMock
    // ou apenas "session_default" no fallback.
    const m = session_id.match(/^session_(ws_[^_]+)_/)
    const workspace_id = m ? m[1] : 'ws_1'
    return {
      workspace: { id: workspace_id, name: `WS ${workspace_id}`, timezone: 'America/Sao_Paulo' },
      agent_config: null,
      client: { id: 'client_1', workspace_id, phone: '+5511999990000' },
      semantic_memory_text: '',
      episodic_memory_text: '',
      session: { id: session_id, workspace_id, client_id: 'client_1', flow_id: null, flow_version: null, current_node_id: null, channel: 'whatsapp', channel_session_id: null, status: 'active', digression_state: 'none', objective_stack: [], collected_data: {}, completed_steps: [], wait_until: null, expires_at: null, replan_count: 0, monitor_flags: [], current_trace_id: null, memory_processed: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      flow: null,
      current_node: null,
      knowledge_content: { formatted: '', items_used: 0, tokens_estimate: 0, used_rag: false },
      conversation_history: [],
      current_message,
      catalog: [],
      include_full_catalog: false,
    }
  }),
}))

import { processMessage } from '@/lib/engine/orchestrator'

function makeInbound(content: string, channel_message_id: string, from: string = '+5511999990000'): InboundMessage {
  return {
    from,
    content,
    media_type: 'text',
    timestamp: new Date().toISOString(),
    channel_message_id,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionByWorkspace.clear()

  planMock.mockResolvedValue({
    classification: 'ON_TOPIC',
    action: 'respond',
    confidence: 0.9,
    reasoning: 'ok',
  })
  executeMock.mockImplementation(async (_decision: unknown, ctx: { workspace: { id: string } }) => ({
    response_text: `resp_${ctx.workspace.id}`,
    session_updates: {},
    tool_calls_made: [],
    iterations_used: 1,
    model_used: 'claude-sonnet-4-6',
    tokens_in: 10,
    tokens_out: 5,
  }))
  channelSend.mockResolvedValue(undefined)
  anthropicComplete.mockResolvedValue({ content: '', usage_input: 0, usage_output: 0, raw: {} })
  saveMessageMock.mockResolvedValue({ id: 'msg_1' })

  // Default session/active behavior
  getActiveSessionMock.mockResolvedValue(null)
  createSessionMock.mockImplementation(async (input: { workspace_id: string; client_id: string }) => {
    const id = `session_${input.workspace_id}_${input.client_id}`
    return baseSession({ id, workspace_id: input.workspace_id, client_id: input.client_id })
  })
  getSessionMock.mockImplementation(async (id: string) => baseSession({ id }))
  checkRateLimitMock.mockResolvedValue({ allowed: true, current: 1, limit: 60 })
})

// ─────────────────────────────────────────────────────────────────────
// Cenário 14: 10 mensagens paralelas do mesmo cliente
// ─────────────────────────────────────────────────────────────────────
describe('Edge case 14: 10 mensagens paralelas do mesmo cliente — rate-limit incrementa 10x', () => {
  it('cada Promise.all entry chama checkRateLimit exatamente 1x → total 10', async () => {
    let count = 0
    checkRateLimitMock.mockImplementation(async () => {
      count += 1
      return { allowed: true, current: count, limit: 60 }
    })

    const promises = Array.from({ length: 10 }, (_, i) =>
      processMessage({
        workspace_id: 'ws_1',
        channel: 'whatsapp',
        inbound: makeInbound(`msg ${i}`, `concur-${i}`),
      }),
    )
    const results = await Promise.all(promises)

    expect(results).toHaveLength(10)
    expect(results.every((r) => r.status === 'sent')).toBe(true)
    expect(checkRateLimitMock).toHaveBeenCalledTimes(10)
    expect(count).toBe(10)
    // Todas as chamadas foram com mesmo workspace+phone
    for (const call of checkRateLimitMock.mock.calls) {
      expect(call[0]).toBe('ws_1')
      expect(call[1]).toBe('+5511999990000')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// Cenário 15: 5 sessões em workspaces diferentes
// ─────────────────────────────────────────────────────────────────────
describe('Edge case 15: 5 sessões em workspaces DIFERENTES — sem cross-contamination', () => {
  it('cada workspace tem sua própria sessão; channelClient.send recebe mensagens isoladas', async () => {
    // Asserções:
    //  - createSession chamado uma vez por workspace
    //  - channelClient.send recebe text contendo o workspace_id correspondente
    //  - getActiveSession recebe workspace_id correto em cada chamada

    const workspaces = ['ws_a', 'ws_b', 'ws_c', 'ws_d', 'ws_e']

    const promises = workspaces.map((ws, i) =>
      processMessage({
        workspace_id: ws,
        channel: 'whatsapp',
        inbound: makeInbound(`msg from ${ws}`, `iso-${i}`, `+551199999000${i}`),
      }),
    )
    const results = await Promise.all(promises)

    expect(results).toHaveLength(5)
    expect(results.every((r) => r.status === 'sent')).toBe(true)

    // Cada workspace recebeu sua chamada a getActiveSession com workspace_id correto
    const activeSessionCalls = getActiveSessionMock.mock.calls
    expect(activeSessionCalls).toHaveLength(5)
    const wsArgs = activeSessionCalls.map((c) => c[0]).sort()
    expect(wsArgs).toEqual(workspaces.slice().sort())

    // Cada workspace teve uma sessão criada
    expect(createSessionMock).toHaveBeenCalledTimes(5)
    const createdWorkspaces = createSessionMock.mock.calls.map((c) => c[0].workspace_id).sort()
    expect(createdWorkspaces).toEqual(workspaces.slice().sort())

    // channelClient.send recebeu cada workspace_id em chamadas separadas
    expect(channelSend).toHaveBeenCalledTimes(5)
    const sentWorkspaces = channelSend.mock.calls.map((c) => c[0]).sort()
    expect(sentWorkspaces).toEqual(workspaces.slice().sort())

    // Cada send carrega o response_text correspondente — sem misturar
    for (const call of channelSend.mock.calls) {
      const [ws, _to, msg] = call
      expect((msg as { text: string }).text).toBe(`resp_${ws}`)
    }
  })
})
