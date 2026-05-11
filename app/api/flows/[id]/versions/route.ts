// app/api/flows/[id]/versions/route.ts — GET lista versões salvas de um fluxo (T27).
//
// GET /api/flows/{id}/versions
// Resp: { versions: Array<{ version, created_by, created_at }> }

import { NextRequest, NextResponse } from 'next/server'
import { listVersions } from '@/lib/flows/snapshot-manager'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'flow id is required' }, { status: 400 })
  }

  try {
    const versions = await listVersions(id)
    return NextResponse.json({ versions })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
