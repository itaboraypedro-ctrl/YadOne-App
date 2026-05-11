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

  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const action = searchParams.get('action')
  const trace_id = searchParams.get('trace_id')
  const session_id = searchParams.get('session_id')
  const limitParam = parseInt(searchParams.get('limit') ?? '50', 10)
  const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10)

  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 500)
  const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam)

  // Validate date params
  if (from && new Date(from).toString() === 'Invalid Date') {
    return NextResponse.json({ error: 'from is not a valid ISO 8601 date' }, { status: 400 })
  }
  if (to && new Date(to).toString() === 'Invalid Date') {
    return NextResponse.json({ error: 'to is not a valid ISO 8601 date' }, { status: 400 })
  }

  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('workspace_id', workspace_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (from) {
    query = query.gte('created_at', from)
  }

  if (to) {
    query = query.lte('created_at', to)
  }

  if (action) {
    query = query.eq('event_type', action)
  }

  if (trace_id) {
    query = query.eq('trace_id', trace_id)
  }

  if (session_id) {
    query = query.eq('session_id', session_id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ audit_logs: data ?? [] })
}
