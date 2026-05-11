// TODO: substituir Bearer ADMIN_TOKEN por auth proper (RBAC) na fase de produção

import { NextRequest, NextResponse } from 'next/server'

/**
 * Valida o token de admin do header Authorization: Bearer <token>.
 * Retorna NextResponse com erro se inválido, ou null se autorizado.
 */
export function requireAdminToken(req: NextRequest): NextResponse | null {
  const adminToken = process.env.ADMIN_TOKEN

  if (!adminToken) {
    return NextResponse.json({ error: 'admin_disabled' }, { status: 503 })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || token !== adminToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return null
}
