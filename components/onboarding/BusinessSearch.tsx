'use client'

// components/onboarding/BusinessSearch.tsx — Input com autocomplete da Places API.

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { BusinessProfile, SearchResult } from '@/lib/onboarding/types'

type Status =
  | 'idle'
  | 'searching'
  | 'loading_details'
  | 'found'
  | 'not_found'

export function BusinessSearch({
  onProfile,
  onManual,
}: {
  onProfile: (profile: BusinessProfile) => void
  onManual: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const detailsAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setStatus('idle')
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setStatus('searching')
      setOpen(true)
      try {
        const resp = await fetch(
          `/api/onboarding/places/search?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal },
        )
        if (!resp.ok) {
          setResults([])
          setStatus('not_found')
          return
        }
        const json = (await resp.json()) as { results?: SearchResult[] }
        const r = json.results ?? []
        setResults(r)
        setStatus(r.length === 0 ? 'not_found' : 'idle')
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('[BusinessSearch] search:', err)
        setResults([])
        setStatus('not_found')
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  async function handleSelect(r: SearchResult) {
    if (detailsAbortRef.current) detailsAbortRef.current.abort()
    const ctrl = new AbortController()
    detailsAbortRef.current = ctrl
    setStatus('loading_details')
    setOpen(false)
    try {
      const resp = await fetch(
        `/api/onboarding/places/details?place_id=${encodeURIComponent(r.place_id)}`,
        { signal: ctrl.signal },
      )
      const json = (await resp.json()) as { profile?: BusinessProfile | null }
      if (!resp.ok || !json.profile) {
        toast.error('Não conseguimos carregar os dados desse negócio.')
        setStatus('idle')
        return
      }
      setStatus('found')
      onProfile(json.profile)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('[BusinessSearch] details:', err)
      toast.error('Erro ao carregar detalhes. Tente novamente.')
      setStatus('idle')
    }
  }

  const showNotFound =
    status === 'not_found' && query.trim().length >= 3 && results.length === 0

  return (
    <div className="relative w-full">
      <label
        htmlFor="business-search"
        className="mb-2 block text-sm font-medium text-[oklch(0.85_0.015_150)]"
      >
        Encontre seu negócio
      </label>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[oklch(0.65_0.018_150)]"
        >
          {/* search icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          id="business-search"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Digite o nome do seu negócio..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full rounded-xl border border-white/15 bg-white/5 pl-10 pr-3.5 py-3 text-sm text-[oklch(0.95_0.005_150)] placeholder:text-[oklch(0.62_0.018_150)] focus:border-[oklch(0.88_0.20_130)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.88_0.20_130_/_0.25)]"
          disabled={status === 'loading_details'}
        />
        {(status === 'searching' || status === 'loading_details') && (
          <span
            aria-hidden
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[oklch(0.88_0.20_130)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </span>
        )}
      </div>

      {open && (status === 'searching' || results.length > 0) && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-white/15 bg-[oklch(0.12_0.025_150)] p-1 shadow-2xl"
        >
          {status === 'searching' && results.length === 0 && (
            <>
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="flex flex-col gap-1.5 px-3 py-2.5"
                  aria-hidden
                >
                  <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded bg-white/5" />
                </li>
              ))}
            </>
          )}
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(r)}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/5"
              >
                <span className="text-sm font-medium text-[oklch(0.95_0.005_150)]">
                  {r.name}
                </span>
                {r.address && (
                  <span className="text-xs text-[oklch(0.70_0.018_150)]">
                    {r.address}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showNotFound && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <p className="text-[oklch(0.85_0.015_150)]">
            Nenhum negócio encontrado com esse nome.
          </p>
          <p className="mt-1 text-xs text-[oklch(0.65_0.018_150)]">
            Isso acontece com negócios novos ou com nome diferente no Google.
          </p>
          <button
            type="button"
            onClick={onManual}
            className="mt-3 text-sm font-semibold text-[oklch(0.88_0.20_130)] hover:underline"
          >
            Preencher manualmente →
          </button>
        </div>
      )}

      <div className="mt-3 text-center text-xs text-[oklch(0.62_0.018_150)]">
        Não encontrou?{' '}
        <button
          type="button"
          onClick={onManual}
          className="font-medium text-[oklch(0.88_0.20_130)] hover:underline"
        >
          Preencher manualmente
        </button>
      </div>
    </div>
  )
}
