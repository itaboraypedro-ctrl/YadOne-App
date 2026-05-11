// TODO: substituir Bearer ADMIN_TOKEN por auth proper (RBAC) na fase de produção

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/app/api/admin/_auth'
import { supabase } from '@/lib/db/client'
import type { Client } from '@/types/client'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = requireAdminToken(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)

  const workspace_id = searchParams.get('workspace_id')
  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
  }

  const phone = searchParams.get('phone')
  const email = searchParams.get('email')
  const q = searchParams.get('q')
  const limitParam = parseInt(searchParams.get('limit') ?? '50', 10)
  const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10)

  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 200)
  const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam)

  let query = supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', workspace_id)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (phone) {
    query = query.eq('phone', phone)
  }

  if (email) {
    query = query.eq('email', email)
  }

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ clients: (data ?? []) as unknown as Client[] })
}
