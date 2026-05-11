// lib/engine/prompt-builder.ts — Monta o system prompt nas 7 seções da SPEC §5.
// Decisão: numeração estável (1..7). Quando uma seção fica sem dado significativo,
// emitimos um placeholder mínimo ("Conversa nova.", "Conduzir conversa naturalmente",
// etc.) em vez de pular o cabeçalho — mantém a referência semântica por número e
// simplifica debugging dos prompts. Seções 4 (CONHECIMENTO ATIVO) é a única realmente
// omitida quando vazia, por ser opcional por nó.
//
// Não inclui current_message — ela vai como mensagem do usuário para o Planner/Executor.

import type { PromptContext, CatalogProduct } from './context-builder'
import type { WorkspaceAgentConfig } from '@/types/workspace'
import type { Message } from '@/types/message'
import type { ObjectivePending } from '@/types/session'

const SECTION_HEADER = (n: number, title: string): string => `=== ${n}. ${title} ===\n`

const RESPONSE_LENGTH_HINT: Record<string, string> = {
  short: 'Respostas curtas e diretas (1–2 frases sempre que possível).',
  medium: 'Respostas de tamanho médio (2–4 frases).',
  long: 'Respostas mais elaboradas quando o assunto pedir, mas sem prolixidade.',
}

const TRATAMENTO_HINT: Record<string, string> = {
  você: 'Use "você" no tratamento.',
  tu: 'Use "tu" no tratamento (informal).',
  senhor: 'Use "senhor" no tratamento (formal masculino).',
  senhora: 'Use "senhora" no tratamento (formal feminino).',
}

function buildIdentitySection(ctx: PromptContext): string {
  const ws = ctx.workspace
  const cfg: WorkspaceAgentConfig | null = ctx.agent_config

  const personaName = cfg?.persona_name?.trim() || 'Atendente'
  const personaTone = cfg?.persona_tone?.trim() || 'cordial e profissional'
  const responseLength = cfg?.response_length ?? 'medium'
  const emojiUsage = cfg?.emoji_usage ?? false
  const tratamento = cfg?.tratamento ?? 'você'

  const lines: string[] = []
  lines.push(SECTION_HEADER(1, 'IDENTIDADE'))
  lines.push(`Você é ${personaName}, atendente de ${ws.name}.`)
  lines.push('')
  lines.push('Estilo de comunicação:')
  lines.push(`- Tom: ${personaTone}`)
  lines.push(
    `- Comprimento das respostas: ${responseLength} — ${RESPONSE_LENGTH_HINT[responseLength] ?? RESPONSE_LENGTH_HINT.medium}`,
  )
  lines.push(`- Uso de emoji: ${emojiUsage ? 'permitido com moderação' : 'não usar emojis'}`)
  lines.push(
    `- Tratamento: ${tratamento} — ${TRATAMENTO_HINT[tratamento] ?? TRATAMENTO_HINT['você']}`,
  )

  if (cfg?.business_info && cfg.business_info.trim()) {
    lines.push('')
    lines.push('Sobre o negócio:')
    lines.push(cfg.business_info.trim())
  }

  lines.push('')
  lines.push('Regras invioláveis:')
  if (cfg?.persona_rules && cfg.persona_rules.trim()) {
    lines.push(cfg.persona_rules.trim())
  } else {
    lines.push('- Nunca mencione que é uma IA, sistema ou que segue um fluxo/script.')
    lines.push('- Nunca invente informação sobre preços, horários ou disponibilidade.')
  }

  return lines.join('\n')
}

function buildClientContextSection(ctx: PromptContext): string {
  const lines: string[] = []
  lines.push(SECTION_HEADER(2, 'CONTEXTO DO CLIENTE'))

  const clientName = ctx.client?.name?.trim()
  if (clientName) {
    lines.push(`Nome do cliente: ${clientName}`)
  } else {
    lines.push('Nome do cliente: (não informado)')
  }

  const memText = ctx.semantic_memory_text?.trim() || ''
  if (memText) {
    lines.push('')
    lines.push(memText)
  } else {
    lines.push('')
    lines.push('Cliente novo, sem histórico no salão.')
  }

  lines.push('')
  lines.push(
    'Use essas informações naturalmente. Nunca deixe transparecer que está lendo de um sistema.',
  )
  return lines.join('\n')
}

