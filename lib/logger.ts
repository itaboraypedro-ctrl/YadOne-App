// lib/logger.ts — Logger estruturado com sanitização automática (T25).
//
// Objetivo: emitir logs JSON em produção (consumíveis por agregadores tipo
// Vercel/Datadog/Loki) e logs legíveis em dev. Centraliza redaction de PII
// (telefones via SHA-256), truncamento de conteúdo de mensagens e remoção
// de credenciais.
//
// API:
//   logger.debug(event, data?)
//   logger.info(event, data?)
//   logger.warn(event, data?)
//   logger.error(event, data?)
//
// Cada chamada emite { ts, level, event, ...sanitizedData }.

import { createHash } from 'crypto'

type Level = 'debug' | 'info' | 'warn' | 'error'

const PHONE_KEYS = new Set(['phone', 'phone_number'])
const TRUNCATE_KEYS = new Set(['content', 'message', 'text'])
const REDACT_KEYS = new Set(['credentials', 'api_key', 'token', 'password', 'secret'])

const TRUNCATE_LIMIT = 80

/**
 * Hash determinístico de telefone para preservar joinability sem expor PII.
 * Prefixo `phone_` facilita identificação visual nos logs.
 */
function hashPhone(phone: string): string {
  return 'phone_' + createHash('sha256').update(phone).digest('hex').slice(0, 16)
}

function truncateString(s: string): string {
  if (s.length <= TRUNCATE_LIMIT) return s
  return s.slice(0, TRUNCATE_LIMIT) + '...'
}

/**
 * Sanitiza recursivamente um valor:
 * - chaves em PHONE_KEYS viram hash SHA-256 (se string)
 * - chaves em TRUNCATE_KEYS truncam strings em 80 chars
 * - chaves em REDACT_KEYS viram '[REDACTED]'
 * - objetos/arrays são percorridos recursivamente
 */
function sanitize(value: unknown, key?: string): unknown {
  if (key !== undefined) {
    const lower = key.toLowerCase()
    if (REDACT_KEYS.has(lower)) {
      return '[REDACTED]'
    }
    if (PHONE_KEYS.has(lower) && typeof value === 'string') {
      return hashPhone(value)
    }
    if (TRUNCATE_KEYS.has(lower) && typeof value === 'string') {
      return truncateString(value)
    }
  }

  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item))
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = sanitize(v, k)
  }
  return out
}

function sanitizePayload(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {}
  const sanitized = sanitize(data) as Record<string, unknown>
  return sanitized
}

function emit(level: Level, event: string, data?: Record<string, unknown>): void {
  const ts = new Date().toISOString()
  const sanitized = sanitizePayload(data)
  const isProd = process.env.NODE_ENV === 'production'

  if (isProd) {
    // JSON line — fácil de ingerir por agregadores.
    const line = JSON.stringify({ ts, level, event, ...sanitized })
    writeToConsole(level, line)
    return
  }

  // Dev: formato legível.
  const padLevel = level.toUpperCase().padEnd(5, ' ')
  const dataStr =
    Object.keys(sanitized).length > 0 ? ' ' + JSON.stringify(sanitized, null, 2) : ''
  writeToConsole(level, `[${ts}] ${padLevel} ${event}${dataStr}`)
}

function writeToConsole(level: Level, line: string): void {
  switch (level) {
    case 'debug':
      console.debug(line)
      return
    case 'info':
      console.info(line)
      return
    case 'warn':
      console.warn(line)
      return
    case 'error':
      console.error(line)
      return
  }
}

export const logger = {
  debug(event: string, data?: Record<string, unknown>): void {
    emit('debug', event, data)
  },
  info(event: string, data?: Record<string, unknown>): void {
    emit('info', event, data)
  },
  warn(event: string, data?: Record<string, unknown>): void {
    emit('warn', event, data)
  },
  error(event: string, data?: Record<string, unknown>): void {
    emit('error', event, data)
  },
}
