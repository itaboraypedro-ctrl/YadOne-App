// tests/helpers/mock-db.ts — Estado in-memory + factories de mocks para módulos de DB.
//
// Estratégia: cada módulo de DB que o orchestrator depende é mockado via jest.mock no
// teste, e os factories abaixo retornam objetos com as funções esperadas que leem/
// escrevem neste store. Isso evita ter que mockar a chain do supabase-js.

import {
  WORKSPACE_FIXTURE,
  AGENT_CONFIG_FIXTURE,
  FLOW_FIXTURE,
  NODES_FIXTURE,
  PRODUCTS_FIXTURE,
  CLIENT_FIXTURE,
  SESSION_FIXTURE,
} from '../fixtures/workspace'

import type { Workspace, WorkspaceAgentConfig } from '@/types/workspace'
import type { Client } from '@/types/client'
import type { Session } from '@/types/session'
import type { Flow, FlowNode, FlowToolPolicy } from '@/types/flow'
import type { Message } from '@/types/message'
import type { CatalogProduct } from '@/lib/engine/context-builder'

interface IdempotencyRow {
  key: string
  workspace_id: string | null
  result: unknown
  expires_at: string
}

interface FollowupTimerRow {
  id: string
  session_id: string
  workspace_id: string
  client_id: string | null
  target_node_id: string | null
  scheduled_at: string
  status: string
  created_at: string
}

interface StoreShape {
  workspaces: Map<string, Workspace>
  agent_configs: Map<string, WorkspaceAgentConfig>
  flows: Map<string, Flow>
  nodes: Map<string, FlowNode[]> // by flow_id
  tool_policies: Map<string, FlowToolPolicy[]> // by flow_id
  clients: Map<string, Client>
  clients_by_phone: Map<string, Client> // workspace_id|phone
  sessions: Map<string, Session>
  messages: Map<string, Message[]> // by session_id
  catalog: CatalogProduct[]
  audit_events: Array<{ event_type: string; payload: Record<string, unknown> }>
  crm_events: Array<{ type: string; payload: Record<string, unknown> }>
  monitor_decisions: Array<Record<string, unknown>>
  cost_cap: { current_usd: number; cap_usd: number; percentage: number }
  rate_limit_count: number
  idempotency: Map<string, IdempotencyRow>
  followup_timers: FollowupTimerRow[]
}

export const store: StoreShape = {
  workspaces: new Map(),
  agent_configs: new Map(),
  flows: new Map(),
  nodes: new Map(),
  tool_policies: new Map(),
  clients: new Map(),
  clients_by_phone: new Map(),
  sessions: new Map(),
  messages: new Map(),
  catalog: [],
  audit_events: [],
  crm_events: [],
  monitor_decisions: [],
  cost_cap: { current_usd: 0, cap_usd: 100, percentage: 0 },
  rate_limit_count: 0,
  idempotency: new Map(),
  followup_timers: [],
}

let counter = 1
function newId(prefix: string): string {
  return `${prefix}_${counter++}_${Math.random().toString(36).slice(2, 8)}`
}

export function resetStore(opts: { withTools?: boolean } = {}): void {
  store.workspaces.clear()
  store.workspaces.set(WORKSPACE_FIXTURE.id, { ...WORKSPACE_FIXTURE })

  store.agent_configs.clear()
  store.agent_configs.set(AGENT_CONFIG_FIXTURE.workspace_id, { ...AGENT_CONFIG_FIXTURE })

  store.flows.clear()
  store.flows.set(FLOW_FIXTURE.id, { ...FLOW_FIXTURE })

  store.nodes.clear()
  store.nodes.set(FLOW_FIXTURE.id, [...NODES_FIXTURE])

  store.tool_policies.clear()
  store.tool_policies.set(FLOW_FIXTURE.id, opts.withTools
    ? [
        { flow_id: FLOW_FIXTURE.id, tool_id: 'buscar_horarios', allowed: true, created_at: '2026-05-07T12:00:00.000Z' },
        { flow_id: FLOW_FIXTURE.id, tool_id: 'criar_agendamento', allowed: true, created_at: '2026-05-07T12:00:00.000Z' },
      ]
    : [])

  store.clients.clear()
  store.clients_by_phone.clear()
  store.clients.set(CLIENT_FIXTURE.id, { ...CLIENT_FIXTURE })
  store.clients_by_phone.set(`${CLIENT_FIXTURE.workspace_id}|${CLIENT_FIXTURE.phone}`, {
    ...CLIENT_FIXTURE,
  })

  store.sessions.clear()
  store.sessions.set(SESSION_FIXTURE.id, { ...SESSION_FIXTURE })

  store.messages.clear()
  store.messages.set(SESSION_FIXTURE.id, [])

  store.catalog = PRODUCTS_FIXTURE.map((p) => ({ ...p }))
  store.audit_events.length = 0
  store.crm_events.length = 0
  store.monitor_decisions.length = 0
  store.cost_cap = { current_usd: 0, cap_usd: 100, percentage: 0 }
  store.rate_limit_count = 0
  store.idempotency.clear()
  store.followup_timers.length = 0
  counter = 1
}

