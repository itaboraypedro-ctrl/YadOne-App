// app/api/onboarding/places/details/route.ts
// Place Details (New) — retorna BusinessProfile mapeado.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { mapPlaceDetailsToProfile } from '@/lib/onboarding/places-mapper'

const FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'addressComponents',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'regularOpeningHours',
  'rating',
  'userRatingCount',
  'types',
  'photos',
].join(',')

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const placeId = req.nextUrl.searchParams.get('place_id')?.trim() ?? ''
  if (!placeId) {
    return NextResponse.json({ error: 'place_id é obrigatório' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.warn('[places/details] GOOGLE_PLACES_API_KEY ausente.')
    return NextResponse.json({ profile: null })
  }

  try {
    const resp = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR&regionCode=BR`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
      },
    )

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error('[places/details] HTTP', resp.status, txt)
      return NextResponse.json({ profile: null })
    }

    const raw = (await resp.json()) as unknown
    const profile = mapPlaceDetailsToProfile(raw)
    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[places/details] erro:', err)
    return NextResponse.json({ profile: null })
  }
}
