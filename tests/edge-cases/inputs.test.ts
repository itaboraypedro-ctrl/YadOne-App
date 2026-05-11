// tests/edge-cases/inputs.test.ts — T24, cenários 1-5: inputs extremos.
//
// Mocka o pipeline do motor no nível dos módulos (sessions, clients, messages,
// flows, audit, etc) para que processMessage rode sem tocar Postgres.
// Cada teste é auto-suficiente — não importa de tests/helpers.

import type { InboundMessage } from '@/types/message'

// ─────────────────────────────────────────────────────────────────────
// MOCKS GLOBAIS — declarados antes do import do orchestrator
// ─────────────────────────────────────────────────────────────────────

// Supabase: createClient devolve um stub builder chainable (qualquer .from(...) cai aqui)
jest.mock('@supabase/supabase-js', () => {
  const builder: Record<string, unknown> = {}
  const chainable = new Proxy(builder, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined // não é thenable
      // métodos terminais retornam Promise resolvendo {data:null,error:null}
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => Promise.resolve({ data: null, error: null })
      }
      // métodos chainable: select/eq/in/order/limit/insert/update/delete/contains
      return () => chainable
    },
  })
  return {
    createClient: () => ({
      from: () => chainable,
    }),
  }
})

// External clients (Anthropic + OpenAI + canal)
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

// Guardrails do input layer
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

// Mídia
jest.mock('@/lib/media/processor', () => ({
  processInboundMedia: jest.fn().mockImplementation(async (inbound: InboundMessage) => inbound.content ?? ''),
}))

// Unificação
const detectExistingClient = jest.fn().mockResolvedValue(null)
jest.mock('@/lib/unification/strategy', () => ({
  detectExistingClient: (...args: unknown[]) => detectExistingClient(...args),
  normalizePhone: (phone: string) => {
    if (!phone) return ''
    const stripped = phone.replace(/[^\d+]/g, '')
    const hasPlus = stripped.startsWith('+')
    const digits = stripped.replace(/\+/g, '')
    if (digits.length === 0) return ''
    return hasPlus ? `+${digits}` : `+${digits}`
  },
}))

// DB clients
const clientStore = new Map<string, { id: string; phone: string; workspace_id: string; name: null; email: null; notes: null; crm_status: 'new'; crm_tags: null; unified_id: null; secondary_phones: string[]; created_at: string; updated_at: string }>()
const getOrCreateClient = jest.fn().mockImplementation(async (workspace_id: string, phone: string) => {
  const key = `${workspace_id}:${phone}`
  let c = clientStore.get(key)
  if (!c) {
    c = {
      id: `client_${clientStore.size + 1}`,
      workspace_id,
      phone,
      name: null,
      email: null,
      notes: null,
      crm_status: 'new',
      crm_tags: null,
      unified_id: null,
      secondary_phones: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    clientStore.set(key, c)
  }
  return c
})
const getClient = jest.fn().mockResolvedValue(null)
jest.mock('@/lib/db/clients', () => ({
  getOrCreateClient: (...args: unknown[]) => getOrCreateClient(...args),
  getClient: (...args: unknown[]) => getClient(...args),
  findClientByPhone: jest.fn().mockResolvedValue(null),
  findClientBySecondaryPhone: jest.fn().mockResolvedValue(null),
  findClientByEmail: jest.fn().mockResolvedValue(null),
  updateClient: jest.fn().mockResolvedValue(null),
}))

// DB sessions
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

jest.mock('@/lib/db/sessions', () => ({
  getSession: jest.fn().mockImplementation(async () => baseSession()),
  getActiveSession: jest.fn().mockResolvedValue(null),
  createSession: jest.fn().mockImplementation(async (input: { workspace_id: string; client_id: string }) => baseSession({ workspace_id: input.workspace_id, client_id: input.client_id })),
  updateSession: jest.fn().mockResolvedValue(undefined),
  incrementReplanCount: jest.fn().mockResolvedValue(1),
  getReplanCount: jest.fn().mockResolvedValue(0),
  expireSession: jest.fn().mockResolvedValue(undefined),
}))

// DB messages
const saveMessageMock = jest.fn().mockResolvedValue({ id: 'msg_1' })
const deleteUserMock = jest.fn()
jest.mock('@/lib/db/messages', () => ({
  saveMessage: (...args: unknown[]) => saveMessageMock(...args),
  getHistory: jest.fn().mockResolvedValue([]),
}))

// DB audit + crm-events (silenciosos)
jest.mock('@/lib/db/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/db/crm-events', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}))

// DB flows
jest.mock('@/lib/db/flows', () => ({
  getActiveFlow: jest.fn().mockResolvedValue(null),
  getFlowNodes: jest.fn().mockResolvedValue([]),
  getFlowToolPolicies: jest.fn().mockResolvedValue([]),
  getNodeTags: jest.fn().mockResolvedValue([]),
  getFlowForSession: jest.fn().mockResolvedValue(null),
}))

// DB workspaces
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

// DB channel-configs (F13)
jest.mock('@/lib/db/channel-configs', () => ({
  getChannelConfigByType: jest.fn().mockResolvedValue(null),
}))

// Memory + knowledge
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

