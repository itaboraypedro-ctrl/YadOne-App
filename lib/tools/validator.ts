// lib/tools/validator.ts — Validação de params da tool contra params_schema (JSON Schema).
// Hard Guardrail #2 do executor (SPEC §3.3).
//
// Decisão MVP: ajv com strict=false para tolerar schemas com keywords não-padrão
// (ex: `examples`, descritivos) que possam vir do registry. Cache interno do Ajv
// reaproveita schemas compilados quando a mesma instância é usada.

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv'
import type { JSONSchema } from '@/types/tools'

const ajv = new Ajv({ strict: false, allErrors: true })

// Cache local por tool_id para evitar re-compilar o mesmo schema todas as chamadas.
const compiledByToolId: Map<string, ValidateFunction> = new Map()

export type ValidationResult = { valid: true } | { valid: false; errors: string[] }

function formatError(err: ErrorObject): string {
  const path = err.instancePath || '(root)'
  return `${path}: ${err.message ?? 'invalid'}`
}

export function validateParams(
  tool_id: string,
  schema: JSONSchema,
  params: unknown,
): ValidationResult {
  let validator = compiledByToolId.get(tool_id)
  if (!validator) {
    try {
      validator = ajv.compile(schema)
    } catch (e) {
      return {
        valid: false,
        errors: [`schema compile failed: ${(e as Error).message}`],
      }
    }
    compiledByToolId.set(tool_id, validator)
  }

  const ok = validator(params)
  if (ok) return { valid: true }

  const errors = (validator.errors ?? []).map(formatError)
  return { valid: false, errors: errors.length > 0 ? errors : ['unknown validation error'] }
}

/**
 * Helper de testes — limpa cache de validators (não usar em runtime).
 */
export function __clearValidatorCache(): void {
  compiledByToolId.clear()
}
