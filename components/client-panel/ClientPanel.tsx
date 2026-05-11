'use client'

// components/client-panel/ClientPanel.tsx — F17.
// Sheet lateral com info do cliente, memória da IA, controle por conversa,
// histórico de sessões e placeholder de agendamentos.
// SPEC_FRONTEND_CONVERSATIONS.md §3.4.

import {
  BrainCircuit,
  Bot,
  Calendar,
  History,
  Mail,
  MessageSquare,
  Phone,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ClientMemory } from './ClientMemory'
import { ClientHistory } from './ClientHistory'
import type { ConversationWithMeta } from '@/lib/types/frontend'
import { colorFromString, initialFromName } from '@/lib/format/relative-time'

export interface ClientPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversation: ConversationWithMeta
  /** Callback quando usuário toggla IA dentro do painel. */
  onToggleAIPause: (paused: boolean) => Promise<void> | void
  togglePending?: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function ClientPanel({
  open,
  onOpenChange,
  conversation,
  onToggleAIPause,
  togglePending,
}: ClientPanelProps) {
  const { client, channel } = conversation
  const name = client.name ?? client.phone ?? 'Cliente'
  const initial = initialFromName(name)
  const color = colorFromString(client.id)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[85vw] sm:w-[360px] sm:max-w-[420px] p-0 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Info do contato</SheetTitle>
        </SheetHeader>

        <section className="px-4 pb-4 flex flex-col items-center text-center gap-2">
          <Avatar size="lg" className="h-16 w-16">
            <AvatarFallback
              style={{ backgroundColor: color, color: 'white' }}
              className="text-xl font-semibold"
            >
              {initial}
            </AvatarFallback>
          </Avatar>
          <h3 className="font-semibold text-base">{name}</h3>
          <div className="text-xs text-muted-foreground space-y-1">
            {client.phone && (
              <div className="flex items-center justify-center gap-1.5">
                <Phone className="h-3 w-3" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center justify-center gap-1.5">
                <Mail className="h-3 w-3" />
                <span>{client.email}</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              <span>{channel.channel_type}</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Calendar className="h-3 w-3" />
              <span>Desde {formatDate(client.created_at)}</span>
            </div>
          </div>
        </section>

        <Separator />

        <section className="p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <BrainCircuit className="h-4 w-4" />
            Memória da IA
          </h4>
          <ClientMemory clientId={client.id} />
        </section>

        <Separator />

        <section className="p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Controle de IA
          </h4>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm">
                {conversation.ai_paused ? 'IA pausada' : 'IA ativa'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Apenas nesta conversa
              </span>
            </div>
            <Switch
              checked={!conversation.ai_paused}
              onCheckedChange={(checked) => {
                void onToggleAIPause(!checked)
              }}
              disabled={togglePending}
              aria-label="Pausar ou retomar IA nesta conversa"
            />
          </div>
        </section>

        <Separator />

        <section className="p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </h4>
          <ClientHistory clientId={client.id} />
        </section>

        <Separator />

        <section className="p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Agendamentos
          </h4>
          <p className="text-xs text-muted-foreground italic">
            Integração com calendário disponível na fase 2 (ver
            SPEC_MOTOR_GOVERNANCE §8).
          </p>
        </section>
      </SheetContent>
    </Sheet>
  )
}
