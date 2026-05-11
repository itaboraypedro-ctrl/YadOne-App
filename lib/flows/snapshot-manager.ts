// lib/flows/snapshot-manager.ts — Gerenciador de versionamento de fluxos (T27, gap #1)
//
// Responsabilidades:
//  - createSnapshot: serializa o estado atual do fluxo (flow + nodes + edges + tags + policies)
//    como um payload JSONB e grava em flow_snapshots com a próxima versão monotônica.
//  - restoreFromSnapshot: substitui o estado vivo do fluxo pelo conteúdo de um snapshot
//    alvo, depois de salvar um "safety snapshot" da versão atual.
//  - listVersions: lista compacta de versões (version, created_by, created_at).
//
// Trade-offs:
//  - Restore NÃO é atômico em uma transação Postgres real. Supabase JS client não expõe
//    BEGIN/COMMIT em uma única chamada — usaríamos um RPC SQL function pra isso. Por
//    enquanto, fazemos best-effort sequencial: o safety snapshot criado no passo 1
//    permite um novo rollback caso o restore falhe no meio.
//  - Sessões ativas continuam funcionando na versão antiga porque sessions.flow_version
//    é fixado na inicialização (gap #11, getFlowAtVersion já implementado em flows.ts).
//    Apenas novas sessões pegam a versão restaurada.

import { supabase } from '@/lib/db/client'
import {
  getFlow,
  getFlowEdges,
  getFlowNodes,
  getFlowToolPolicies,
  getNodeTags,
} from '@/lib/db/flows'
import {
  createSnapshot as dbCreateSnapshot,
  getLatestVersion,
  getSnapshot,
  listSnapshots,
} from '@/lib/db/snapshots'
import type {
  Flow,
  FlowEdge,
  FlowNode,
  FlowSnapshot,
  FlowSnapshotPayload,
  FlowToolPolicy,
  NodeKnowledgeTag,
} from '@/types/flow'

async function buildSnapshotPayload(flow_id: string): Promise<FlowSnapshotPayload> {
  const [flowRaw, nodesRaw, edgesRaw, policiesRaw] = await Promise.all([
    getFlow(flow_id),
    getFlowNodes(flow_id),
    getFlowEdges(flow_id),
    getFlowToolPolicies(flow_id),
  ])
  if (!flowRaw) throw new Error(`buildSnapshotPayload: flow ${flow_id} not found`)

  const flow = flowRaw as unknown as Flow
  const nodes = nodesRaw as unknown as FlowNode[]
  const edges = edgesRaw as unknown as FlowEdge[]
  const policies = policiesRaw as unknown as FlowToolPolicy[]

  const tagLists = await Promise.all(nodes.map((n) => getNodeTags(n.id)))
  const tags: NodeKnowledgeTag[] = tagLists.flat() as unknown as NodeKnowledgeTag[]

  return { flow, nodes, edges, tags, policies }
}

export async function createSnapshot(
  flow_id: string,
  created_by: string,
): Promise<FlowSnapshot> {
  const payload = await buildSnapshotPayload(flow_id)

  // Próxima versão = max(snapshot.latest_version, flow.version) + 1.
  // Isso evita colisão com flows.version atual que ainda não tenha sido snapshotado.
  const [snapLatest, currentFlow] = await Promise.all([
    getLatestVersion(flow_id),
    getFlow(flow_id),
  ])
  const flowVersion = currentFlow?.version ?? 0
  const nextVersion = Math.max(snapLatest, flowVersion) + 1

  const inserted = await dbCreateSnapshot(
    flow_id,
    payload as unknown as Record<string, unknown>,
    created_by,
    nextVersion,
  )
  return inserted as unknown as FlowSnapshot
}

export interface RestoreResult {
  restored_version: number
  safety_snapshot_version: number
}

