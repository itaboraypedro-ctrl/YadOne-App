// lib/onboarding/places-mapper.ts — Mapeia respostas da Google Places API (v1)
// para os tipos internos do onboarding.

import type {
  BusinessHours,
  BusinessProfile,
  DayHours,
} from '@/lib/onboarding/types'

// Mapeamento de types do Google para categorias legíveis (SPEC §4.2).
// Valores null indicam tipos a ignorar.
const GOOGLE_TYPE_MAP: Record<string, string | null> = {
  pharmacy: 'Farmácia',
  drugstore: 'Drogaria',
  health: 'Saúde',
  store: 'Loja',
  supermarket: 'Supermercado',
  convenience_store: 'Conveniência',
  doctor: 'Atendimento médico',
  hospital: 'Hospital',
  veterinary_care: 'Veterinária',
  beauty_salon: 'Beleza',
  food: 'Alimentação',
  establishment: null,
  point_of_interest: null,
}

// Mapeia types para "serviços" inferidos.
const SERVICE_FROM_TYPE: Record<string, string> = {
  pharmacy: 'Medicamentos',
  drugstore: 'Perfumaria',
  health: 'Saúde',
  veterinary_care: 'Produtos veterinários',
  beauty_salon: 'Cosméticos',
  supermarket: 'Mercearia',
}

type AddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

type Period = {
  open?: { day?: number; hour?: number; minute?: number }
  close?: { day?: number; hour?: number; minute?: number }
}

type RawPlaceDetails = {
  id?: string
  displayName?: { text?: string } | string
  formattedAddress?: string
  addressComponents?: AddressComponent[]
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  regularOpeningHours?: {
    periods?: Period[]
    weekdayDescriptions?: string[]
  }
  rating?: number
  userRatingCount?: number
  types?: string[]
  photos?: Array<{ name?: string }>
}

// Mapeia day index (0=Sun no Google v1) para chave do BusinessHours.
const DAY_KEY: Array<keyof BusinessHours> = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
]

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

export function mapWeekdayText(periods: unknown[]): BusinessHours {
  const out: BusinessHours = {}
  if (!Array.isArray(periods)) return out

  for (const raw of periods) {
    if (!raw || typeof raw !== 'object') continue
    const p = raw as Period
    if (!p.open || typeof p.open.day !== 'number') continue
    const dayKey = DAY_KEY[p.open.day]
    if (!dayKey || dayKey === 'text') continue
    const openH = pad2(p.open.hour ?? 0)
    const openM = pad2(p.open.minute ?? 0)
    const closeH = pad2(p.close?.hour ?? 23)
    const closeM = pad2(p.close?.minute ?? 59)
    const hours: DayHours = {
      open: `${openH}:${openM}`,
      close: `${closeH}:${closeM}`,
    }
    // Atribuição segura (TS não infere bem dynamic keys de union)
    if (dayKey === 'mon') out.mon = hours
    else if (dayKey === 'tue') out.tue = hours
    else if (dayKey === 'wed') out.wed = hours
    else if (dayKey === 'thu') out.thu = hours
    else if (dayKey === 'fri') out.fri = hours
    else if (dayKey === 'sat') out.sat = hours
    else if (dayKey === 'sun') out.sun = hours
  }
  return out
}

function pickAddressComponent(
  components: AddressComponent[] | undefined,
  type: string,
): string | undefined {
  if (!components) return undefined
  const found = components.find((c) => c.types?.includes(type))
  return found?.longText ?? found?.shortText ?? undefined
}

export function mapPlaceDetailsToProfile(raw: unknown): BusinessProfile {
  const p = (raw ?? {}) as RawPlaceDetails

  const displayName =
    typeof p.displayName === 'string'
      ? p.displayName
      : p.displayName?.text ?? ''

  const components = p.addressComponents
  const city =
    pickAddressComponent(components, 'administrative_area_level_2') ??
    pickAddressComponent(components, 'locality') ??
    ''
  const state =
    pickAddressComponent(components, 'administrative_area_level_1') ?? ''
  const zipCode = pickAddressComponent(components, 'postal_code')

  // Categorias e serviços
  const types = Array.isArray(p.types) ? p.types : []
  const categories: string[] = []
  const services: string[] = []
  for (const t of types) {
    const cat = GOOGLE_TYPE_MAP[t]
    if (cat && !categories.includes(cat)) categories.push(cat)
    const svc = SERVICE_FROM_TYPE[t]
    if (svc && !services.includes(svc)) services.push(svc)
  }

  // Horários
  let businessHours: BusinessHours | undefined
  if (p.regularOpeningHours) {
    const mapped = mapWeekdayText(p.regularOpeningHours.periods ?? [])
    if (p.regularOpeningHours.weekdayDescriptions?.length) {
      mapped.text = p.regularOpeningHours.weekdayDescriptions
    }
    if (
      mapped.mon || mapped.tue || mapped.wed || mapped.thu ||
      mapped.fri || mapped.sat || mapped.sun || mapped.text?.length
    ) {
      businessHours = mapped
    }
  }

  // Foto (apenas o resource name; usar /v1/{name}/media para baixar)
  const logoUrl = p.photos?.[0]?.name

  const profile: BusinessProfile = {
    placeId: p.id ?? '',
    name: displayName,
    address: p.formattedAddress ?? '',
    city,
    state,
    zipCode: zipCode || undefined,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? undefined,
    website: p.websiteUri ?? undefined,
    businessHours,
    categories,
    services,
    rating: typeof p.rating === 'number' ? p.rating : undefined,
    reviewCount:
      typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined,
    logoUrl: logoUrl || undefined,
    rawData: (raw as Record<string, unknown>) ?? undefined,
  }
  return profile
}

const PT_DAY: Record<keyof Omit<BusinessHours, 'text'>, string> = {
  mon: 'Seg',
  tue: 'Ter',
  wed: 'Qua',
  thu: 'Qui',
  fri: 'Sex',
  sat: 'Sáb',
  sun: 'Dom',
}

export function formatBusinessHoursText(hours: BusinessHours): string {
  if (hours.text?.length) return hours.text.join(' · ')
  const order: Array<keyof Omit<BusinessHours, 'text'>> = [
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  ]
  const parts: string[] = []
  for (const key of order) {
    const h = hours[key]
    if (h) parts.push(`${PT_DAY[key]}: ${h.open} às ${h.close}`)
  }
  return parts.join(', ')
}
