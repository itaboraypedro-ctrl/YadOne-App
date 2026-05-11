// tests/fixtures/workspace.ts — Fixtures determinísticos para testes de integração do motor.

import type { Workspace, WorkspaceAgentConfig } from '@/types/workspace'
import type { Client } from '@/types/client'
import type { Session } from '@/types/session'
import type { Flow, FlowNode, StepNode } from '@/types/flow'
import type { CatalogProduct } from '@/lib/engine/context-builder'
import type { InboundMessage } from '@/types/message'

const NOW = '2026-05-07T12:00:00.000Z'

export const WORKSPACE_ID = 'ws_00000000-0000-0000-0000-000000000001'
export const CLIENT_ID = 'cl_00000000-0000-0000-0000-000000000001'
export const SESSION_ID = 'ss_00000000-0000-0000-0000-000000000001'
export const FLOW_ID = 'fl_00000000-0000-0000-0000-000000000001'
export const STEP_NODE_ID = 'nd_00000000-0000-0000-0000-000000000001'
export const HANDOFF_NODE_ID = 'nd_00000000-0000-0000-0000-000000000002'
export const WAIT_NODE_ID = 'nd_00000000-0000-0000-0000-000000000003'

export const WORKSPACE_FIXTURE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Yadone Test Workspace',
  slug: 'yadone-test',
  segment: 'beauty',
  plan: 'pro',
  status: 'active',
  created_at: NOW,
}

export const AGENT_CONFIG_FIXTURE: WorkspaceAgentConfig = {
  id: 'ac_00000000-0000-0000-0000-000000000001',
  workspace_id: WORKSPACE_ID,
  persona_name: 'Yadone Bot',
  persona_tone: 'amigável e direto',
  persona_rules: 'Não invente preços. Sempre confirme datas.',
  response_length: 'short',
  emoji_usage: false,
  tratamento: 'você',
  business_info: 'Salão Yadone — beleza e bem-estar.',
  updated_at: NOW,
}

export const FLOW_FIXTURE: Flow = {
  id: FLOW_ID,
  workspace_id: WORKSPACE_ID,
  name: 'Fluxo de Agendamento',
  description: 'Agendamento padrão',
  trigger_keywords: ['agendar', 'horário'],
  trigger_products: null,
  status: 'active',
  is_default: true,
  version: 1,
  parent_version_id: null,
  created_at: NOW,
  updated_at: NOW,
}

export const STEP_NODE_FIXTURE: StepNode = {
  id: STEP_NODE_ID,
  flow_id: FLOW_ID,
  type: 'step',
  label: 'Acolhimento',
  position_x: 0,
  position_y: 0,
  created_at: NOW,
  config: {
    objective: 'Coletar nome e horário desejado para agendamento',
    knowledge_tags: ['agendamento'],
    awaits_response: true,
    allow_digression: true,
    context_window: {
      include_client_memory: true,
      message_history_limit: 10,
      include_full_catalog: false,
    },
    llm_config: {
      model: 'claude-sonnet',
      temperature: 0.7,
    },
  },
}

export const NODES_FIXTURE: FlowNode[] = [STEP_NODE_FIXTURE]

export const PRODUCTS_FIXTURE: CatalogProduct[] = [
  {
    id: 'pr_001',
    workspace_id: WORKSPACE_ID,
    name: 'Corte Feminino',
    description: 'Corte completo com lavagem',
    price: 80,
    duration_minutes: 60,
    category: 'cabelo',
    is_active: true,
    created_at: NOW,
  },
  {
    id: 'pr_002',
    workspace_id: WORKSPACE_ID,
    name: 'Manicure',
    description: 'Manicure tradicional',
    price: 35,
    duration_minutes: 30,
    category: 'unhas',
    is_active: true,
    created_at: NOW,
  },
  {
    id: 'pr_003',
    workspace_id: WORKSPACE_ID,
    name: 'Hidratação',
    description: 'Hidratação profunda capilar',
    price: 60,
    duration_minutes: 45,
    category: 'cabelo',
    is_active: true,
    created_at: NOW,
  },
]

export const CLIENT_FIXTURE: Client = {
  id: CLIENT_ID,
  workspace_id: WORKSPACE_ID,
  phone: '+5511999990000',
  name: 'Cliente Teste',
  email: null,
  notes: null,
  crm_status: 'new',
  crm_tags: null,
  unified_id: null,
  secondary_phones: [],
  created_at: NOW,
  updated_at: NOW,
}

export const SESSION_FIXTURE: Session = {
  id: SESSION_ID,
  workspace_id: WORKSPACE_ID,
  client_id: CLIENT_ID,
  flow_id: FLOW_ID,
  flow_version: 1,
  current_node_id: STEP_NODE_ID,
  channel: 'whatsapp_test',
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
  created_at: NOW,
  updated_at: NOW,
}

export function INBOUND_TEXT(content: string, channel_message_id?: string): InboundMessage {
  return {
    from: CLIENT_FIXTURE.phone,
    content,
    media_type: 'text',
    timestamp: NOW,
    channel_message_id: channel_message_id ?? `msg_${Math.random().toString(36).slice(2, 8)}`,
  }
}
