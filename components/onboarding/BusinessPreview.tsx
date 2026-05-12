'use client'

// components/onboarding/BusinessPreview.tsx — Card editável + confirmação.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { saveBusinessProfile } from '@/app/onboarding/actions'
import { formatBusinessHoursText } from '@/lib/onboarding/places-mapper'
import type {
  BusinessProfile,
  WorkspaceUnit,
} from '@/lib/onboarding/types'

export function BusinessPreview({
  initial,
  units,
  isChain,
  unitCount,
  onBack,
}: {
  initial: BusinessProfile
  units: WorkspaceUnit[]
  isChain: boolean
  unitCount: number
  onBack?: () => void
}) {
  const [profile, setProfile] = useState<BusinessProfile>(initial)
  const [editMode, setEditMode] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function patch<K extends keyof BusinessProfile>(
    key: K,
    value: BusinessProfile[K],
  ) {
    setProfile((p) => ({ ...p, [key]: value }))
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await saveBusinessProfile({
        profile,
        units,
        isChain,
        unitCount,
        manualEntry: false,
      })
      if (!res.success) {
        toast.error(res.error ?? 'Erro ao salvar.')
        return
      }
      toast.success('Negócio salvo! Próxima etapa: configurar o agente.')
      router.replace('/onboarding/agent')
    })
  }

  const hoursText = profile.businessHours
    ? formatBusinessHoursText(profile.businessHours)
    : ''

  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            background: 'oklch(0.88 0.20 130 / 0.18)',
            color: 'oklch(0.88 0.20 130)',
          }}
        >
          ✓
        </span>
        <h2 className="text-base font-semibold text-[oklch(0.96_0.005_150)]">
          Encontramos seu negócio!
        </h2>
      </div>

      <div className="mt-4 space-y-3">
        <Field
          label="Nome"
          value={profile.name}
          editing={editMode}
          onChange={(v) => patch('name', v)}
        />
        <Field
          label="Endereço"
          value={profile.address}
          editing={editMode}
          onChange={(v) => patch('address', v)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Cidade"
            value={profile.city}
            editing={editMode}
            onChange={(v) => patch('city', v)}
          />
          <Field
            label="Estado"
            value={profile.state}
            editing={editMode}
            onChange={(v) => patch('state', v)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Telefone"
            value={profile.phone ?? ''}
            editing={editMode}
            onChange={(v) => patch('phone', v || undefined)}
          />
          <Field
            label="Site"
            value={profile.website ?? ''}
            editing={editMode}
            onChange={(v) => patch('website', v || undefined)}
          />
        </div>

        {hoursText && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[oklch(0.62_0.018_150)]">
              Horários
            </div>
            <div className="text-sm text-[oklch(0.92_0.005_150)]">{hoursText}</div>
          </div>
        )}

        {profile.categories.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[oklch(0.62_0.018_150)]">
              Categorias
            </div>
            <div className="text-sm text-[oklch(0.92_0.005_150)]">
              {profile.categories.join(' · ')}
            </div>
          </div>
        )}

        {profile.services.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[oklch(0.62_0.018_150)]">
              Produtos / serviços
            </div>
            <div className="text-sm text-[oklch(0.92_0.005_150)]">
              {profile.services.join(' · ')}
            </div>
          </div>
        )}

        {typeof profile.rating === 'number' && (
          <div className="text-sm text-[oklch(0.85_0.015_150)]">
            ⭐ {profile.rating.toFixed(1)}
            {profile.reviewCount ? ` (${profile.reviewCount} avaliações)` : ''}
          </div>
        )}

        {isChain && units.length > 1 && (
          <div className="text-sm text-[oklch(0.85_0.015_150)]">
            🏥 {units.length} unidades selecionadas
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={pending}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-[oklch(0.85_0.015_150)] transition hover:bg-white/5 disabled:opacity-50"
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            disabled={pending}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-[oklch(0.85_0.015_150)] transition hover:bg-white/5 disabled:opacity-50"
          >
            {editMode ? 'Concluir edição' : '✏️ Editar informações'}
          </button>
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="rounded-full px-6 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          style={{
            background: 'oklch(0.88 0.20 130)',
            color: 'oklch(0.18 0.04 150)',
            boxShadow:
              '0 14px 36px -10px oklch(0.88 0.20 130 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.5)',
          }}
        >
          {pending ? 'Salvando…' : 'Confirmar →'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  editing,
  onChange,
}: {
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[oklch(0.62_0.018_150)]">
        {label}
      </div>
      {editing ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-[oklch(0.95_0.005_150)] focus:border-[oklch(0.88_0.20_130)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.88_0.20_130_/_0.25)]"
        />
      ) : (
        <div className="text-sm text-[oklch(0.92_0.005_150)]">
          {value || <span className="text-[oklch(0.55_0.018_150)]">—</span>}
        </div>
      )}
    </div>
  )
}