function formatProductLine(p: CatalogProduct, full: boolean): string {
  const priceStr = p.price !== null && p.price !== undefined ? `R$ ${p.price.toFixed(2)}` : 's/preço'
  const durStr =
    p.duration_minutes !== null && p.duration_minutes !== undefined
      ? `${p.duration_minutes}min`
      : null
  const cat = p.category?.trim() || 'sem categoria'

  if (!full) {
    // Resumido: apenas name + category
    return `- ${p.name} — ${cat}`
  }
  const head = durStr
    ? `- ${p.name} (${priceStr}, ${durStr}) — ${cat}`
    : `- ${p.name} (${priceStr}) — ${cat}`
  if (p.description && p.description.trim()) {
    return `${head}\n  ${p.description.trim()}`
  }
  return head
}

function buildCatalogSection(ctx: PromptContext): string {
  const lines: string[] = []
  lines.push(SECTION_HEADER(3, 'CATÁLOGO GLOBAL'))

  if (ctx.catalog.length === 0) {
    lines.push('(Catálogo vazio — nenhum produto/serviço ativo cadastrado.)')
    return lines.join('\n')
  }

  if (ctx.include_full_catalog) {
    lines.push('Produtos e serviços disponíveis (lista completa):')
  } else {
    lines.push('Produtos e serviços disponíveis (resumo):')
  }

  for (const p of ctx.catalog) {
    lines.push(formatProductLine(p, ctx.include_full_catalog))
  }

  lines.push('')
  lines.push(
    'Você conhece todos os itens acima e pode responder sobre qualquer um, mesmo fora do foco atual.',
  )
  return lines.join('\n')
}

function buildKnowledgeSection(ctx: PromptContext): string | null {
  const text = ctx.knowledge_content.formatted?.trim()
  if (!text) return null

  const limit = ctx.current_node?.config?.context_window?.knowledge_tags_limit
  let body = text
  if (typeof limit === 'number' && limit > 0 && body.length > limit) {
    body = body.slice(0, limit)
  }

  const lines: string[] = []
  lines.push(SECTION_HEADER(4, 'CONHECIMENTO ATIVO'))
  lines.push(body)
  return lines.join('\n')
}

function buildObjectiveSection(ctx: PromptContext): string {
  const lines: string[] = []
  lines.push(SECTION_HEADER(5, 'OBJETIVO ATUAL'))

  const node = ctx.current_node
  if (node?.config?.objective?.trim()) {
    if (ctx.flow?.name) {
      lines.push(`Fluxo ativo: ${ctx.flow.name}`)
    }
    lines.push(`Objetivo desta etapa: ${node.config.objective.trim()}`)
  } else {
    lines.push('Conduzir a conversa naturalmente, sem objetivo de fluxo específico no momento.')
  }

  // Digressão: itens no objective_stack (até 3, do topo para o fundo)
  const stack: ObjectivePending[] = (ctx.session.objective_stack as ObjectivePending[]) ?? []
  if (stack.length > 0) {
    lines.push('')
    lines.push('Objetivos pausados por digressão (retomar quando apropriado):')
    const top = stack.slice(-3).reverse()
    for (const item of top) {
      lines.push(`- ${item.objective}`)
    }
  }

  // Dados já coletados pela sessão (resumo curto)
  const collected = ctx.session.collected_data ?? {}
  const collectedKeys = Object.keys(collected)
  if (collectedKeys.length > 0) {
    lines.push('')
    lines.push('Dados já coletados nesta conversa:')
    for (const k of collectedKeys) {
      const v = collected[k]
      const str = typeof v === 'string' ? v : JSON.stringify(v)
      lines.push(`- ${k}: ${str}`)
    }
  }

  return lines.join('\n')
}

function formatHistoryEntry(m: Message): string {
  const role = m.role === 'assistant' ? 'assistant' : 'user'
  const content = m.content?.trim() || '(sem texto)'
  return `[${role}]: ${content}`
}

