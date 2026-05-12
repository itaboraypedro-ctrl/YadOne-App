'use client'

// hooks/useWorkspacePermissions.ts — hook client-side que carrega role e
// permissões do usuário logado a partir de workspace_users e expõe `can(...)`.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_PERMISSIONS,
  type ModuleId,
  type PermissionLevel,
  type PermissionsMap,
} from '@/lib/permissions'

export type WorkspaceRole = 'owner' | 'professional'

export interface UseWorkspacePermissionsResult {
  role: WorkspaceRole | null
  permissions: PermissionsMap
  isOwner: boolean
  can: (module: ModuleId, level: PermissionLevel) => boolean
  loading: boolean
}

const LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
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

export function useWorkspacePermissions(): UseWorkspacePermissionsResult {
  const [role, setRole] = useState<WorkspaceRole | null>(null)
  const [permissions, setPermissions] = useState<PermissionsMap>({
    ...DEFAULT_PERMISSIONS,
  })
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) {
            setRole(null)
            setPermissions({ ...DEFAULT_PERMISSIONS })
          }
          return
        }
        const { data, error } = await supabase
          .from('workspace_users')
          .select('role, permissions')
          .eq('user_id', user.id)
          .maybeSingle()
        if (cancelled) return
        if (error || !data) {
          setRole(null)
          setPermissions({ ...DEFAULT_PERMISSIONS })
          return
        }
        const r = data.role as string
        const normalizedRole: WorkspaceRole | null =
          r === 'owner' || r === 'professional' ? r : null
        setRole(normalizedRole)
        setPermissions(normalizePermissions(data.permissions))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const isOwner = role === 'owner'

  const can = useCallback(
    (module: ModuleId, level: PermissionLevel): boolean => {
      if (isOwner) return true
      const have = permissions[module]
      return LEVEL_RANK[have] >= LEVEL_RANK[level]
    },
    [isOwner, permissions],
  )

  return useMemo(
    () => ({ role, permissions, isOwner, can, loading }),
    [role, permissions, isOwner, can, loading],
  )
}

export default useWorkspacePermissions
