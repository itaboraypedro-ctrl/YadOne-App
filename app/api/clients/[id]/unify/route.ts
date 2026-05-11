// app/api/clients/[id]/unify/route.ts — Endpoint para unificar dois clients (T28).
//
// POST /api/clients/{primary_id}/unify
// Body: { secondary_id: string }
// TODO: adicionar auth Bearer + verificação de workspace do operador (T29).

import { NextRequest, NextResponse } from 'next/server'
import { mergeClients } from '@/lib/unification/merger'
import { supabase } from '@/lib/db/client'

interface UnifyBody {
  secondary_id?: string
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: primary_id } = await ctx.params

  let body: UnifyBody
  try {
    body = (await req.json()) as UnifyBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const secondary_id = body.secondary_id
  if (!secondary_id || typeof secondary_id !== 'string') {
    return NextResponse.json(
      { error: 'secondary_id is required (string)' },
      { status: 400 },
    )
  }

  if (secondary_id === primary_id) {
    return NextResponse.json(
      { error: 'primary and secondary must differ' },
      { status: 400 },
    )
  }

  // Deriva workspace_id do primary client.
  // TODO: substituir por auth proper (Bearer + claim de workspace) em T29.
  const { data: primaryRow, error: lookupErr } = await supabase
    .from('clients')
    .select('workspace_id')
    .eq('id', primary_id)
    .maybeSingle()
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 })
  }
  if (!primaryRow) {
    return NextResponse.json({ error: 'primary client not found' }, { status: 404 })
  }
  const workspace_id = primaryRow.workspace_id as string

  try {
    const result = await mergeClients(workspace_id, primary_id, secondary_id)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