// ============================================================
// Factories — cada função cria o "module mock" para uso em jest.mock(...).
// ============================================================

export function makeWorkspacesMock() {
  return {
    getWorkspace: async (id: string) => store.workspaces.get(id) ?? null,
    getWorkspaceBySlug: async (slug: string) => {
      for (const w of store.workspaces.values()) if (w.slug === slug) return w
      return null
    },
    getAgentConfig: async (workspace_id: string) =>
      store.agent_configs.get(workspace_id) ?? null,
  }
}

export function makeFlowsMock() {
  return {
    getActiveFlow: async (workspace_id: string) => {
      for (const f of store.flows.values()) {
        if (f.workspace_id === workspace_id && f.status === 'active' && f.is_default) return f
      }
      return null
    },
    getFlow: async (flow_id: string) => store.flows.get(flow_id) ?? null,
    getFlowAtVersion: async (flow_id: string, _version: number) =>
      store.flows.get(flow_id) ?? null,
    getFlowForSession: async (session: { flow_id: string | null }) =>
      session.flow_id ? store.flows.get(session.flow_id) ?? null : null,
    getFlowNodes: async (flow_id: string) => store.nodes.get(flow_id) ?? [],
    getFlowEdges: async (_flow_id: string) => [],
    getNodeTags: async (_node_id: string) => [],
    getFlowToolPolicies: async (flow_id: string) =>
      store.tool_policies.get(flow_id) ?? [],
  }
}

