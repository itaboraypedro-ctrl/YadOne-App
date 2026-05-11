// lib/format/messages.ts — Helpers de formatação e agrupamento de mensagens.

import type { MessageWithMeta } from '@/lib/types/frontend'

export interface MessageGroup {
  /** Ex: 'Hoje', 'Ontem', 'Segunda-feira', '12 de maio' */
  label: string
  messages: MessageWithMeta[]
}

/**
 * Agrupa mensagens por data. Espera mensagens em ordem cronológica ascendente.
 */
export function groupMessagesByDate(msgs: MessageWithMeta[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const m of msgs) {
    const label = labelForDate(m.created_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.messages.push(m)
    else groups.push({ label, messages: [m] })
  }
  return groups
}

export function labelForDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const today = startOf(now)
  const that = startOf(d)
  const diffDays = Math.round(
    (today.getTime() - that.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString('pt-BR', { weekday: 'long' })
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatFullDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR')
}