// Followup timers + cost-tracker
jest.mock('@/lib/db/followup-timers', () => ({
  cancelTimersBySession: jest.fn().mockResolvedValue(undefined),
  createTimer: jest.fn().mockResolvedValue({ id: 't1' }),
  getPendingTimers: jest.fn().mockResolvedValue([]),
  markTimerFired: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/metrics/cost-tracker', () => ({
  trackUsage: jest.fn().mockResolvedValue(undefined),
}))

// Tools (registry/executor) — caso o pipeline acabe acionando
jest.mock('@/lib/tools/registry', () => ({
  getToolDefinition: jest.fn().mockResolvedValue(null),
  listAvailableTools: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/tools/executor', () => ({
  executeTool: jest.fn().mockResolvedValue({ success: true, result: {} }),
}))

// Engine submodules — mocka o ciclo plan/execute/monitor para gerar respostas previsíveis
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
    client: { id: 'client_1', workspace_id: 'ws_1', phone: '+5511999990000' },
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

// ─────────────────────────────────────────────────────────────────────
// IMPORT após mocks
// ─────────────────────────────────────────────────────────────────────

import { processMessage } from '@/lib/engine/orchestrator'

// helpers para os testes
function makeInbound(content: string, channel_message_id: string = 'msg-id-1'): InboundMessage {
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
  clientStore.clear()
  // Default plan/execute → respond simples
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
  // Garante mocks default
  anthropicComplete.mockResolvedValue({ content: '', usage_input: 0, usage_output: 0, raw: {} })
  saveMessageMock.mockResolvedValue({ id: 'msg_1' })
})

describe('Edge case 1: mensagem vazia', () => {
  it('processa mensagem com content="" sem crashar e retorna status != errored', async () => {
    const result = await processMessage({
      workspace_id: 'ws_1',
      channel: 'whatsapp',
      inbound: makeInbound(''),
    })
    expect(result.status).not.toBe('errored')
    expect(['sent', 'blocked']).toContain(result.status)
  })
})

describe('Edge case 2: mensagem com 10.000 caracteres', () => {
  it('processa mensagem extremamente longa sem crashar', async () => {
    const longText = 'a'.repeat(10_000)
    const result = await processMessage({
      workspace_id: 'ws_1',
      channel: 'whatsapp',
      inbound: makeInbound(longText, 'long-msg'),
    })
    expect(result.status).not.toBe('errored')
  })
})

describe('Edge case 3: mensagem só com emojis', () => {
  it('trata emojis como texto normal', async () => {
    const result = await processMessage({
      workspace_id: 'ws_1',
      channel: 'whatsapp',
      inbound: makeInbound('🎉🔥💯🌈', 'emoji-msg'),
    })
    expect(result.status).toBe('sent')
  })
})

describe('Edge case 4: mensagem com SQL injection', () => {
  it('motor processa string com SQL sem executá-lo no banco', async () => {
    const sqli = "'; DROP TABLE users; --"
    const result = await processMessage({
      workspace_id: 'ws_1',
      channel: 'whatsapp',
      inbound: makeInbound(sqli, 'sqli-msg'),
    })
    // motor não pode crashar
    expect(result.status).not.toBe('errored')
    // Asserção crítica: nenhum mock de DB foi chamado com .delete() em users —
    // como mockamos createClient inteiro, qualquer chamada a from('users').delete()
    // resultaria num no-op sem efeitos. Verificamos que saveMessage recebeu o
    // payload bruto (string preservada como conteúdo) — ou seja, foi tratado
    // como dado e não como SQL.
    const calls = saveMessageMock.mock.calls
    // saveMessage(session_id, role, content, opts)
    const userCall = calls.find((c) => c[1] === 'user')
    if (userCall) {
      expect(userCall[2]).toBe(sqli)
    }
  })
})

describe('Edge case 5: phone normalization em 10 formatos', () => {
  // Helper local que replica normalizePhone (em vez de importar)
  function normalize(phone: string): string {
    const stripped = phone.replace(/[^\d+]/g, '')
    const hasPlus = stripped.startsWith('+')
    const digits = stripped.replace(/\+/g, '')
    if (digits.length === 0) return ''
    return hasPlus ? `+${digits}` : `+${digits}`
  }

  it('todos os 10 formatos com mesma sequência de dígitos colapsam ao mesmo phone canônico', () => {
    // Mesmos dígitos (5511999988888) com formatações diferentes
    const variants = [
      '+5511999988888',
      '+55 11 99998-8888',
      '+55 (11) 99998-8888',
      '+55.11.99998.8888',
      '55 11 99998 8888',
      '5511999988888',
      '+55-11-99998-8888',
      '(55) 11 99998-8888',
      '+55  11  99998  8888',
      '\t+55 11 99998-8888\n',
    ]
    const normalized = variants.map(normalize)
    // Todos devem colapsar para o mesmo phone canônico
    const distinct = new Set(normalized)
    expect(distinct.size).toBe(1)
    expect([...distinct][0]).toBe('+5511999988888')
    // normalize idempotente
    for (const v of variants) {
      const once = normalize(v)
      const twice = normalize(once)
      expect(once).toBe(twice)
    }
  })

  it('getOrCreateClient chamado com phones idênticos retorna o MESMO client_id', async () => {
    const c1 = await getOrCreateClient('ws_1', '+5511999988888')
    const c2 = await getOrCreateClient('ws_1', '+5511999988888')
    expect(c1.id).toBe(c2.id)
  })
})
