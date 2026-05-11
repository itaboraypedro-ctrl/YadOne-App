// components/conversations/AIControlGlobal.tsx — Card fixo de controle de IA global.
// SPEC_FRONTEND_CONVERSATIONS.md §3.2 + §6.
//
// - Switch master para pausar/retomar IA do workspace inteiro.
// - Confirmação obrigatória apenas ao PAUSAR (retomar é direto).
// - Dropdown "Por canal ▾" abrindo AIControlChannel.
// - Animação animate-pulse-ai (300ms) ao trocar status.
'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAIControl } from '@/hooks/useAIControl'
import { AIControlChannel } from './AIControlChannel'
import { cn } from '@/lib/utils'
import type { AIStatus } from '@/lib/types/frontend'

function badgeClassesFor(status: AIStatus): string {
  switch (status) {
    case 'active':
      return 'bg-secondary text-secondary-foreground'
    case 'paused_global':
      return 'bg-destructive text-destructive-foreground'
    case 'paused_channel':
      return 'bg-warning text-warning-foreground'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function statusLabelFor(status: AIStatus): string {
  switch (status) {
    case 'active':
      return '● ATIVA'
    case 'paused_global':
      return '● PAUSADA'
    case 'paused_channel':
      return '● PARCIAL'
    default:
      return '● —'
  }
}

function statusDescriptionFor(status: AIStatus): string {
  switch (status) {
    case 'active':
      return 'Respondendo automaticamente'
    case 'paused_global':
      return 'IA pausada — você no controle'
    case 'paused_channel':
      return 'Pausada em alguns canais'
    default:
      return ''
  }
}

export function AIControlGlobal() {
  const {
    global,
    derivedStatus,
    toggleGlobal,
    channels,
    channelsLoading,
    toggleChannel,
  } = useAIControl()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pulse, setPulse] = useState(false)
  const prevStatusRef = useRef<AIStatus>(derivedStatus)

  useEffect(() => {
    if (prevStatusRef.current !== derivedStatus) {
      prevStatusRef.current = derivedStatus
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 300)
      return () => clearTimeout(t)
    }
  }, [derivedStatus])

  const handleSwitchChange = (checked: boolean) => {
    if (!checked) {
      // pausando — exige confirmação
      setConfirmOpen(true)
    } else {
      void toggleGlobal(true)
    }
  }

  const handleConfirmPause = async () => {
    setConfirmOpen(false)
    await toggleGlobal(false)
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm',
        pulse && 'animate-pulse-ai',
      )}
      data-status={derivedStatus}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              IA Yadone
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                badgeClassesFor(derivedStatus),
              )}
            >
              {statusLabelFor(derivedStatus)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {statusDescriptionFor(derivedStatus)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              aria-label="Configurar IA por canal"
            >
              Por canal
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="p-0">
            <AIControlChannel
              channels={channels}
              loading={channelsLoading}
              onToggle={(id, enabled) => void toggleChannel(id, enabled)}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        <Switch
          checked={global.ai_enabled}
          disabled={global.loading}
          onCheckedChange={handleSwitchChange}
          aria-label={
            global.ai_enabled ? 'Pausar IA global' : 'Retomar IA global'
          }
        />
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pausar IA para todas as conversas?</DialogTitle>
            <DialogDescription>
              Isso desativa respostas automáticas em todos os canais. Conversas
              já pausadas individualmente permanecem pausadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmPause}>
              Pausar IA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
