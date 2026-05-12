// lib/onboarding/types.ts — Tipos compartilhados da etapa "Conte sobre o seu negócio".

export type DayHours = { open: string; close: string }

export type BusinessHours = {
  mon?: DayHours
  tue?: DayHours
  wed?: DayHours
  thu?: DayHours
  fri?: DayHours
  sat?: DayHours
  sun?: DayHours
  text?: string[] // weekday_text do Google
}

export type BusinessProfile = {
  placeId: string
  name: string
  address: string
  city: string
  state: string
  zipCode?: string
  phone?: string
  website?: string
  businessHours?: BusinessHours
  categories: string[]
  services: string[]
  rating?: number
  reviewCount?: number
  logoUrl?: string
  rawData?: Record<string, unknown> // snapshot da Places API
}

export type WorkspaceUnit = {
  placeId?: string
  name: string
  address: string
  city: string
  state: string
  phone?: string
  businessHours?: BusinessHours
  isPrimary: boolean
}

export type BusinessProfileData = {
  profile: BusinessProfile
  units: WorkspaceUnit[]
  isChain: boolean
  unitCount: number
  manualEntry: boolean
}

export type SearchResult = {
  place_id: string
  name: string
  address: string
  description?: string
}

export type UnitSearchResult = {
  place_id: string
  name: string
  address: string
  city: string
  state: string
}

export type KnowledgeChunk = {
  title: string
  content: string
  source: 'google_places_onboarding'
}
