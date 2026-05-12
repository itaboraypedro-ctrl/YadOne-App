// middleware.ts — Auth gate via Supabase SSR. Protege rotas privadas, libera públicas.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Prefixos públicos que não exigem sessão. Webhooks/cron/admin/engine/knowledge/tools/flows/clients
 * são endpoints internos com auth própria (HMAC, service role, cron secret) e NÃO devem passar
 * pelo gate de sessão de usuário do Supabase.
 */
const PUBLIC_API_PREFIXES = [
  '/api/auth',
  '/api/webhooks',
  '/api/cron',
  '/api/admin',
  '/api/engine',
  '/api/knowledge',
  '/api/tools',
  '/api/flows',
  '/api/clients',
]

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  if (pathname === '/login' || pathname.startsWith('/login/')) return true
  if (pathname === '/unauthorized' || pathname.startsWith('/unauthorized/')) return false
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return true
  }
  return false
}

const OWNER_ONLY_SETTINGS_PATHS = [
  '/settings/workspace',
  '/settings/team',
  '/settings/billing',
]

const BLOCKED_FOR_PROFESSIONAL_PATHS = [
  '/flows',
  '/ai-config',
]

function isOwnerOnlySettingsPath(pathname: string): boolean {
  for (const p of OWNER_ONLY_SETTINGS_PATHS) {
    if (pathname === p || pathname.startsWith(p + '/')) return true
  }
  return false
}

function isBlockedForProfessionalPath(pathname: string): boolean {
  for (const p of BLOCKED_FOR_PROFESSIONAL_PATHS) {
    if (pathname === p || pathname.startsWith(p + '/')) return true
  }
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Resposta base — todas as mutações de cookie do Supabase serão propagadas para cá.
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    // Sem env: deixa passar para evitar quebrar build/dev local sem secrets configurados.
    return response
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // IMPORTANTE: chamar getUser() refresca a sessão e propaga cookies via setAll acima.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Rota /login: se já logado, redireciona para /conversations.
  if (pathname === '/login' || pathname.startsWith('/login/')) {
    if (user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/conversations'
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl)
    }
    return response
  }

  // Rotas públicas (APIs internas) — passam sem checagem.
  if (isPublicPath(pathname)) {
    return response
  }

  // Demais rotas: exigem sessão.
  if (!user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  // Owner-only settings + paths bloqueados pra professional: ambos requerem role.
  const needsRoleCheck =
    isOwnerOnlySettingsPath(pathname) || isBlockedForProfessionalPath(pathname)

  if (needsRoleCheck) {
    const { data: membership } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    const role = membership?.role

    if (isOwnerOnlySettingsPath(pathname) && role !== 'owner') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/unauthorized'
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl)
    }

    if (isBlockedForProfessionalPath(pathname) && role === 'professional') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/unauthorized'
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
