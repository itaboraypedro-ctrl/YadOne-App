// app/api/knowledge/route.ts — CRUD da Knowledge Base (lista + criação)
// Após create/update (PUT em /[id]) o registro fica is_indexed=false.
// O Job T21 (cron + trigger) é quem reindexa de fato.

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db/client'
import { countTokens } from '@/lib/knowledge/chunker'

interface CreateBody {
  workspace_id: string
  tag: string
  title: string
  content: string
  content_type?: 'text' | 'document' | 'url' | 'qa_pairs'
  is_global?: boolean
}

export async function GET(req: NextRequest) {
  const workspace_id = req.nextUrl.searchParams.get('workspace_id')
  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id é obrigatório' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('workspace_id', workspace_id)
    .order('updated_at', { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.workspace_id || !body.tag || !body.title || body.content === undefined) {
    return NextResponse.json(
      { error: 'workspace_id, tag, title e content são obrigatórios' },
      { status: 400 },
    )
  }

  const token_estimate = countTokens(body.content)
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('knowledge_base')
    .insert({
      workspace_id: body.workspace_id,
      tag: body.tag,
      title: body.title,
      content: body.content,
      content_type: body.content_type ?? 'text',
      is_global: body.is_global ?? false,
      is_indexed: false,
      token_estimate,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ item: data }, { status: 201 })
}
