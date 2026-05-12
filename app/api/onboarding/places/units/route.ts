// app/api/onboarding/places/units/route.ts
// Text Search (New) — busca todas as unidades de uma rede pelo nome.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { UnitSearchResult } from '@/lib/onboarding/types'

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
].join(',')

type AddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

type Place = {
  id?: string
  displayName?: { text?: string } | string
  formattedAddress?: string
  addressComponents?: AddressComponent[]
}

type SearchTextResponse = {
  places?: Place[]
}

function pickComponent(
  components: AddressComponent[] | undefined,
  type: string,
): string {
  if (!components) return ''
  const found = components.find((c) => c.types?.includes(type))
  return found?.longText ?? found?.shortText ?? ''
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const name = req.nextUrl.searchParams.get('name')?.trim() ?? ''
  if (name.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.warn('[places/units] GOOGLE_PLACES_API_KEY ausente.')
    return NextResponse.json({ results: [] })
  }

  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: name,
        languageCode: 'pt-BR',
        regionCode: 'BR',
        maxResultCount: 20,
        includedType: 'pharmacy',
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error('[places/units] HTTP', resp.status, txt)
      return NextResponse.json({ results: [] })
    }

    const json = (await resp.json()) as SearchTextResponse
    const places = json.places ?? []
    const target = normalize(name)
    const results: UnitSearchResult[] = []

    for (const p of places) {
      if (!p.id) continue
      const placeName =
        typeof p.displayName === 'string'
          ? p.displayName
          : p.displayName?.text ?? ''
      // Filtro por similaridade — o nome retornado precisa conter a query.
      if (placeName && !normalize(placeName).includes(target)) continue
      results.push({
        place_id: p.id,
        name: placeName,
        address: p.formattedAddress ?? '',
        city:
          pickComponent(p.addressComponents, 'administrative_area_level_2') ||
          pickComponent(p.addressComponents, 'locality'),
        state: pickComponent(p.addressComponents, 'administrative_area_level_1'),
      })
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[places/units] erro:', err)
    return NextResponse.json({ results: [] })
  }
}
