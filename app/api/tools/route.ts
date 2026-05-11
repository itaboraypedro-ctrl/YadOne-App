// app/api/tools/route.ts
// ⚠️ Endpoint só para testes manuais do executor de tools (T11).
// NÃO usar em produção: não autentica requests, não valida workspace ownership do ctx.
// O motor real (T17) chama `executeTool` diretamente, sem passar por HTTP.

import { NextRequest, NextResponse } from 'next/server'
import { executeTool, type ToolExecutionContext } from '@/lib/tools/executor'
import {
  CircuitBreakerOpenError,
  InvalidParamsError,
  ToolNotAuthorizedError,
} from '@/types/tools'

interface RequestBody {
  tool_id: string
  params: unknown
  ctx: ToolExecutionContext
}

function isBody(b: unknown): b is RequestBody {
  if (typeof b !== 'object' || b === null) return false
  const o = b as RequestBody
  if (typeof o.tool_id !== 'string') return false
  if (typeof o.ctx !== 'object' || o.ctx === null) return false
  if (typeof o.ctx.workspace_id !== 'string') return false
  if (typeof o.ctx.session_id !== 'string') return false
  return true
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!isBody(body)) {
    return NextResponse.json(
      { error: 'body must include tool_id (string), params, ctx{workspace_id, session_id}' },
      { status: 400 },
    )
  }

  try {
    const result = await executeTool(body.tool_id, body.params, body.ctx)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof ToolNotAuthorizedError) {
      return NextResponse.json(
        { error: 'tool_not_authorized', tool_id: e.tool_id, message: e.message },
        { status: 403 },
      )
    }
    if (e instanceof InvalidParamsError) {
      return NextResponse.json(
        { error: 'invalid_params', errors: e.errors, message: e.message },
        { status: 400 },
      )
    }
    if (e instanceof CircuitBreakerOpenError) {
      return NextResponse.json(
        { error: 'circuit_breaker_open', service: e.service, message: e.message },
        { status: 503 },
      )
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'tool_execution_failed', message }, { status: 500 })
  }
}
