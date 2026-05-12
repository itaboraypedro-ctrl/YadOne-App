// components/layout/Sidebar.tsx — Sidebar lateral autenticada (server component).
// Renderiza logo + nome do workspace, lista de módulos com base nas permissões
// e rodapé com avatar/UserMenu. Apenas dados server-side (RLS) atravessam.

import Image from 'next/image'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  DEFAULT_PROFESSIONAL_PERMISSIONS,
  MODULES,
  type ModuleId,
  type PermissionLevel,
  type PermissionsMap,
  type ProfessionalPermissions,
  type WorkspaceRole,
} from '@/lib/permissions'
import { SidebarItem } from '@/components/layout/SidebarItem'
import UserMenu from '@/components/layout/UserMenu'
import { cn } from '@/lib/utils'

interface WorkspaceUserRow {
  id: string
  role: string | null
  workspace_id: string | null
}

interface ProfessionalPermissionsRow {
  agenda: PermissionLevel | null
  crm: PermissionLevel | null
  conversas: PermissionLevel | null
  relatorios: PermissionLevel | null
  produtos: PermissionLevel | null
}

interface WorkspaceRow {
  name: string | null
}

interface UserProfileRow {
  full_name: string | null
  avatar_url: string | null
}

function normalizeLevel(v: unknown): PermissionLevel {
  return v === 'view' || v === 'edit' || v === 'none' ? v : 'none'
}

function buildProfessionalPermissions(
  row: ProfessionalPermissionsRow | null,
): ProfessionalPermissions {
  if (!row) return { ...DEFAULT_PROFESSIONAL_PERMISSIONS }
  return {
    agenda: normalizeLevel(row.agenda),
    crm: normalizeLevel(row.crm),
    conversas: normalizeLevel(row.conversas),
    relatorios: normalizeLevel(row.relatorios),
    produtos: normalizeLevel(row.produtos),
  }
}

function permissionsFor(
  role: WorkspaceRole | null,
  profPerms: ProfessionalPermissions,
): PermissionsMap {
  if (role === 'owner') {
    return {
      chat: 'edit',
      flows: 'edit',
      ai_config: 'edit',
      crm: 'edit',
      settings: 'edit',
    }
  }
  return {
    chat: profPerms.conversas,
    crm: profPerms.crm,
    flows: 'none',
    ai_config: 'none',
    settings: 'view',
  }
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
    .select('id, role, workspace_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle<WorkspaceUserRow>()

  const role: WorkspaceRole | null =
    wuRaw?.role === 'owner' || wuRaw?.role === 'professional'
      ? wuRaw.role
      : null

  let profPerms: ProfessionalPermissions = { ...DEFAULT_PROFESSIONAL_PERMISSIONS }
  if (role === 'professional' && wuRaw?.id) {
    const { data: ppRow } = await supabase
      .from('professional_permissions')
      .select('agenda, crm, conversas, relatorios, produtos')
      .eq('workspace_user_id', wuRaw.id)
      .maybeSingle<ProfessionalPermissionsRow>()
    profPerms = buildProfessionalPermissions(ppRow ?? null)
  }

  const permissions: PermissionsMap = permissionsFor(role, profPerms)

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
          {MODULES.map((mod: { id: ModuleId; label: string; icon: string; route: string }) => {
            const level = permissions[mod.id]
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
