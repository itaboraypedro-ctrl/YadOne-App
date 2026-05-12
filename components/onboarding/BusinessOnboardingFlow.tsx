'use client'

// components/onboarding/BusinessOnboardingFlow.tsx — Orquestra a etapa "Negócio".
// Estados: search → (unitSelector) → preview → manual.

import { useState } from 'react'
import { toast } from 'sonner'
import { BusinessSearch } from '@/components/onboarding/BusinessSearch'
import { BusinessPreview } from '@/components/onboarding/BusinessPreview'
import { BusinessManualForm } from '@/components/onboarding/BusinessManualForm'
import { UnitSelector } from '@/components/onboarding/UnitSelector'
import type {
  BusinessProfile,
  UnitSearchResult,
  WorkspaceUnit,
} from '@/lib/onboarding/types'

type Step = 'search' | 'units' | 'preview' | 'manual'

function profileToUnit(profile: BusinessProfile): WorkspaceUnit {
  return {
    placeId: profile.placeId || undefined,
    name: profile.name,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    phone: profile.phone,
    businessHours: profile.businessHours,
    isPrimary: true,
  }
}

function unitResultToUnit(u: UnitSearchResult): WorkspaceUnit {
  return {
    placeId: u.place_id,
    name: u.name,
    address: u.address,
    city: u.city,
    state: u.state,
    isPrimary: false,
  }
}

export function BusinessOnboardingFlow() {
  const [step, setStep] = useState<Step>('search')
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [candidateUnits, setCandidateUnits] = useState<WorkspaceUnit[]>([])
  const [units, setUnits] = useState<WorkspaceUnit[]>([])
  const [isChain, setIsChain] = useState(false)

  async function handleProfile(p: BusinessProfile) {
    setProfile(p)
    // Tenta detectar rede.
    try {
      const resp = await fetch(
        `/api/onboarding/places/units?name=${encodeURIComponent(p.name)}`,
      )
      const json = (await resp.json()) as { results?: UnitSearchResult[] }
      const list = json.results ?? []
      // Filtra a unidade que já foi escolhida (mesmo placeId).
      const others = list.filter((u) => u.place_id !== p.placeId)
      if (others.length >= 1) {
        const allUnits: WorkspaceUnit[] = [
          profileToUnit(p),
          ...others.map(unitResultToUnit),
        ]
        setCandidateUnits(allUnits)
        setIsChain(true)
        setStep('units')
        return
      }
    } catch (err) {
      console.warn('[BusinessOnboardingFlow] units lookup falhou:', err)
    }

    // Single-unit fallback.
    setIsChain(false)
    setUnits([profileToUnit(p)])
    setStep('preview')
  }

  function handleUnitSelection(selected: WorkspaceUnit[]) {
    if (selected.length === 0) {
      toast.error('Selecione pelo menos uma unidade.')
      return
    }
    setUnits(selected)
    setIsChain(selected.length > 1)
    setStep('preview')
  }

  return (
    <div className="space-y-4">
      {step === 'search' && (
        <BusinessSearch
          onProfile={handleProfile}
          onManual={() => setStep('manual')}
        />
      )}
      {step === 'units' && (
        <UnitSelector
          units={candidateUnits}
          onSelect={handleUnitSelection}
          onCancel={() => setStep('search')}
        />
      )}
      {step === 'preview' && profile && (
        <BusinessPreview
          initial={profile}
          units={units}
          isChain={isChain}
          unitCount={units.length || 1}
          onBack={() => setStep('search')}
        />
      )}
      {step === 'manual' && (
        <BusinessManualForm onBack={() => setStep('search')} />
      )}
    </div>
  )
}
