// lib/tools/executor.ts — Pipeline de execução de tools com 3 hard guardrails.
// SPEC §3.3 (tool_call), §14.1 (tool authorization), §14.5 (circuit breaker).
//
// Ordem (NÃO alterar):
//   1. Resolver definição em tools_registry
//   2. Hard Guardrail 1 — Authorization (allowlist por flow)
//   3. Hard Guardrail 2 — Validation (params_schema via ajv)
//   3. Hard Guardrail 3 — Circuit Breaker (per-tool, per-workspace)
//   4. Resolver handler estático e executar com timeout
//   5. Sucesso → reset breaker + audit; Falha → record breaker + audit + re-throw

import { logAudit } from '@/lib/db/audit'
import {
  checkToolBreaker,
  recordToolFailure,
  resetToolBreaker,
} from '@/lib/guardrails/circuit-breaker'
import {
  CircuitBreakerOpenError,
  InvalidParamsError,
  ToolNotAuthorizedError,
  type ToolExecutionContext,
  type ToolExecutionResult,
} from '@/types/tools'
import { isToolAllowedInFlow } from './authorization'
import { TOOL_HANDLERS } from './handlers'
import { getToolDefinition } from './registry'
import { validateParams } from './validator'

const DEFAULT_TIMEOUT_MS = 30000

export type { ToolExecutionContext } from '@/types/tools'

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('tool timeout')), ms)
  })
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  }) as Promise<T>
}

function auditCtx(ctx: ToolExecutionContext) {
  return {
    workspace_id: ctx.workspace_id,
    session_id: ctx.session_id,
    trace_id: ctx.trace_id ?? null,
  }
}

export async function executeTool<T = unknown>(
  tool_id: string,
  params: unknown,
  ctx: ToolExecutionContext,
): Promise<ToolExecutionResult<T>> {
  if (!tool_id) throw new Error('executeTool: tool_id is required')
  if (!ctx || !ctx.workspace_id || !ctx.session_id) {
    throw new Error('executeTool: ctx.workspace_id and ctx.session_id are required')
  }

  // 1) Definição
  const tool = await getToolDefinition(tool_id)
  if (!tool) {
    throw new Error(`tool not found: ${tool_id}`)
  }

  // 2) Hard Guardrail — Authorization (default deny quando há flow)
  if (ctx.flow_id) {
    const authorized = await isToolAllowedInFlow(ctx.flow_id, tool_id)
    if (!authorized) {
      void logAudit(
        'guardrail.tool_denied',
        { tool_id, flow_id: ctx.flow_id, reason: 'not_in_allowlist' },
        auditCtx(ctx),
      )
      throw new ToolNotAuthorizedError(tool_id)
    }
  }

  // 3a) Hard Guardrail — Validation
  const v = validateParams(tool_id, tool.params_schema, params)
  if (!v.valid) {
    throw new InvalidParamsError(v.errors)
  }

  // 3b) Hard Guardrail — Circuit Breaker
  const breaker = checkToolBreaker(tool_id, ctx.workspace_id)
  if (!breaker.allowed) {
    throw new CircuitBreakerOpenError(tool_id)
  }

  // 4) Handler
  const handler = TOOL_HANDLERS[tool_id]
  if (!handler) {
    throw new Error(`no handler registered for tool: ${tool_id}`)
  }

  // 5) Execução com timeout
  const timeoutMs = tool.timeout_ms ?? DEFAULT_TIMEOUT_MS
  const start = Date.now()
  try {
    const result = (await withTimeout(handler(params, ctx), timeoutMs)) as T
    const duration_ms = Date.now() - start

    resetToolBreaker(tool_id, ctx.workspace_id)
    if (tool.audit_log) {
      void logAudit('tool.executed', { tool_id, duration_ms }, auditCtx(ctx))
    }
    return { success: true, result, duration_ms }
  } catch (e) {
    const duration_ms = Date.now() - start
    const message = e instanceof Error ? e.message : String(e)
    recordToolFailure(tool_id, ctx.workspace_id)
    if (tool.audit_log) {
      void logAudit('tool.failed', { tool_id, duration_ms, error: message }, auditCtx(ctx))
    }
    throw e
  }
}
