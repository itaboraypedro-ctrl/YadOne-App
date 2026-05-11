// app/api/clients/[id]/memory/route.ts — GET memória semântica + episódica do cliente.
// SPEC_FRONTEND_CONVERSATIONS.md §3.4 (F17 — painel lateral).

import { NextRequest, NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'
import type { Client } from '@/types/client'

export const dynamic = 'force-dynamic'

interface SemanticRow {
  memory_summary: string | null
  preferred_name: string | null
  preferences: unknown
  last_service: string | null
  observations: string | null
  raw_insights: Record<string, unknown> | null
  updated_at: string
}

interface EpisodicRow {
  id: string
  excerpt_summary: string | null
  topic_tags: string[] | null
  occurred_at: string
}

export interface ClientMemoryResponse {
  client: {
    id: string
    name: string | null
    phone: string
    email: string | null
    notes: string | null
    crm_status: string
    created_at: string
  }
  memory: {
    preferred_name: string | null
    preferences: string[]
    last_service: string | null
    observations: string | null
    memory_summary: string | null
    semantic_facts: Array<{ text: string; created_at: string; tags?: string[] }>
    updated_at: string | null
  } | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { svc, workspace_id } = auth.ctx
  const { id } = await params

  const { data: clientRow, error: cErr } = await svc
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (cErr) {
    return NextResponse.json(
      { error: 'clients_query_failed', detail: cErr.message },
      { status: 500 },
    )
  }
  if (!clientRow || (clientRow as Client).workspace_id !== workspace_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const client = clientRow as Client

  const [semanticRes, episodicRes] = await Promise.all([
    svc
      .from('client_memory')
      .select(
        'memory_summary, preferred_name, preferences, last_service, observations, raw_insights, updated_at',
      )
      .eq('client_id', id)
      .eq('workspace_id', workspace_id)
      .maybeSingle(),
    svc
      .from('client_episodic_memory')
      .select('id, excerpt_summary, topic_tags, occurred_at')
      .eq('client_id', id)
      .eq('workspace_id', workspace_id)
      .order('occurred_at', { ascending: false })
      .limit(10),
  ])

  const semantic = (semanticRes.data as SemanticRow | null) ?? null
  const episodes = (episodicRes.data as EpisodicRow[] | null) ?? []

  // Normaliza preferences (pode vir como array, JSON string, ou objeto).
  let preferences: string[] = []
  if (semantic) {
    const raw = semantic.preferences
    if (Array.isArray(raw)) {
      preferences = raw.filter((x): x is string => typeof x === 'string')
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          preferences = parsed.filter(
            (x): x is string => typeof x === 'string',
          )
        }
      } catch {
        // string solta — trata como única preferência
        if (raw.trim()) preferences = [raw]
      }
    }
  }

  const semanticFacts = episodes
    .filter((e) => !!e.excerpt_summary)
    .map((e) => ({
      text: e.excerpt_summary as string,
      created_at: e.occurred_at,
      tags: e.topic_tags ?? [],
    }))

  const payload: ClientMemoryResponse = {
    client: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      notes: client.notes,
      crm_status: client.crm_status,
      created_at: client.created_at,
    },
    memory: semantic
      ? {
          preferred_name: semantic.preferred_name,
          preferences,
          last_service: semantic.last_service,
          observations: semantic.observations,
          memory_summary: semantic.memory_summary,
          semantic_facts: semanticFacts,
          updated_at: semantic.updated_at,
        }
      : semanticFacts.length > 0
        ? {
            preferred_name: null,
            preferences: [],
            last_service: null,
            observations: null,
            memory_summary: null,
            semantic_facts: semanticFacts,
            updated_at: null,
          }
        : null,
  }

  return NextResponse.json(payload)
}
