'use client'

// components/onboarding/UnitSelector.tsx — Seleção de unidades para redes.

import { useState } from 'react'
import type { WorkspaceUnit } from '@/lib/onboarding/types'

type Mode = 'only' | 'some' | 'all'

export function UnitSelector({
  units,
  onSelect,
  onCancel,
}: {
  units: WorkspaceUnit[]
  onSelect: (selected: WorkspaceUnit[]) => void
  onCancel?: () => void
}) {
  const [mode, setMode] = useState<Mode>('only')
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const total = units.length
  const primary = units[0]

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function unitKey(u: WorkspaceUnit, idx: number): string {
    return u.placeId ?? `idx-${idx}`
  }

  function handleConfirm() {
    if (mode === 'only') {
      onSelect([{ ...primary, isPrimary: true }])
      return
    }
    if (mode === 'all') {
      onSelect(units.map((u, idx) => ({ ...u, isPrimary: idx === 0 })))
      return
    }
    // some
    const selected = units.filter((u, idx) => checked.has(unitKey(u, idx)))
    if (selected.length === 0) {
      onSelect([{ ...primary, isPrimary: true }])
      return
    }
    onSelect(selected.map((u, idx) => ({ ...u, isPrimary: idx === 0 })))
  }

  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[oklch(0.96_0.005_150)]">
        Encontramos {total} unidades de {primary?.name ?? 'seu negócio'}
      </h2>
      <p className="mt-1 text-sm text-[oklch(0.70_0.018_150)]">
        Você é proprietário de quantas unidades?
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <OptionRow
          checked={mode === 'only'}
          onClick={() => setMode('only')}
          title="Só desta unidade"
          subtitle={primary ? `${primary.address} — ${primary.city}/${primary.state}` : ''}
        />
        <OptionRow
          checked={mode === 'some'}
          onClick={() => setMode('some')}
          title="De algumas unidades específicas"
          subtitle="Selecionar quais"
        />
        <OptionRow
          checked={mode === 'all'}
          onClick={() => setMode('all')}
          title={`De todas as ${total} unidades`}
        />
      </div>

      {mode === 'some' && (
        <ul className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2">
          {units.map((u, idx) => {
            const key = unitKey(u, idx)
            const isChecked = checked.has(key)
            return (
              <li key={key}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(key)}
                    className="mt-0.5 h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-[oklch(0.88_0.20_130)]"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-[oklch(0.95_0.005_150)]">
                      {u.name}
                    </span>
                    <span className="text-xs text-[oklch(0.70_0.018_150)]">
                      {u.address}
                      {u.city ? ` — ${u.city}` : ''}
                      {u.state ? `/${u.state}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-[oklch(0.85_0.015_150)] transition hover:bg-white/5"
          >
            Voltar
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
          style={{
            background: 'oklch(0.88 0.20 130)',
            color: 'oklch(0.18 0.04 150)',
            boxShadow:
              '0 14px 36px -10px oklch(0.88 0.20 130 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.5)',
          }}
        >
          Confirmar seleção
        </button>
      </div>
    </div>
  )
}

function OptionRow({
  checked,
  onClick,
  title,
  subtitle,
}: {
  checked: boolean
  onClick: () => void
  title: string
  subtitle?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
        checked
          ? 'border-[oklch(0.88_0.20_130)] bg-[oklch(0.88_0.20_130_/_0.08)]'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          checked
            ? 'border-[oklch(0.88_0.20_130)] bg-[oklch(0.88_0.20_130)]'
            : 'border-white/30'
        }`}
      >
        {checked && (
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.18_0.04_150)]" />
        )}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-[oklch(0.95_0.005_150)]">
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-[oklch(0.70_0.018_150)]">{subtitle}</span>
        )}
      </span>
    </button>
  )
}
