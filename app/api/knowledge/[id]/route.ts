// app/api/knowledge/[id]/route.ts — PUT (update) e DELETE (remoção) de KB.
// PUT marca is_indexed=false e recalcula token_estimate se content mudar.
// DELETE remove o KB; o ON CASCADE em knowledge_chunks (se aplicado na migration)
// cuida dos chunks; também chamamos delete explicitamente como cinturão extra.

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db/client'
import { deleteChunksByKbId } from '@/lib/db/knowledge'
import { countTokens } from '@/lib/knowledge/chunker'

interface UpdateBody {
  tag?: string
  title?: string
  content?: string
  content_type?: 'text' | 'document' | 'url' | 'qa_pairs'
  is_global?: boolean
}

interface RouteCtx {
  params: Promise<{ id: string }>
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  }

  let body: UpdateBody
  try {
    body = (await req.json()) as UpdateBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.tag !== undefined) patch.tag = body.tag
  if (body.title !== undefined) patch.title = body.title
  if (body.content_type !== undefined) patch.content_type = body.content_type
  if (body.is_global !== undefined) patch.is_global = body.is_global
  if (body.content !== undefined) {
    patch.content = body.content
    patch.token_estimate = countTokens(body.content)
    patch.is_indexed = false // força reindexação pelo Job T21
  }

  const { data, error } = await supabase
    .from('knowledge_base')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Se conteúdo mudou, derruba os chunks antigos para evitar leitura inconsistente
  // antes do Job rodar. Job repopula assincronamente.
  if (body.content !== undefined) {
    try {
      await deleteChunksByKbId(id)
    } catch (err) {
      console.error(`[api/knowledge/[id]] deleteChunksByKbId falhou (ignorado):`, err)
    }
  }

  return NextResponse.json({ item: data })
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  }

  // Cinto + suspensório: apaga chunks antes (caso schema não tenha CASCADE).
  try {
    await deleteChunksByKbId(id)
  } catch (err) {
    console.error(`[api/knowledge/[id]] deleteChunksByKbId falhou (ignorado):`, err)
  }

  const { error } = await supabase.from('knowledge_base').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
