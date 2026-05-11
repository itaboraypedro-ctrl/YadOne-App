'use client'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { ConversationWithMeta } from '@/lib/types/frontend'

export type ConversationFilter = 'all' | 'active' | 'paused' | 'waiting' | 'handoff'

const FILTERS: Array<{ id: ConversationFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'IA Ativa' },
  { id: 'paused', label: 'Pausadas' },
  { id: 'waiting', label: 'Aguardando' },
  { id: 'handoff', label: 'Handoff' },
]

export interface ConversationFiltersProps {
  active: ConversationFilter
  onChange: (filter: ConversationFilter) => void
  conversations: ConversationWithMeta[]
  className?: string
}

function countByFilter(list: ConversationWithMeta[], filter: ConversationFilter): number {
  switch (filter) {
    case 'all': return list.length
    case 'active': return list.filter(c => c.ai_status === 'active' && !c.ai_paused).length
    case 'paused': return list.filter(c => c.ai_paused || c.ai_status.startsWith('paused')).length
    case 'waiting': return list.filter(c => c.status === 'waiting').length
    case 'handoff': return list.filter(c => c.status === 'handoff').length
  }
}

export function ConversationFilters({ active, onChange, conversations, className }: ConversationFiltersProps) {
  return (
    <ScrollArea className={cn('w-full', className)}>
      <div className="flex items-center gap-2 p-2">
        {FILTERS.map(f => {
          const count = countByFilter(conversations, f.id)
          const isActive = active === f.id
          return (
            <button
              key={f.id}
              onClick={() => onChange(f.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                  isActive ? 'bg-primary-foreground/20' : 'bg-background/60'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
