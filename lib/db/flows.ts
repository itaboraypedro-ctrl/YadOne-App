// lib/db/flows.ts — Fluxos, nós, arestas, knowledge tags, tool policies
// Inclui getFlowAtVersion + getFlowForSession (gap #11 — sessões fixam flow_version)
// TODO: substituir tipos inline por import from '@/types/flow' após merge da T02.

import { supabase } from './client'

interface Flow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  trigger_keywords: string[] | null
  trigger_products: string[] | null
  status: string
  is_default: boolean
  version: number
  parent_version_id: string | null
  created_at: string
  updated_at: string
}

interface FlowNode {
  id: string
  flow_id: string
  type: string
  label: string | null
  config: Record<string, unknown>
  position_x: number | null
  position_y: number | null
  created_at: string
}

interface FlowEdge {
  id: string
  flow_id: string
  source_node_id: string
  target_node_id: string
  label: string | null
  condition: Record<string, unknown> | null
  is_default: boolean
  created_at: string
}

interface FlowToolPolicy {
  flow_id: string
  tool_id: string
  allowed: boolean
  created_at: string
}

interface NodeKnowledgeTag {
  node_id: string
  knowledge_tag: string
}

interface SessionLike {
  flow_id: string | null
  flow_version: number | null
}

export async function getActiveFlow(workspace_id: string): Promise<Flow | null> {
  const { data, error } = await supabase
    .from('flows')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('status', 'active')
    .eq('is_default', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`getActiveFlow(${workspace_id}) failed: ${error.message}`)
  return (data as Flow) ?? null
}

export async function getFlow(flow_id: string): Promise<Flow | null> {
  const { data, error } = await supabase.from('flows').select('*').eq('id', flow_id).maybeSingle()
  if (error) throw new Error(`getFlow(${flow_id}) failed: ${error.message}`)
  return (data as Flow) ?? null
}

export async function getFlowAtVersion(flow_id: string, version: number): Promise<Flow | null> {
  // Tenta resolver pela linhagem parent_version_id se a versão atual não bate.
  const current = await getFlow(flow_id)
  if (!current) return null
  if (current.version === version) return current

  // Caso versão alvo seja diferente, busca via flow_snapshots para reconstrução.
  const { data: snap, error } = await supabase
    .from('flow_snapshots')
    .select('snapshot')
    .eq('flow_id', flow_id)
    .eq('version', version)
    .maybeSingle()
  if (error) throw new Error(`getFlowAtVersion(${flow_id}, ${version}) failed: ${error.message}`)
  if (!snap) return null
  const payload = snap.snapshot as { flow?: Flow }
  return (payload?.flow as Flow) ?? null
}

export async function getFlowForSession(session: SessionLike): Promise<Flow | null> {
  if (!session.flow_id) return null
  if (session.flow_version === null || session.flow_version === undefined) {
    return getFlow(session.flow_id)
  }
  return getFlowAtVersion(session.flow_id, session.flow_version)
}

export async function getFlowNodes(flow_id: string): Promise<FlowNode[]> {
  const { data, error } = await supabase.from('flow_nodes').select('*').eq('flow_id', flow_id)
  if (error) throw new Error(`getFlowNodes(${flow_id}) failed: ${error.message}`)
  return (data as FlowNode[]) ?? []
}

export async function getFlowEdges(flow_id: string): Promise<FlowEdge[]> {
  const { data, error } = await supabase.from('flow_edges').select('*').eq('flow_id', flow_id)
  if (error) throw new Error(`getFlowEdges(${flow_id}) failed: ${error.message}`)
  return (data as FlowEdge[]) ?? []
}

export async function getNodeTags(node_id: string): Promise<NodeKnowledgeTag[]> {
  const { data, error } = await supabase
    .from('node_knowledge_tags')
    .select('*')
    .eq('node_id', node_id)
  if (error) throw new Error(`getNodeTags(${node_id}) failed: ${error.message}`)
  return (data as NodeKnowledgeTag[]) ?? []
}

export async function getFlowToolPolicies(flow_id: string): Promise<FlowToolPolicy[]> {
  const { data, error } = await supabase
    .from('flow_tool_policies')
    .select('*')
    .eq('flow_id', flow_id)
  if (error) throw new Error(`getFlowToolPolicies(${flow_id}) failed: ${error.message}`)
  return (data as FlowToolPolicy[]) ?? []
}