export async function restoreFromSnapshot(
  flow_id: string,
  target_version: number,
  created_by: string,
): Promise<RestoreResult> {
  // Passo 1: snapshot de segurança da versão atual.
  const safety = await createSnapshot(flow_id, `system_pre_rollback:${created_by}`)

  // Passo 2: lê snapshot alvo.
  const target = await getSnapshot(flow_id, target_version)
  if (!target) {
    throw new Error(
      `restoreFromSnapshot: snapshot for flow ${flow_id} version ${target_version} not found`,
    )
  }
  const payload = target.snapshot as unknown as FlowSnapshotPayload
  if (!payload || !payload.flow) {
    throw new Error(`restoreFromSnapshot: snapshot ${flow_id}@${target_version} has invalid payload`)
  }

  const currentFlow = await getFlow(flow_id)
  if (!currentFlow) {
    throw new Error(`restoreFromSnapshot: live flow ${flow_id} not found`)
  }

  // Passo 3: replace state. Sequência best-effort (sem transação real).
  // Ordem de DELETE respeita FKs: policies/tags primeiro, depois edges, depois nodes.

  // 3.1 — DELETE flow_tool_policies
  {
    const { error } = await supabase.from('flow_tool_policies').delete().eq('flow_id', flow_id)
    if (error) throw new Error(`restore: delete tool_policies: ${error.message}`)
  }

  // 3.2 — DELETE node_knowledge_tags via subquery (node_ids do flow)
  {
    const { data: liveNodes, error: selErr } = await supabase
      .from('flow_nodes')
      .select('id')
      .eq('flow_id', flow_id)
    if (selErr) throw new Error(`restore: list live nodes: ${selErr.message}`)
    const liveNodeIds = (liveNodes ?? []).map((n) => n.id as string)
    if (liveNodeIds.length > 0) {
      const { error } = await supabase
        .from('node_knowledge_tags')
        .delete()
        .in('node_id', liveNodeIds)
      if (error) throw new Error(`restore: delete node_tags: ${error.message}`)
    }
  }

  // 3.3 — DELETE flow_edges
  {
    const { error } = await supabase.from('flow_edges').delete().eq('flow_id', flow_id)
    if (error) throw new Error(`restore: delete edges: ${error.message}`)
  }

  // 3.4 — DELETE flow_nodes
  {
    const { error } = await supabase.from('flow_nodes').delete().eq('flow_id', flow_id)
    if (error) throw new Error(`restore: delete nodes: ${error.message}`)
  }

  // 3.5 — INSERT nodes (preserva UUIDs originais)
  if (payload.nodes.length > 0) {
    const rows = payload.nodes.map((n) => ({
      id: n.id,
      flow_id: flow_id,
      type: n.type,
      label: n.label,
      // FlowNode é discriminated union; cada variante tem seu próprio config.
      // O DB armazena tudo como JSONB em flow_nodes.config.
      config: (n as unknown as { config: Record<string, unknown> }).config,
      position_x: n.position_x,
      position_y: n.position_y,
    }))
    const { error } = await supabase.from('flow_nodes').insert(rows)
    if (error) throw new Error(`restore: insert nodes: ${error.message}`)
  }

  // 3.6 — INSERT edges
  if (payload.edges.length > 0) {
    const rows = payload.edges.map((e) => ({
      id: e.id,
      flow_id: flow_id,
      source_node_id: e.source_node_id,
      target_node_id: e.target_node_id,
      label: e.label,
      condition: e.condition,
      is_default: e.is_default,
    }))
    const { error } = await supabase.from('flow_edges').insert(rows)
    if (error) throw new Error(`restore: insert edges: ${error.message}`)
  }

  // 3.7 — INSERT node_knowledge_tags
  if (payload.tags.length > 0) {
    const { error } = await supabase.from('node_knowledge_tags').insert(payload.tags)
    if (error) throw new Error(`restore: insert node_tags: ${error.message}`)
  }

  // 3.8 — INSERT flow_tool_policies
  if (payload.policies.length > 0) {
    const rows = payload.policies.map((p) => ({
      flow_id: flow_id,
      tool_id: p.tool_id,
      allowed: p.allowed,
    }))
    const { error } = await supabase.from('flow_tool_policies').insert(rows)
    if (error) throw new Error(`restore: insert tool_policies: ${error.message}`)
  }

  // 3.9 — UPDATE flows: copia metadados do snapshot e seta version = target_version,
  // parent_version_id = id do flow atual (linhagem).
  {
    const snapFlow = payload.flow
    const { error } = await supabase
      .from('flows')
      .update({
        name: snapFlow.name,
        description: snapFlow.description,
        trigger_keywords: snapFlow.trigger_keywords,
        trigger_products: snapFlow.trigger_products,
        status: snapFlow.status,
        is_default: snapFlow.is_default,
        version: target_version,
        parent_version_id: currentFlow.id,
      })
      .eq('id', flow_id)
    if (error) throw new Error(`restore: update flows: ${error.message}`)
  }

  return {
    restored_version: target_version,
    safety_snapshot_version: safety.version,
  }
}

export interface VersionListEntry {
  version: number
  created_by: string | null
  created_at: string
}

export async function listVersions(flow_id: string): Promise<VersionListEntry[]> {
  const snaps = await listSnapshots(flow_id)
  return snaps.map((s) => ({
    version: s.version,
    created_by: s.created_by,
    created_at: s.created_at,
  }))
}
