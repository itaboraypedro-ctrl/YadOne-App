// app/api/flows/[id]/snapshot/route.ts — POST cria snapshot manual de um fluxo (T27).
//
// POST /api/flows/{id}/snapshot
// Body: { created_by?: string }   (default: 'manual')
// Resp: { ok: true, snapshot: { id, version, created_at } }

import { NextRequest, NextResponse } from 'next/server'
import { createSnapshot } from '@/lib/flows/snapshot-manager'

interface SnapshotBody {
  created_by?: string
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'flow id is required' }, { status: 400 })
  }

  let body: SnapshotBody = {}
  try {
    const text = await req.text()
    if (text.length > 0) body = JSON.parse(text) as SnapshotBody
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const created_by =
    typeof body.created_by === 'string' && body.created_by.length > 0
      ? body.created_by
      : 'manual'

  try {
    const snap = await createSnapshot(id, created_by)
    return NextResponse.json({
      ok: true,
      snapshot: {
        id: snap.id,
        version: snap.version,
        created_at: snap.created_at,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
