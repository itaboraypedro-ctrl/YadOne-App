// lib/db/workspaces.ts — Workspaces e configuração do agente
// TODO: substituir tipos inline por import from '@/types/workspace' após merge da T02.

import { supabase } from './client'

interface Workspace {
  id: string
  name: string
  slug: string
  segment: string | null
  plan: string
  status: string
  created_at: string
}

interface WorkspaceAgentConfig {
  id: string
  workspace_id: string
  persona_name: string
  persona_tone: string
  persona_rules: string | null
  response_length: string
  emoji_usage: boolean
  tratamento: string
  business_info: string | null
  /** F13/migration 029: liga ou desliga IA para todo o workspace. */
  ai_enabled?: boolean
  updated_at: string
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const { data, error } = await supabase.from('workspaces').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`getWorkspace(${id}) failed: ${error.message}`)
  return (data as Workspace) ?? null
}

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const { data, error } = await supabase.from('workspaces').select('*').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`getWorkspaceBySlug(${slug}) failed: ${error.message}`)
  return (data as Workspace) ?? null
}

export async function getAgentConfig(workspace_id: string): Promise<WorkspaceAgentConfig | null> {
  const { data, error } = await supabase
    .from('workspace_agent_config')
    .select('*')
    .eq('workspace_id', workspace_id)
    .maybeSingle()
  if (error) throw new Error(`getAgentConfig(${workspace_id}) failed: ${error.message}`)
  return (data as WorkspaceAgentConfig) ?? null
}
