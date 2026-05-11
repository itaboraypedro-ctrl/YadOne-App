'use client'
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'

export interface ConversationSearchProps {
  /** Callback chamado com query debounced (300ms). Strings vazias são válidas (limpou). */
  onSearch: (query: string) => void
  className?: string
}

export function ConversationSearch({ onSearch, className }: ConversationSearchProps) {
  const [expanded, setExpanded] = useState(false)
  const [value, setValue] = useState('')
  const debounced = useDebouncedValue(value, 300)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onSearch(debounced)
  }, [debounced, onSearch])

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setValue('')
      setExpanded(false)
    }
  }

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn('size-8', className)}
        aria-label="Buscar conversas"
        onClick={() => setExpanded(true)}
      >
        <Search className="size-4" />
      </Button>
    )
  }

  return (
    <div className={cn('flex items-center gap-1 animate-in fade-in slide-in-from-right-2 duration-200', className)}>
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar nome ou número"
          className="pl-8 pr-8 h-8"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => { setValue(''); setExpanded(false) }}
        aria-label="Fechar busca"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
