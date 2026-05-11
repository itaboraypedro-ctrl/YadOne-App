// lib/guardrails/output-validator.ts — Validação do output antes de entregar ao cliente.
// SPEC §14.2, §14.8.
// validateOutput(text, ctx) → ValidationResult
// Nunca throws — retorna resultado mesmo em falha interna.

import { logAudit } from '@/lib/db/audit'
import type { ValidationResult } from '@/types/guardrails'

const MAX_CHARS = 4096
const MIN_CHARS = 1

/** Regex para detectar UUIDs completos ou parciais (primeiros dois grupos). */
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-/i

/** Termos técnicos internos que não devem aparecer na resposta ao cliente. */
const INTERNAL_TERMS: string[] = ['node_id', 'session_id', 'workspace_id', 'flow_version', 'trace_id']

export interface ValidatorContext {
  workspace_id?: string | null
  session_id?: string | null
  client_id?: string | null
  trace_id?: string | null
}

/**
 * Valida o texto de resposta do motor antes de ser enviado ao cliente WhatsApp.
 *
 * - Tamanho máximo 4096 chars (limite WhatsApp): trunca em 4093 + "..."
 * - Tamanho mínimo 1 char: retorna re_plan
 * - UUID detectado no texto: retorna re_plan + audit
 * - Termos técnicos internos no texto: retorna re_plan + audit
 */
export async function validateOutput(
  text: string,
  ctx: ValidatorContext = {},
): Promise<ValidationResult> {
  try {
    const violations: string[] = []

    // 1. Tamanho mínimo
    if (text.length < MIN_CHARS) {
      await logAudit(
        'guardrail.output_validator_failed',
        {
          violations: ['size_min'],
          response_length: text.length,
          ctx,
        },
        {
          workspace_id: ctx.workspace_id ?? undefined,
          session_id: ctx.session_id ?? undefined,
          client_id: ctx.client_id ?? undefined,
          trace_id: ctx.trace_id ?? undefined,
        },
      )
      return { valid: false, action: 're_plan', violations: ['size_min'] }
    }

    // 2. Tamanho máximo — truncamento não é falha fatal
    if (text.length > MAX_CHARS) {
      const sanitized_text = text.slice(0, 4093) + '...'
      void logAudit(
        'guardrail.output_validator_failed',
        {
          violations: ['size_exceeded'],
          response_length: text.length,
          ctx,
        },
        {
          workspace_id: ctx.workspace_id ?? undefined,
          session_id: ctx.session_id ?? undefined,
          client_id: ctx.client_id ?? undefined,
          trace_id: ctx.trace_id ?? undefined,
        },
      )
      return { valid: true, action: 'truncate', sanitized_text, violations: ['size_exceeded'] }
    }

    // 3. UUID interno na resposta
    if (UUID_REGEX.test(text)) {
      violations.push('internal_uuid_leak')
    }

    // 4. Termos técnicos internos
    const lowerText = text.toLowerCase()
    for (const term of INTERNAL_TERMS) {
      if (lowerText.includes(term.toLowerCase())) {
        violations.push(`internal_term:${term}`)
      }
    }

    if (violations.length > 0) {
      await logAudit(
        'guardrail.output_validator_failed',
        {
          violations,
          response_length: text.length,
          ctx,
        },
        {
          workspace_id: ctx.workspace_id ?? undefined,
          session_id: ctx.session_id ?? undefined,
          client_id: ctx.client_id ?? undefined,
          trace_id: ctx.trace_id ?? undefined,
        },
      )
      return { valid: false, action: 're_plan', violations }
    }

    return { valid: true, action: 'continue', violations: [] }
  } catch (e) {
    console.error('[guardrails/output-validator] unexpected error', (e as Error).message)
    return { valid: true, action: 'continue', violations: [] }
  }
}