export function makeSessionsMock() {
  return {
    getSession: async (id: string) => store.sessions.get(id) ?? null,
    getActiveSession: async (
      workspace_id: string,
      client_id: string,
      channel: string,
    ) => {
      for (const s of store.sessions.values()) {
        if (
          s.workspace_id === workspace_id
          && s.client_id === client_id
          && s.channel === channel
          && (s.status === 'active' || s.status === 'waiting')
        ) {
          return s
        }
      }
      return null
    },
    createSession: async (input: {
      workspace_id: string
      client_id: string
      flow_id: string | null
      flow_version: number | null
      current_node_id: string | null
      channel: string
      current_trace_id?: string | null
    }) => {
      const id = newId('ss')
      const s: Session = {
        id,
        workspace_id: input.workspace_id,
        client_id: input.client_id,
        flow_id: input.flow_id,
        flow_version: input.flow_version,
        current_node_id: input.current_node_id,
        channel: input.channel,
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
        current_trace_id: input.current_trace_id ?? null,
        memory_processed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      store.sessions.set(id, s)
      store.messages.set(id, [])
      return s
    },
    updateSession: async (id: string, partial: Partial<Session>) => {
      const cur = store.sessions.get(id)
      if (!cur) throw new Error(`mock updateSession: session ${id} not found`)
      const next = { ...cur, ...partial, updated_at: new Date().toISOString() } as Session
      store.sessions.set(id, next)
      return next
    },
    expireSession: async (id: string) => {
      const cur = store.sessions.get(id)
      if (cur) store.sessions.set(id, { ...cur, status: 'expired' })
    },
    incrementReplanCount: async (id: string) => {
      const s = store.sessions.get(id)
      if (!s) throw new Error(`mock incrementReplanCount: session ${id} not found`)
      const next = (s.replan_count ?? 0) + 1
      store.sessions.set(id, { ...s, replan_count: next })
      return next
    },
    getReplanCount: async (id: string) => store.sessions.get(id)?.replan_count ?? 0,
  }
}

export function makeMessagesMock() {
  return {
    saveMessage: async (
      session_id: string,
      role: 'user' | 'assistant',
      content: string,
      opts: { workspace_id: string; client_id?: string | null; node_id?: string | null; trace_id?: string | null; channel_message_id?: string | null; media_type?: string; media_url?: string | null; media_transcription?: string | null; tokens_used?: number | null; llm_model?: string | null },
    ) => {
      const m: Message = {
        id: newId('msg'),
        session_id,
        workspace_id: opts.workspace_id,
        client_id: opts.client_id ?? null,
        role,
        content,
        media_type: (opts.media_type as Message['media_type']) ?? 'text',
        media_url: opts.media_url ?? null,
        media_transcription: opts.media_transcription ?? null,
        node_id: opts.node_id ?? null,
        trace_id: opts.trace_id ?? null,
        tokens_used: opts.tokens_used ?? null,
        llm_model: opts.llm_model ?? null,
        channel_message_id: opts.channel_message_id ?? null,
        created_at: new Date().toISOString(),
      }
      const list = store.messages.get(session_id) ?? []
      list.push(m)
      store.messages.set(session_id, list)
      return m
    },
    getHistory: async (session_id: string, limit: number | null = 20) => {
      const list = store.messages.get(session_id) ?? []
      if (limit === null) return list
      return list.slice(-limit)
    },
  }
}

export function makeClientsMock() {
  return {
    findClientByPhone: async (workspace_id: string, phone: string) =>
      store.clients_by_phone.get(`${workspace_id}|${phone}`) ?? null,
    findClientBySecondaryPhone: async (_workspace_id: string, _phone: string) => null,
    findClientByEmail: async (_workspace_id: string, _email: string) => null,
    getClient: async (id: string) => store.clients.get(id) ?? null,
    getOrCreateClient: async (workspace_id: string, phone: string) => {
      const existing = store.clients_by_phone.get(`${workspace_id}|${phone}`)
      if (existing) return existing
      const c: Client = {
        id: newId('cl'),
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
      store.clients.set(c.id, c)
      store.clients_by_phone.set(`${workspace_id}|${phone}`, c)
      return c
    },
    updateClient: async (id: string, partial: Partial<Client>) => {
      const cur = store.clients.get(id)
      if (!cur) throw new Error(`mock updateClient: ${id} not found`)
      const next = { ...cur, ...partial }
      store.clients.set(id, next)
      return next
    },
  }
}

export function makeAuditMock() {
  return {
    logAudit: async (event_type: string, payload: Record<string, unknown>) => {
      store.audit_events.push({ event_type, payload })
    },
  }
}

export function makeCrmEventsMock() {
  return {
    emitEvent: async (type: string, payload: Record<string, unknown>) => {
      store.crm_events.push({ type, payload })
    },
  }
}

export function makeMonitorDecisionsMock() {
  return {
    recordMonitorDecision: async (decision: Record<string, unknown>) => {
      store.monitor_decisions.push(decision)
    },
  }
}

export function makeIdempotencyMock() {
  return {
    getIdempotencyKey: async (key: string) => store.idempotency.get(key) ?? null,
    createIdempotencyKey: async (key: string, workspace_id: string | null, _ttl: number) => {
      if (store.idempotency.has(key)) {
        const err = new Error('duplicate key value violates unique constraint (23505)')
        ;(err as unknown as { code: string }).code = '23505'
        throw err
      }
      const row: IdempotencyRow = {
        key,
        workspace_id,
        result: null,
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      }
      store.idempotency.set(key, row)
      return row
    },
    updateIdempotencyResult: async (key: string, result: unknown) => {
      const cur = store.idempotency.get(key)
      if (cur) store.idempotency.set(key, { ...cur, result })
    },
    deleteIdempotencyKey: async (key: string) => {
      store.idempotency.delete(key)
    },
    cleanupExpired: async (_cutoff: string) => 0,
  }
}

export function makeRateLimitsMock() {
  return {
    incrementBucket: async () => {
      store.rate_limit_count += 1
      return store.rate_limit_count
    },
    getBucketState: async () => null,
    resetExpiredBuckets: async () => 0,
  }
}

export function makeCostCapsMock() {
  return {
    getCostCap: async () => null,
    recordUsage: async () => undefined,
    checkCapStatus: async () => ({
      current_usd: store.cost_cap.current_usd,
      cap_usd: store.cost_cap.cap_usd,
      percentage: store.cost_cap.percentage,
      status:
        store.cost_cap.percentage >= 1
          ? ('blocked' as const)
          : store.cost_cap.percentage >= 0.8
          ? ('warning' as const)
          : ('ok' as const),
    }),
  }
}

export function makeFollowupTimersMock() {
  return {
    createTimer: async (input: {
      session_id: string
      workspace_id: string
      client_id?: string | null
      target_node_id?: string | null
      scheduled_at: string
    }) => {
      const t: FollowupTimerRow = {
        id: newId('ft'),
        session_id: input.session_id,
        workspace_id: input.workspace_id,
        client_id: input.client_id ?? null,
        target_node_id: input.target_node_id ?? null,
        scheduled_at: input.scheduled_at,
        status: 'pending',
        created_at: new Date().toISOString(),
      }
      store.followup_timers.push(t)
      return t
    },
    getPendingTimers: async (_limit?: number) =>
      store.followup_timers.filter((t) => t.status === 'pending'),
    getTimer: async (id: string) => store.followup_timers.find((t) => t.id === id) ?? null,
    markTimerFired: async (id: string) => {
      const t = store.followup_timers.find((x) => x.id === id)
      if (t) t.status = 'fired'
    },
    cancelTimersBySession: async (session_id: string) => {
      for (const t of store.followup_timers) {
        if (t.session_id === session_id && t.status === 'pending') t.status = 'cancelled'
      }
    },
  }
}
