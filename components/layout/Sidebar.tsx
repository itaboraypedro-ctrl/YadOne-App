// components/layout/Sidebar.tsx — Sidebar lateral autenticada (server component).
// Renderiza logo + nome do workspace, lista de módulos com base nas permissões
// e rodapé com avatar/UserMenu. Apenas dados server-side (RLS) atravessam.

import Image from 'next/image'
import Link from 'next/link'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  DEFAULT_PERMISSIONS,
  MODULES,
  type ModuleId,
  type PermissionLevel,
  type PermissionsMap,
} from '@/lib/permissions'
import { SidebarItem } from '@/components/layout/SidebarItem'
import UserMenu from '@/components/layout/UserMenu'
import { cn } from '@/lib/utils'

type WorkspaceRole = 'owner' | 'member' | 'agent'

interface WorkspaceUserRow {
  role: string | null
  permissions: unknown
  workspace_id: string | null
}

interface WorkspaceRow {
  name: string | null
}

interface UserProfileRow {
  full_name: string | null
  avatar_url: string | null
}

function normalizePermissions(raw: unknown): PermissionsMap {
  const out: PermissionsMap = { ...DEFAULT_PERMISSIONS }
  if (!raw || typeof raw !== 'object') return out
  const obj = raw as Record<string, unknown>
  for (const mod of Object.keys(out) as ModuleId[]) {
    const v = obj[mod]
    if (v === 'view' || v === 'edit' || v === 'none') {
      out[mod] = v
    }
  }
  return out
}

function resolvePermission(
  role: WorkspaceRole | null,
  perms: PermissionsMap,
  moduleId: ModuleId,
): PermissionLevel {
  if (role === 'owner') return 'edit'
  // Settings: qualquer usuário autenticado vê o item raiz.
  if (moduleId === 'settings') {
    const stored = perms[moduleId]
    return stored === 'none' ? 'view' : stored
  }
  return perms[moduleId]
}

export async function Sidebar() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Layout autenticado já garante redirect — defesa em profundidade.
  if (!user) {
    return null
  }

  const { data: wuRaw } = await supabase
    .from('workspace_users')
    .select('role, permissions, workspace_id')
    .eq('user_id', user.id)
    .maybeSingle<WorkspaceUserRow>()

  const role: WorkspaceRole | null =
    wuRaw?.role === 'owner' || wuRaw?.role === 'member' || wuRaw?.role === 'agent'
      ? wuRaw.role
      : null

  const permissions: PermissionsMap = normalizePermissions(wuRaw?.permissions)

  let workspaceName = ''
  if (wuRaw?.workspace_id) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', wuRaw.workspace_id)
      .maybeSingle<WorkspaceRow>()
    workspaceName = ws?.name ?? ''
  }

  // user_profiles é opcional — fallback gracioso.
  let profile: UserProfileRow | null = null
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle<UserProfileRow>()
    profile = data ?? null
  } catch {
    profile = null
  }

  const email = user.email ?? ''
  const fullName = profile?.full_name ?? email
  const avatarUrl = profile?.avatar_url ?? null
  const isOwner = role === 'owner'

  return (
    <aside
      className={cn(
        'w-[240px] shrink-0 h-screen hidden md:flex flex-col',
        'bg-sidebar border-r border-sidebar-border',
      )}
    >
      {/* Topo: logo + nome do workspace */}
      <div className="flex flex-col gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="relative size-8 shrink-0">
            <Image
              src="/yadone/yadone-logo.png"
              alt="Yadone"
              fill
              sizes="32px"
              className="object-contain"
              priority
            />
          </div>
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            Yadone
          </span>
        </div>
        {workspaceName ? (
          <div className="truncate text-xs text-sidebar-foreground/60">
            {workspaceName}
          </div>
        ) : null}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navegação principal */}
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 px-2 py-3">
          {MODULES.map((mod) => {
            const level = resolvePermission(role, permissions, mod.id)
            return (
              <SidebarItem
                key={mod.id}
                icon={mod.icon}
                label={mod.label}
                href={mod.route}
                permission={level}
              />
            )
          })}
          {isOwner ? (
            <SidebarItem
              icon="💳"
              label="Financeiro"
              href="/settings/billing"
              permission="edit"
              indent
            />
          ) : null}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* Rodapé: avatar + UserMenu */}
      <div className="px-2 py-2">
        <UserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} />
      </div>
    </aside>
  )
}
