// lib/engine/context-builder.ts — Carrega tudo necessário para construir o system prompt.
// SPEC §5. Coleta workspace, agent_config, client, memória, sessão, fluxo, nó atual,
// knowledge ativo, histórico e catálogo. Não faz I/O fora do banco.

import { supabase } from '@/lib/db/client'
import { getWorkspace, getAgentConfig } from '@/lib/db/workspaces'
import { getFlowForSession, getFlowNodes } from '@/lib/db/flows'
import { getSession } from '@/lib/db/sessions'
import { getHistory } from '@/lib/db/messages'
import { buildMemoryContext } from '@/lib/memory/builder'
import { getKnowledgeForNode } from '@/lib/knowledge/fetcher'

import type { Workspace, WorkspaceAgentConfig } from '@/types/workspace'
import type { Client } from '@/types/client'
import type { Session } from '@/types/session'
import type { Flow, FlowNode, StepNode } from '@/types/flow'
import type { Message } from '@/types/message'
import type { KnowledgeFetchResult } from '@/types/knowledge'

// TODO: tipo Product não existe em /types/* ainda — declarado localmente até /types/product.ts
// ser adicionado.
export interface CatalogProduct {
  id: string
  workspace_id: string
  name: string
  description: string | null
  price: number | null
  duration_minutes: number | null
  category: string | null
  is_active: boolean
  created_at: string
}

export interface PromptContext {
  workspace: Workspace
  agent_config: WorkspaceAgentConfig | null
  client: Client | null
  /**
   * Bloco já formatado pelo memory/builder (semântica + episódica). String vazia quando
   * cliente é novo.
   */
  semantic_memory_text: string
  /**
   * Para o MVP, memory/builder retorna um único bloco unificado contendo semântica e episódica.
   * Mantemos o campo separado para preservar a interface da SPEC, mas os dois apontam para o
   * mesmo bloco — prompt-builder injeta apenas em uma seção (Seção 2).
   */
  episodic_memory_text: string
  session: Session
  flow: Flow | null
  /**
   * Apenas StepNode interessa para o prompt LLM. Condition/Tool/Wait/Handoff retornam null
   * aqui — o engine os trata fora do ciclo de geração de resposta.
   */
  current_node: StepNode | null
  knowledge_content: KnowledgeFetchResult
  conversation_history: Message[]
  current_message: string
  catalog: CatalogProduct[]
  /**
   * Indica se o catálogo deve ser renderizado completo (description) ou resumido
   * (apenas name + category). Vem do current_node.config.context_window.
   */
  include_full_catalog: boolean
}

const EMPTY_KNOWLEDGE: KnowledgeFetchResult = {
  formatted: '',
  items_used: 0,
  tokens_estimate: 0,
  used_rag: false,
}

const DEFAULT_HISTORY_LIMIT = 10

function pickFirstStepNode(nodes: FlowNode[]): StepNode | null {
  for (const n of nodes) {
    if (n.type === 'step') return n as StepNode
  }
  return null
}

function findCurrentStepNode(
  nodes: FlowNode[],
  current_node_id: string | null,
): StepNode | null {
  if (!current_node_id) return pickFirstStepNode(nodes)
  const found = nodes.find((n) => n.id === current_node_id)
  if (!found) return pickFirstStepNode(nodes)
  if (found.type !== 'step') return null
  return found as StepNode
}

async function loadClient(client_id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .maybeSingle()
  if (error) throw new Error(`loadClient(${client_id}) failed: ${error.message}`)
  return (data as Client) ?? null
}

async function loadCatalog(workspace_id: string): Promise<CatalogProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) throw new Error(`loadCatalog(${workspace_id}) failed: ${error.message}`)
  return (data as CatalogProduct[]) ?? []
}

/**
 * Monta o PromptContext para uma sessão + mensagem atual.
 *
 * Erros:
 *  - lança se sessão não existir
 *  - lança se workspace da sessão não existir
 *  - tolera ausência de agent_config, flow, client, knowledge (degrada graciosamente)
 */
export async function buildPromptContext(
  session_id: string,
  current_message: string,
): Promise<PromptContext> {
  const session = await getSession(session_id)
  if (!session) throw new Error(`buildPromptContext: session ${session_id} not found`)

  // Os tipos de getSession ainda usam shapes inline em /lib/db/sessions.ts; cast estrutural
  // — campos batem com Session de /types/session.ts. TODO: remover quando T03/T02 alinharem.
  const sessionTyped = session as unknown as Session

  const [workspace, agent_config, flow] = await Promise.all([
    getWorkspace(sessionTyped.workspace_id),
    getAgentConfig(sessionTyped.workspace_id),
    getFlowForSession({
      flow_id: sessionTyped.flow_id,
      flow_version: sessionTyped.flow_version,
    }),
  ])

  if (!workspace) {
    throw new Error(
      `buildPromptContext: workspace ${sessionTyped.workspace_id} not found for session ${session_id}`,
    )
  }
  // Cast estrutural — getWorkspace devolve shape inline equivalente ao type.
  const workspaceTyped = workspace as unknown as Workspace
  const agentConfigTyped = (agent_config as unknown as WorkspaceAgentConfig | null) ?? null
  const flowTyped = (flow as unknown as Flow | null) ?? null

  // Em paralelo: nodes do flow (se houver), client, memória, catálogo
  const [nodes, client, memory_text, catalog] = await Promise.all([
    flowTyped ? getFlowNodes(flowTyped.id) : Promise.resolve([]),
    loadClient(sessionTyped.client_id),
    buildMemoryContext(sessionTyped.client_id, sessionTyped.workspace_id, current_message),
    loadCatalog(sessionTyped.workspace_id),
  ])

  const nodesTyped = nodes as unknown as FlowNode[]
  const current_node = findCurrentStepNode(nodesTyped, sessionTyped.current_node_id)

  // Knowledge depende de current_node.id; obtido sequencialmente após resolver o nó.
  const knowledge_content: KnowledgeFetchResult = current_node
    ? await getKnowledgeForNode(
        current_node.id,
        sessionTyped.workspace_id,
        current_message,
      )
    : EMPTY_KNOWLEDGE

  // Histórico depois — limit depende do nó.
  const history_limit =
    current_node?.config?.context_window?.message_history_limit ?? DEFAULT_HISTORY_LIMIT
  const history = await getHistory(session_id, history_limit)
  const conversation_history = history as unknown as Message[]

  const include_full_catalog =
    current_node?.config?.context_window?.include_full_catalog ?? false

  return {
    workspace: workspaceTyped,
    agent_config: agentConfigTyped,
    client,
    semantic_memory_text: memory_text,
    episodic_memory_text: memory_text,
    session: sessionTyped,
    flow: flowTyped,
    current_node,
    knowledge_content,
    conversation_history,
    current_message,
    catalog,
    include_full_catalog,
  }
}
