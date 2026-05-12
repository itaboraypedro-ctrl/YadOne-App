'use client'

// components/onboarding/BusinessManualForm.tsx — Formulário manual (sem Places).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { saveBusinessProfile } from '@/app/onboarding/actions'
import type { BusinessProfile, WorkspaceUnit } from '@/lib/onboarding/types'

const inputClass =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-[oklch(0.95_0.005_150)] placeholder:text-[oklch(0.62_0.018_150)] focus:border-[oklch(0.88_0.20_130)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.88_0.20_130_/_0.25)]'

const labelClass =
  'mb-1.5 block text-xs font-medium tracking-wide text-[oklch(0.78_0.018_150)]'

export function BusinessManualForm({
  onBack,
}: {
  onBack?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [hours, setHours] = useState('')
  const [servicesText, setServicesText] = useState('')
  const [unitsCount, setUnitsCount] = useState('1')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) return toast.error('Informe o nome do negócio.')
    if (!address.trim()) return toast.error('Informe o endereço.')
    if (!city.trim() || !state.trim()) return toast.error('Informe cidade e estado.')
    const uc = Number.parseInt(unitsCount, 10)
    if (!Number.isFinite(uc) || uc < 1) return toast.error('Número de unidades inválido.')

    const services = servicesText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)

    const profile: BusinessProfile = {
      placeId: '',
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase().slice(0, 2),
      phone: phone.trim() || undefined,
      website: website.trim() || undefined,
      businessHours: hours.trim() ? { text: [hours.trim()] } : undefined,
      categories: [],
      services,
    }

    const units: WorkspaceUnit[] = [
      {
        name: profile.name,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        phone: profile.phone,
        isPrimary: true,
      },
    ]

    startTransition(async () => {
      const res = await saveBusinessProfile({
        profile,
        units,
        isChain: uc > 1,
        unitCount: uc,
        manualEntry: true,
      })
      if (!res.success) {
        toast.error(res.error ?? 'Erro ao salvar.')
        return
      }
      toast.success('Negócio salvo!')
      router.replace('/onboarding/agent')
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 sm:p-6"
    >
      <h2 className="text-base font-semibold text-[oklch(0.96_0.005_150)]">
        Preencher manualmente
      </h2>
      <p className="mt-1 text-sm text-[oklch(0.70_0.018_150)]">
        Vamos lá — preencha os dados básicos do seu negócio.
      </p>

      <div className="mt-5 space-y-3.5">
        <div>
          <label className={labelClass} htmlFor="mf-name">
            Nome do negócio *
          </label>
          <input
            id="mf-name"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="mf-address">
            Endereço *
          </label>
          <input
            id="mf-address"
            className={inputClass}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="mf-city">
              Cidade *
            </label>
            <input
              id="mf-city"
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="mf-state">
              UF *
            </label>
            <input
              id="mf-state"
              className={inputClass}
              maxLength={2}
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="mf-phone">
              Telefone
            </label>
            <input
              id="mf-phone"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 3456-7890"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="mf-website">
              Site
            </label>
            <input
              id="mf-website"
              className={inputClass}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="mf-hours">
            Horário de funcionamento
          </label>
          <textarea
            id="mf-hours"
            className={`${inputClass} min-h-[70px]`}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="Seg-Sex: 08h às 22h; Sáb: 08h às 20h"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="mf-services">
            Produtos / serviços
          </label>
          <textarea
            id="mf-services"
            className={`${inputClass} min-h-[80px]`}
            value={servicesText}
            onChange={(e) => setServicesText(e.target.value)}
            placeholder="Medicamentos, perfumaria, manipulação..."
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="mf-units">
            Número de unidades *
          </label>
          <input
            id="mf-units"
            className={inputClass}
            type="number"
            min={1}
            value={unitsCount}
            onChange={(e) => setUnitsCount(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={pending}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-[oklch(0.85_0.015_150)] transition hover:bg-white/5 disabled:opacity-50"
          >
            ← Voltar para busca
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-full px-6 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 sm:ml-auto"
          style={{
            background: 'oklch(0.88 0.20 130)',
            color: 'oklch(0.18 0.04 150)',
            boxShadow:
              '0 14px 36px -10px oklch(0.88 0.20 130 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.5)',
          }}
        >
          {pending ? 'Salvando…' : 'Salvar e continuar →'}
        </button>
      </div>
    </form>
  )
}
