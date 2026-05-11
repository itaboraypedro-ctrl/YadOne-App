// types/workspace.ts — Workspaces, configuração do agente, cost cap

export type WorkspacePlan = 'trial' | 'pro' | 'enterprise'
export type WorkspaceStatus = 'active' | 'paused' | 'blocked_cost_cap' | 'archived'

export interface Workspace {
  id: string
  name: string
  slug: string
  segment: string | null
  plan: WorkspacePlan
  status: WorkspaceStatus
  created_at: string // ISO 8601
}

export type ResponseLength = 'short' | 'medium' | 'long'
export type Tratamento = 'você' | 'tu' | 'senhor' | 'senhora'

export interface WorkspaceAgentConfig {
  id: string
  workspace_id: string
  persona_name: string
  persona_tone: string
  persona_rules: string | null
  response_length: ResponseLength
  emoji_usage: boolean
  tratamento: Tratamento
  business_info: string | null
  updated_at: string // ISO 8601
}

export type CostCapStatusValue = 'ok' | 'warning' | 'blocked'

export interface WorkspaceCostCap {
  id: string
  workspace_id: string
  monthly_cap_usd: number
  current_month_usd: number
  last_reset: string // ISO 8601
  status: CostCapStatusValue
  warning_threshold: number
  created_at: string // ISO 8601
}
