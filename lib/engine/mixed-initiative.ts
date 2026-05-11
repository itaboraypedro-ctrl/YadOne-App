// lib/engine/mixed-initiative.ts — Sinais proativos baseados em memória + estado da sessão.
// Saída é texto pt-BR a ser injetado na Seção 7 do system prompt via
// `buildSystemPrompt(ctx, { extra_behavior_hints })`.
//
// Sem I/O — pura derivação a partir do PromptContext que o context-builder já hidratou.

import type { PromptContext } from './context-builder'

const STALE_VISIT_DAYS = 30

function daysBetween(from: string, to: Date): number | null {
  const t = Date.parse(from)
  if (Number.isNaN(t)) return null
  const ms = to.getTime() - t
  if (ms < 0) return null
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function lastServiceMention(memText: string): { service: string; iso: string } | null {
  // Heurística simples: o builder de memória usa formato "Última visita: ISO — serviço".
  const m = memText.match(/[ÚU]ltima visita:\s*(\d{4}-\d{2}-\d{2})[^—]*—\s*([^\n]+)/i)
  if (!m) return null
  return { iso: m[1], service: m[2].trim() }
}

function detectPreferences(memText: string): string[] {
  // O builder lista preferências em uma linha "Preferências: a, b, c".
  const m = memText.match(/Prefer[eê]ncias:\s*([^\n]+)/i)
  if (!m) return []
  return m[1]
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Gera o bloco de sinais contextuais (mixed-initiative) para esta interação.
 * Retorna string vazia quando não há sinais aproveitáveis — Executor então não
 * passa o opts.extra_behavior_hints para o prompt-builder.
 */
export function buildMixedInitiativeContext(ctx: PromptContext): string {
  const lines: string[] = []
  const memText = (ctx.semantic_memory_text ?? '').trim()

  if (memText) {
    const prefs = detectPreferences(memText)
    if (prefs.length > 0) {
      lines.push(
        `- Cliente costuma: ${prefs.slice(0, 3).join(', ')}. Sugira proativamente quando casar com a conversa atual, sem ser invasivo.`,
      )
    }

    const last = lastServiceMention(memText)
    if (last) {
      const days = daysBetween(last.iso, new Date())
      if (days !== null && days >= STALE_VISIT_DAYS) {
        lines.push(
          `- Cliente está há ${days} dias sem retornar (último serviço: ${last.service}). Um aceno casual de "senti sua falta" é apropriado se a conversa permitir.`,
        )
      }
    }
  }

  // Stack de objetivos pendentes — quando há digressão ativa.
  const stack = ctx.session.objective_stack ?? []
  if (stack.length > 0) {
    const top = stack[stack.length - 1]
    lines.push(
      `- Há objetivo pausado por digressão (${top.objective}). Ao terminar de responder o desvio, plante um gancho sutil de retomada — sem forçar.`,
    )
  }

  // Cliente tem nome preferido — usar.
  const preferredName = ctx.client?.name?.trim()
  const memPreferred = memText.match(/[Cc]hame de\s+([^\n.,;]+)/)
  if (memPreferred?.[1]) {
    lines.push(`- Cliente prefere ser chamado de "${memPreferred[1].trim()}". Use naturalmente.`)
  } else if (preferredName) {
    // Sinal mínimo só se o nome estiver disponível — evita instruir o óbvio.
  }

  return lines.join('\n')
}
