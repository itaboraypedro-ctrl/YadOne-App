'use client'

// components/client-panel/ClientMemory.tsx — F17.
// Apresenta a memória semântica + episódica do cliente. Consumido pelo ClientPanel.

import { Loader2 } from 'lucide-react'
import { useClientMemory } from '@/hooks/useClientMemory'

interface ClientMemoryProps {
  clientId: string
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value || !value.trim()) return null
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground whitespace-pre-wrap">{value}</div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 w-24 bg-muted rounded" />
      <div className="h-4 w-full bg-muted rounded" />
      <div className="h-3 w-20 bg-muted rounded" />
      <div className="h-4 w-3/4 bg-muted rounded" />
    </div>
  )
}

export function ClientMemory({ clientId }: ClientMemoryProps) {
  const { data, loading, error } = useClientMemory(clientId)

  if (loading) return <Skeleton />
  if (error) {
    return (
      <p className="text-xs text-destructive">
        Não foi possível carregar a memória.
      </p>
    )
  }
  const memory = data?.memory
  if (!memory) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Sem memória registrada ainda.
      </p>
    )
  }

  const hasAnyField =
    !!memory.preferred_name ||
    !!memory.last_service ||
    !!memory.observations ||
    !!memory.memory_summary ||
    (memory.preferences && memory.preferences.length > 0)

  return (
    <div className="space-y-3">
      {!hasAnyField && memory.semantic_facts.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Sem memória registrada ainda.
        </p>
      )}

      <Field label="Apelido" value={memory.preferred_name} />
      <Field label="Último serviço" value={memory.last_service} />
      <Field label="Observações" value={memory.observations} />
      <Field label="Resumo" value={memory.memory_summary} />

      {memory.preferences.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Preferências
          </div>
          <ul className="list-disc list-inside text-sm space-y-0.5">
            {memory.preferences.map((p, i) => (
              <li key={i} className="text-foreground">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {memory.semantic_facts.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Notas recentes da IA
          </div>
          <ul className="space-y-1">
            {memory.semantic_facts.slice(0, 5).map((fact, i) => (
              <li
                key={i}
                className="text-xs text-foreground bg-muted/40 rounded px-2 py-1.5"
              >
                <span className="block">{fact.text}</span>
                {fact.tags && fact.tags.length > 0 && (
                  <span className="block mt-0.5 text-[10px] text-muted-foreground">
                    {fact.tags.join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {memory.updated_at && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1">
          <Loader2 className="h-3 w-3" aria-hidden />
          <span>
            Atualizada em{' '}
            {new Date(memory.updated_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        </div>
      )}
    </div>
  )
}