function buildHistorySection(ctx: PromptContext): string {
  const lines: string[] = []
  lines.push(SECTION_HEADER(6, 'HISTÓRICO RECENTE'))

  if (ctx.conversation_history.length === 0) {
    lines.push('Conversa nova.')
    return lines.join('\n')
  }
  for (const msg of ctx.conversation_history) {
    lines.push(formatHistoryEntry(msg))
  }
  return lines.join('\n')
}

function buildBehaviorSection(ctx: PromptContext, extra_behavior_hints?: string): string {
  const cfg = ctx.agent_config
  const node = ctx.current_node
  const allowDigression = node?.config?.allow_digression ?? true
  const responseLength = cfg?.response_length ?? 'medium'
  const emojiUsage = cfg?.emoji_usage ?? false

  const lines: string[] = []
  lines.push(SECTION_HEADER(7, 'INSTRUÇÕES DE COMPORTAMENTO'))
  lines.push('1. NATURALIDADE: Nunca mencione fluxo, script, sistema, IA ou prompt. Conduza')
  lines.push('   como um atendente humano experiente faria.')
  if (allowDigression) {
    lines.push('2. DIGRESSÃO: Se o cliente perguntar algo fora do objetivo, responda com naturalidade.')
    lines.push('   Quando o desvio terminar, retome o objetivo com suavidade — sem ignorar perguntas')
    lines.push('   legítimas para "manter foco".')
  } else {
    lines.push('2. FOCO: Este nó não permite digressões. Reconduza educadamente para o objetivo se')
    lines.push('   o cliente desviar (sem ser rude e sem ignorar perguntas urgentes).')
  }
  lines.push('3. PROATIVIDADE: Se identificar oportunidade relevante (complemento, promoção,')
  lines.push('   lembrança), aja. Não espere ser perguntado.')
  lines.push('4. OBJETIVIDADE: Não pergunte o que já está na memória ou nos dados coletados.')
  lines.push('5. COMPLETUDE: Quando o objetivo for atingido, avance — sem repetir confirmações.')
  lines.push(
    `6. ESTILO: Comprimento ${responseLength}. ${RESPONSE_LENGTH_HINT[responseLength] ?? RESPONSE_LENGTH_HINT.medium}`,
  )
  lines.push(
    `7. EMOJI: ${emojiUsage ? 'pode usar com moderação quando casar com o tom.' : 'não usar emojis.'}`,
  )

  const hints = extra_behavior_hints?.trim()
  if (hints) {
    lines.push('')
    lines.push('Sinais contextuais para esta interação:')
    lines.push(hints)
  }
  return lines.join('\n')
}

export interface BuildSystemPromptOptions {
  /**
   * Texto a ser injetado dentro da Seção 7 (INSTRUÇÕES DE COMPORTAMENTO),
   * depois das diretrizes 1–7, sob o rótulo "Sinais contextuais para esta interação:".
   * Usado pelo Executor (T13) para mixed-initiative — sinais derivados de memória do cliente.
   * Default: undefined → comportamento inalterado.
   */
  extra_behavior_hints?: string
}

/**
 * Monta o system prompt completo a partir do PromptContext.
 *
 * Não inclui a mensagem atual do cliente — esta entra como mensagem `user` para o LLM.
 * Não trunca por tokens (responsabilidade de T11/T15). Apenas respeita knowledge_tags_limit
 * por nó, se configurado.
 */
export function buildSystemPrompt(
  ctx: PromptContext,
  opts?: BuildSystemPromptOptions,
): string {
  const sections: string[] = []
  sections.push(buildIdentitySection(ctx))
  sections.push(buildClientContextSection(ctx))
  sections.push(buildCatalogSection(ctx))
  const kb = buildKnowledgeSection(ctx)
  if (kb) sections.push(kb)
  sections.push(buildObjectiveSection(ctx))
  sections.push(buildHistorySection(ctx))
  sections.push(buildBehaviorSection(ctx, opts?.extra_behavior_hints))
  return sections.join('\n\n')
}
