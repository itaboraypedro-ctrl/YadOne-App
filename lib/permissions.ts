export type PermissionLevel = 'none' | 'view' | 'edit'
export type ModuleId = 'chat' | 'flows' | 'ai_config' | 'crm' | 'settings'
export type PermissionsMap = Record<ModuleId, PermissionLevel>

export type WorkspaceRole = 'owner' | 'professional'

export const AREAS_ALWAYS_BLOCKED_FOR_PROFESSIONAL = [
  'flows', 'ai_config', 'billing', 'settings'
] as const

export type ProfessionalPermissionArea = 'agenda' | 'crm' | 'conversas' | 'relatorios' | 'produtos'
export type ProfessionalPermissions = Record<ProfessionalPermissionArea, PermissionLevel>
export const PROFESSIONAL_AREAS: { id: ProfessionalPermissionArea; label: string }[] = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'crm', label: 'CRM' },
  { id: 'conversas', label: 'Conversas' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'produtos', label: 'Produtos' },
]
export const DEFAULT_PROFESSIONAL_PERMISSIONS: ProfessionalPermissions = {
  agenda: 'none', crm: 'none', conversas: 'none', relatorios: 'none', produtos: 'none'
}

export const MODULES: { id: ModuleId; label: string; icon: string; route: string }[] = [
  { id: 'chat', label: 'Chat', icon: '💬', route: '/conversations' },
  { id: 'flows', label: 'Automações', icon: '⚙️', route: '/flows' },
  { id: 'ai_config', label: 'IA e Dados', icon: '🤖', route: '/ai-config' },
  { id: 'crm', label: 'CRM', icon: '📊', route: '/crm' },
  { id: 'settings', label: 'Configurações', icon: '🔧', route: '/settings' },
]

export const DEFAULT_PERMISSIONS: PermissionsMap = {
  chat: 'none',
  flows: 'none',
  ai_config: 'none',
  crm: 'none',
  settings: 'none',
}

export const LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
}

export function normalizePermissions(raw: unknown): PermissionsMap {
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

export function comparePermission(have: PermissionLevel, need: PermissionLevel): boolean {
  return LEVEL_RANK[have] >= LEVEL_RANK[need]
}
