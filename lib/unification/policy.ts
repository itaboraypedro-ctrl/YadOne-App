// lib/unification/policy.ts — Política de unificação cross-channel (gap #3 / T28).
//
// MVP: política hardcoded como 'phone' por workspace. Não há ainda coluna
// `unification_policy` em `workspaces` nem em `workspace_agent_config`.
// TODO: adicionar coluna `unification_policy TEXT NOT NULL DEFAULT 'phone'` em
// `workspaces` (ou em `workspace_agent_config`) e ler dela aqui. Migration futura.

export type UnificationStrategy = 'phone' | 'email' | 'manual_link' | 'disabled'

export interface WorkspaceUnificationPolicy {
  strategy: UnificationStrategy
}

const DEFAULT_STRATEGY: UnificationStrategy = 'phone'

/**
 * Retorna a política de unificação do workspace.
 * MVP: sempre retorna o default 'phone' — fallback hardcoded até existir
 * persistência da política no schema. O parâmetro `_workspace_id` é mantido
 * para evitar breaking change quando a coluna for adicionada.
 */
export async function getWorkspaceUnificationPolicy(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _workspace_id: string,
): Promise<WorkspaceUnificationPolicy> {
  return { strategy: DEFAULT_STRATEGY }
}
