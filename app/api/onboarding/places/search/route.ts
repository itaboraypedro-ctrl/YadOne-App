// app/api/onboarding/places/search/route.ts
// Autocomplete da Google Places API (New). Server-only — a chave nunca vaza.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SearchResult } from '@/lib/onboarding/types'

const ENDPOINT = 'https://places.googleapis.com/v1/places:autocomplete'

type AutocompleteSuggestion = {
  placePrediction?: {
    placeId?: string
    structuredFormat?: {
      mainText?: { text?: string }
      secondaryText?: { text?: string }
    }
    text?: { text?: string }
  }
}

type AutocompleteResponse = {
  suggestions?: AutocompleteSuggestion[]
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json(
      { results: [] },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.warn('[places/search] GOOGLE_PLACES_API_KEY ausente — retornando vazio.')
    return NextResponse.json({ results: [] })
  }

  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input: q,
        languageCode: 'pt-BR',
        regionCode: 'BR',
        includedPrimaryTypes: ['establishment'],
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error('[places/search] HTTP', resp.status, txt)
      return NextResponse.json({ results: [] })
    }

    const json = (await resp.json()) as AutocompleteResponse
    const suggestions = json.suggestions ?? []
    const results: SearchResult[] = []
    for (const s of suggestions) {
      const p = s.placePrediction
      if (!p?.placeId) continue
      const name =
        p.structuredFormat?.mainText?.text ?? p.text?.text ?? ''
      const address = p.structuredFormat?.secondaryText?.text ?? ''
      results.push({
        place_id: p.placeId,
        name,
        address,
        description: p.text?.text,
      })
      if (results.length >= 5) break
    }

    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch (err) {
    console.error('[places/search] erro:', err)
    return NextResponse.json({ results: [] })
  }
}
