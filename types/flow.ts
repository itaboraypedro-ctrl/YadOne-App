// types/flow.ts — Fluxos, nós (5 tipos via discriminated union), arestas, snapshots, policies

export type FlowStatus = 'draft' | 'active' | 'archived'

export interface Flow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  trigger_keywords: string[] | null
  trigger_products: string[] | null
  status: FlowStatus
  is_default: boolean
  version: number
  parent_version_id: string | null
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

export interface FlowSnapshot {
  id: string
  flow_id: string
  version: number
  snapshot: FlowSnapshotPayload
  created_by: string | null
  created_at: string // ISO 8601
}

export interface FlowSnapshotPayload {
  flow: Flow
  nodes: FlowNode[]
  edges: FlowEdge[]
  tags: NodeKnowledgeTag[]
  policies: FlowToolPolicy[]
}

export type NodeType = 'step' | 'condition' | 'tool_call' | 'wait' | 'handoff'

export interface FlowNodeBase {
  id: string
  flow_id: string
  type: NodeType
  label: string | null
  position_x: number | null
  position_y: number | null
  created_at: string // ISO 8601
}

export interface ContextWindowConfig {
  include_client_memory: boolean
  message_history_limit: number
  include_full_catalog: boolean
  knowledge_tags_limit?: number
  max_total_tokens?: number
}

export interface LlmConfig {
  model: 'claude-haiku' | 'claude-sonnet' | 'claude-opus'
  temperature: number
}

export interface StepNodeConfig {
  objective: string
  knowledge_tags: string[]
  awaits_response: boolean
  allow_digression: boolean
  context_window: ContextWindowConfig
  llm_config: LlmConfig
}

export interface StepNode extends FlowNodeBase {
  type: 'step'
  config: StepNodeConfig
}

export type ConditionOperator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'is_null' | 'regex'

export interface ConditionRule {
  operator: ConditionOperator
  value: string
  target_node_id: string
}

export interface ConditionNodeConfig {
  variable: string
  rules: ConditionRule[]
}

export interface ConditionNode extends FlowNodeBase {
  type: 'condition'
  config: ConditionNodeConfig
}

export interface ToolCallNodeConfig {
  tool_id: string
  param_mapping: Record<string, string>
  response_variable: string
  generate_response: boolean
  error_node_id?: string
}

export interface ToolCallNode extends FlowNodeBase {
  type: 'tool_call'
  config: ToolCallNodeConfig
}

export interface WaitNodeConfig {
  duration: { value: number; unit: 'minutes' | 'hours' | 'days' }
  advance_on_response: boolean
  timeout_node_id: string
  response_node_id?: string
  message_on_timeout?: string
}

export interface WaitNode extends FlowNodeBase {
  type: 'wait'
  config: WaitNodeConfig
}

export type HandoffNotifyChannel = 'whatsapp' | 'email' | 'webhook'

export interface HandoffNodeConfig {
  reason: string
  transition_message: string
  notify_channel: HandoffNotifyChannel
  notify_target: string
  include_conversation_summary: boolean
}

export interface HandoffNode extends FlowNodeBase {
  type: 'handoff'
  config: HandoffNodeConfig
}

export type FlowNode = StepNode | ConditionNode | ToolCallNode | WaitNode | HandoffNode

export interface FlowEdgeCondition {
  variable: string
  operator: ConditionOperator
  value: string
}

export interface FlowEdge {
  id: string
  flow_id: string
  source_node_id: string
  target_node_id: string
  label: string | null
  condition: FlowEdgeCondition | null
  is_default: boolean
  created_at: string // ISO 8601
}

export interface NodeKnowledgeTag {
  node_id: string
  knowledge_tag: string
}

export interface FlowToolPolicy {
  flow_id: string
  tool_id: string
  allowed: boolean
  created_at: string // ISO 8601
}
