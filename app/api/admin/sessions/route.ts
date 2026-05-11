// TODO: substituir Bearer ADMIN_TOKEN por auth proper (RBAC) na fase de produção

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/app/api/admin/_auth'
import { supabase } from '@/lib/db/client'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = requireAdminToken(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)

  const workspace_id = searchParams.get('workspace_id')
  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
  }

  const status = searchParams.get('status')
  const date_from = searchParams.get('date_from')
  const limitParam = parseInt(searchParams.get('limit') ?? '50', 10)
  const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10)

  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 200)
  const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam)

  // Validate date_from if provided
  if (date_from && new Date(date_from).toString() === 'Invalid Date') {
    return NextResponse.json({ error: 'date_from is not a valid ISO 8601 date' }, { status: 400 })
  }

  let query = supabase
    .from('sessions')
    .select('*, clients(id, phone, name)')
    .eq('workspace_id', workspace_id)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (date_from) {
    query = query.gte('updated_at', date_from)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sessions: data ?? [] })
}
