// lib/format/relative-time.ts — Helpers de formatação para a lista de conversas.

export function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  const diffMs = now.getTime() - d.getTime()
  const days = diffMs / (1000 * 60 * 60 * 24)
  if (days < 7) {
    return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function colorFromString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  const hue = Math.abs(h) % 360
  return `hsl(${hue} 60% 50%)`
}

export function initialFromName(name: string): string {
  const cleaned = (name ?? '').trim()
  if (!cleaned) return '?'
  const first = cleaned.split(/\s+/)[0]
  return first.charAt(0).toUpperCase()
}
