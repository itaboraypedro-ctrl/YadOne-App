// components/conversations/AIControlChannel.tsx — Lista de canais com switch por canal.
// Renderizado dentro do DropdownMenuContent do AIControlGlobal (SPEC §3.2).
'use client'

import { Switch } from '@/components/ui/switch'
import type { ChannelStatus } from '@/lib/types/frontend'

interface AIControlChannelProps {
  channels: ChannelStatus[]
  loading: boolean
  onToggle: (channelId: string, enabled: boolean) => void
}

export function AIControlChannel({
  channels,
  loading,
  onToggle,
}: AIControlChannelProps) {
  if (loading) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        Carregando canais...
      </div>
    )
  }
  if (channels.length === 0) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        Nenhum canal configurado.
      </div>
    )
  }

  return (
    <div className="p-1 min-w-[280px]">
      {channels.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between px-3 py-2 hover:bg-accent rounded-md"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium capitalize">
              {c.channel_type}
            </span>
            <span className="text-xs text-muted-foreground">
              {c.phone_number} · {c.active_sessions_count} ativa
              {c.active_sessions_count !== 1 ? 's' : ''}
            </span>
          </div>
          <Switch
            checked={c.ai_enabled}
            onCheckedChange={(checked) => onToggle(c.id, checked)}
          />
        </div>
      ))}
    </div>
  )
}
