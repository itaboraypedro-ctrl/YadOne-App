// lib/guardrails/leak-detector.ts — Detecta vazamento de IDs e telefones na resposta.
// SPEC §14.8.
// detectLeaks(text, ctx) → LeakResult
// Nunca throws — retorna has_leak:false em falha interna.

import { logAudit } from '@/lib/db/audit'
import type { LeakResult } from '@/types/guardrails'

/** UUID completo (RFC 4122). */
const UUID_FULL_REGEX = /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi

/**
 * Regex para telefones: formatos internacionais e locais comuns.
 * Captura sequências numéricas de 8-15 dígitos possivelmente separadas por -, (, ), +.
 */
const PHONE_REGEX = /(?:\+?\d[\d\s\-().]{6,}\d)/g

export interface LeakContext {
  workspace_id?: string | null
  session_id?: string | null
  client_id?: string | null
  /** Telefone do cliente autorizado — aparições deste número NÃO são leak. */
  client_phone?: string | null
  trace_id?: string | null
}

/** Remove formatação do telefone para comparação normalizada. */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().+]/g, '')
}

/** Extrai todos os UUIDs de um texto. */
function extractUUIDs(text: string): string[] {
  const matches: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(UUID_FULL_REGEX.source, 'gi')
  while ((m = re.exec(text)) !== null) {
    matches.push(m[1].toLowerCase())
  }
  return matches
}

/** Extrai todos os candidatos a telefone de um texto. */
function extractPhones(text: string): string[] {
  const raw = text.match(PHONE_REGEX) ?? []
  // Filtra falsos positivos: precisa de ao menos 8 dígitos
  return raw
    .map(normalizePhone)
    .filter((p) => p.length >= 8)
}

/**
 * Detecta vazamento de IDs internos ou telefones não autorizados no texto de resposta.
 *
 * UUIDs autorizados: workspace_id, session_id, client_id do contexto.
 * Telefones autorizados: client_phone do contexto (normalizado).
 * Qualquer outro UUID completo ou telefone externo → leak.
 *
 * Em leak, registra audit severity 'critical' e retorna has_leak:true.
 */
export async function detectLeaks(
  text: string,
  ctx: LeakContext = {},
): Promise<LeakResult> {
  try {
    // IDs autorizados (lower-cased para comparação uniforme)
    const authorizedIds = new Set<string>(
      [ctx.workspace_id, ctx.session_id, ctx.client_id]
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .map((id) => id.toLowerCase()),
    )

    // Telefone autorizado normalizado
    const authorizedPhone = ctx.client_phone ? normalizePhone(ctx.client_phone) : null

    // Detectar UUIDs
    const foundUUIDs = extractUUIDs(text)
    const leaked_ids = foundUUIDs.filter((id) => !authorizedIds.has(id))

    // Detectar telefones
    const foundPhones = extractPhones(text)
    const leaked_phones = foundPhones.filter((p) => {
      if (!authorizedPhone) return true
      return !p.includes(authorizedPhone) && !authorizedPhone.includes(p)
    })

    const has_leak = leaked_ids.length > 0 || leaked_phones.length > 0

    if (has_leak) {
      await logAudit(
        'guardrail.leak_detected',
        {
          leaked_ids,
          leaked_phones,
          severity: 'critical',
          ctx,
        },
        {
          workspace_id: ctx.workspace_id ?? undefined,
          session_id: ctx.session_id ?? undefined,
          client_id: ctx.client_id ?? undefined,
          trace_id: ctx.trace_id ?? undefined,
        },
      )
    }

    return { has_leak, leaked_ids, leaked_phones }
  } catch (e) {
    console.error('[guardrails/leak-detector] unexpected error', (e as Error).message)
    return { has_leak: false, leaked_ids: [], leaked_phones: [] }
  }
}
