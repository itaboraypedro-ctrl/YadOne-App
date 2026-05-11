'use client'

// components/client-panel/ClientHistory.tsx — F17.
// Lista compacta das sessões anteriores do cliente.

import { Button } from '@/components/ui/button'
import { useClientHistory } from '@/hooks/useClientHistory'
import type { SessionStatus } from '@/types/session'

interface ClientHistoryProps {
  clientId: string
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  active: 'Em andamento',
  waiting: 'Aguardando',
  handoff: 'Atendente',
  completed: 'Concluída',
  expired: 'Expirada',
}

const STATUS_COLOR: Record<SessionStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  waiting: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  handoff: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  completed: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function ClientHistory({ clientId }: ClientHistoryProps) {
  const { sessions, total, loading, error } = useClientHistory(clientId)

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-8 w-full bg-muted rounded" />
        <div className="h-8 w-full bg-muted rounded" />
        <div className="h-8 w-3/4 bg-muted rounded" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-xs text-destructive">
        Não foi possível carregar o histórico.
      </p>
    )
  }

  if (sessions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Nenhuma sessão anterior registrada.
      </p>
    )
  }

  const handleViewAll = () => {
    if (typeof window !== 'undefined') window.alert('Em breve')
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 text-xs rounded border px-2 py-1.5"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-foreground truncate">
                {formatDate(s.created_at)} · {s.channel}
              </span>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[s.status]}`}
            >
              {STATUS_LABEL[s.status]}
            </span>
          </li>
        ))}
      </ul>
      {total > sessions.length && (
        <p className="text-[11px] text-muted-foreground">
          Exibindo {sessions.length} de {total}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleViewAll}
      >
        Ver histórico completo
      </Button>
    </div>
  )
}
