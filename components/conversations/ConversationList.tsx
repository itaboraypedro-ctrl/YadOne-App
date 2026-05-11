'use client'

// components/conversations/ConversationList.tsx — Aside com lista de conversas.
// Compõe AIControlGlobal (F07), ConversationSearch + ConversationFilters (F08)
// internamente. Filtragem e busca são client-side.

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ConversationCard } from './ConversationCard'
import { AIControlGlobal } from './AIControlGlobal'
import { ConversationSearch } from './ConversationSearch'
import {
  ConversationFilters,
  type ConversationFilter,
} from './ConversationFilters'
import { useConversations } from '@/hooks/useConversations'
import type { ConversationWithMeta } from '@/lib/types/frontend'
import { cn } from '@/lib/utils'

export interface ConversationListProps {
  activeId?: string
  hideOnMobile?: boolean
}

function applyFilter(c: ConversationWithMeta, filter: ConversationFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'active':
      return c.ai_status === 'active' && !c.ai_paused
    case 'paused':
      return c.ai_paused === true || c.ai_status.startsWith('paused')
    case 'waiting':
      return c.session.status === 'waiting'
    case 'handoff':
      return c.session.status === 'handoff'
    default:
      return true
  }
}

function CardSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 animate-pulse">
      <div className="size-8 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-32 rounded bg-muted" />
          <div className="ml-auto h-2 w-10 rounded bg-muted" />
        </div>
        <div className="h-2.5 w-48 rounded bg-muted" />
        <div className="h-3 w-16 rounded bg-muted" />
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-12 px-4 text-muted-foreground">
      <Inbox className="size-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function ConversationList({ activeId, hideOnMobile }: ConversationListProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>('all')

  const { conversations, loading, error, hasMore, loadMore } = useConversations()

  const filtered = useMemo(() => {
    let list = conversations
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((c) => {
        const name = (c.client?.name ?? '').toLowerCase()
        const phone = c.client?.phone ?? ''
        return name.includes(q) || phone.includes(q)
      })
    }
    if (activeFilter !== 'all') {
      list = list.filter((c) => applyFilter(c, activeFilter))
    }
    return list
  }, [conversations, searchQuery, activeFilter])

  const handleSearch = useCallback((q: string) => setSearchQuery(q), [])

  return (
    <aside
      className={cn(
        'w-full md:w-[360px] flex flex-col border-r border-border bg-card',
        hideOnMobile && 'hidden md:flex',
      )}
    >
      <div className="border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Conversas</h2>
          <ConversationSearch onSearch={handleSearch} />
        </div>
      </div>

      <div className="border-b p-3">
        <AIControlGlobal />
      </div>

      <div className="border-b">
        <ConversationFilters
          active={activeFilter}
          onChange={setActiveFilter}
          conversations={conversations}
        />
      </div>

      <ScrollArea className="flex-1">
        {loading && conversations.length === 0 && (
          <div className="divide-y">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {!loading && error && (
          <EmptyState message={`Erro ao carregar: ${error}`} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            message={
              conversations.length === 0
                ? 'Nenhuma conversa ainda'
                : 'Nenhuma conversa encontrada'
            }
          />
        )}

        {filtered.length > 0 && (
          <ul className="divide-y">
            {filtered.map((c) => (
              <li key={c.session.id}>
                <ConversationCard
                  conversation={c}
                  isActive={c.session.id === activeId}
                  onClick={() => router.push(`/conversations/${c.session.id}`)}
                />
              </li>
            ))}
          </ul>
        )}

        {hasMore && !loading && (
          <div className="p-3 flex justify-center">
            <Button variant="ghost" size="sm" onClick={loadMore}>
              Carregar mais
            </Button>
          </div>
        )}

        {loading && conversations.length > 0 && (
          <div className="p-3 flex justify-center text-xs text-muted-foreground">
            Carregando...
          </div>
        )}
      </ScrollArea>
    </aside>
  )
}
