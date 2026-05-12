// lib/onboarding/knowledge-generator.ts — Gera os primeiros chunks da knowledge
// base a partir do perfil do negócio (SPEC §3.3).

import type {
  BusinessProfile,
  KnowledgeChunk,
  WorkspaceUnit,
} from '@/lib/onboarding/types'
import { formatBusinessHoursText } from '@/lib/onboarding/places-mapper'

const SOURCE = 'google_places_onboarding' as const

function joinAddress(profile: BusinessProfile): string {
  const parts = [profile.address]
  if (profile.city) parts.push(profile.city)
  if (profile.state) parts.push(profile.state)
  if (profile.zipCode) parts.push(`CEP ${profile.zipCode}`)
  return parts.filter(Boolean).join(', ')
}

export function generateBusinessKnowledgeChunks(
  profile: BusinessProfile,
  units: WorkspaceUnit[],
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = []
  const categoryWord =
    profile.categories[0]?.toLowerCase() ?? 'negócio'

  // [1] Identidade
  const identityParts: string[] = []
  identityParts.push(
    `${profile.name} é uma ${categoryWord} localizada em ${joinAddress(profile)}.`,
  )
  if (profile.phone) identityParts.push(`Telefone: ${profile.phone}.`)
  if (profile.website) identityParts.push(`Site: ${profile.website}.`)
  chunks.push({
    title: 'Identidade do Negócio',
    content: identityParts.join(' '),
    source: SOURCE,
  })

  // [2] Horários
  if (profile.businessHours) {
    const text = formatBusinessHoursText(profile.businessHours)
    if (text) {
      chunks.push({
        title: 'Horários de Funcionamento',
        content: `${profile.name} funciona nos seguintes horários: ${text}.`,
        source: SOURCE,
      })
    }
  }

  // [3] Produtos / serviços
  if (profile.services.length > 0) {
    chunks.push({
      title: 'Produtos e Serviços',
      content: `${profile.name} oferece: ${profile.services.join(', ')}.`,
      source: SOURCE,
    })
  }

  // [4] Categorias (sempre útil)
  if (profile.categories.length > 0) {
    chunks.push({
      title: 'Categorias',
      content: `${profile.name} se enquadra nas categorias: ${profile.categories.join(', ')}.`,
      source: SOURCE,
    })
  }

  // [5] Contatos
  const contactParts: string[] = []
  if (profile.phone) contactParts.push(`telefone ${profile.phone}`)
  if (profile.website) contactParts.push(`site ${profile.website}`)
  if (contactParts.length > 0) {
    chunks.push({
      title: 'Contatos',
      content: `Para falar com ${profile.name}: ${contactParts.join(' · ')}.`,
      source: SOURCE,
    })
  }

  // [6] Avaliações
  if (typeof profile.rating === 'number') {
    const reviewBit = profile.reviewCount
      ? ` com ${profile.reviewCount} avaliações de clientes`
      : ''
    chunks.push({
      title: 'Avaliação e Reputação',
      content: `${profile.name} possui avaliação de ${profile.rating} estrelas no Google${reviewBit}.`,
      source: SOURCE,
    })
  }

  // [7] Unidades (se rede)
  if (units.length > 1) {
    const list = units
      .map((u) => `${u.name} — ${u.address}${u.city ? `, ${u.city}` : ''}${u.state ? `/${u.state}` : ''}`)
      .join('; ')
    chunks.push({
      title: 'Unidades',
      content: `${profile.name} possui ${units.length} unidades: ${list}.`,
      source: SOURCE,
    })
  }

  return chunks
}
