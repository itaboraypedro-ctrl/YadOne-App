// app/api/flows/[id]/rollback/[version]/route.ts — POST rollback para uma versão (T27).
//
// POST /api/flows/{id}/rollback/{version}
// Body: { created_by?: string }   (default: 'manual')
// Resp: { ok: true, restored_version, safety_snapshot_version }

import { NextRequest, NextResponse } from 'next/server'
import { restoreFromSnapshot } from '@/lib/flows/snapshot-manager'

interface RollbackBody {
  created_by?: string
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version: versionStr } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'flow id is required' }, { status: 400 })
  }
  const target_version = Number.parseInt(versionStr, 10)
  if (!Number.isFinite(target_version) || target_version <= 0) {
    return NextResponse.json(
      { error: 'version must be a positive integer' },
      { status: 400 },
    )
  }

  let body: RollbackBody = {}
  try {
    const text = await req.text()
    if (text.length > 0) body = JSON.parse(text) as RollbackBody
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const created_by =
    typeof body.created_by === 'string' && body.created_by.length > 0
      ? body.created_by
      : 'manual'

  try {
    const result = await restoreFromSnapshot(id, target_version, created_by)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
