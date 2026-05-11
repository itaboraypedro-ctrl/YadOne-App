// types/tools.ts — Tool definitions, executor results, errors

export type ToolCategory = 'scheduling' | 'payment' | 'crm' | 'external_api'

export type JSONSchema = Record<string, unknown>

export interface ToolDefinition {
  id: string
  tool_id: string
  name: string
  description: string
  category: ToolCategory
  params_schema: JSONSchema
  returns_schema: JSONSchema
  requires_confirmation: boolean
  is_active: boolean
  rate_limit_per_minute: number
  timeout_ms: number
  audit_log: boolean
  created_at: string // ISO 8601
}

export interface ToolExecutionContext {
  workspace_id: string
  session_id: string
  flow_id: string | null
  trace_id?: string
}

export interface ToolExecutionResult<T = unknown> {
  success: boolean
  result?: T
  error?: string
  duration_ms?: number
}

export interface AvailableTools {
  buscar_horarios_livres: {
    params: { workspace_id: string; servico_id: string; data?: string }
    returns: { slots: string[] }
  }
  criar_agendamento: {
    params: {
      workspace_id: string
      cliente_id: string
      servico_id: string
      horario: string // ISO 8601
    }
    returns: { agendamento_id: string; confirmacao: string }
  }
  cancelar_agendamento: {
    params: { agendamento_id: string }
    returns: { success: boolean }
  }
  buscar_historico_cliente: {
    params: { workspace_id: string; telefone: string }
    returns: {
      agendamentos: Array<Record<string, unknown>>
      total_visitas: number
      ultimo_servico: string | null
    }
  }
  registrar_ou_atualizar_cliente: {
    params: { workspace_id: string; dados: Record<string, unknown> }
    returns: { cliente_id: string }
  }
}

export type ToolName = keyof AvailableTools

export class ToolNotAuthorizedError extends Error {
  readonly tool_id: string
  constructor(tool_id: string, message?: string) {
    super(message ?? `Tool not authorized for current flow: ${tool_id}`)
    this.name = 'ToolNotAuthorizedError'
    this.tool_id = tool_id
  }
}

export class InvalidParamsError extends Error {
  readonly errors: string[]
  constructor(errors: string[], message?: string) {
    super(message ?? `Invalid tool params: ${errors.join('; ')}`)
    this.name = 'InvalidParamsError'
    this.errors = errors
  }
}

export class CircuitBreakerOpenError extends Error {
  readonly service: string
  constructor(service: string, message?: string) {
    super(message ?? `Circuit breaker open for ${service}`)
    this.name = 'CircuitBreakerOpenError'
    this.service = service
  }
}
