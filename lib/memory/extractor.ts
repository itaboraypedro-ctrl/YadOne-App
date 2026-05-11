// lib/memory/extractor.ts — Extração de insights pós-conversa via Claude Sonnet.
// Usado pelos jobs T20 ao receber `conversation.completed`:
//   - extractInsightsFromConversation: gera/atualiza memória semântica
//   - extractEpisodes: identifica trechos relevantes para indexação episódica
//
// Modelo: claude-sonnet-4-6 (alinhado ao restante do projeto).
// Skip graceful sem ANTHROPIC_API_KEY (retorna estrutura vazia / lista vazia).

import type { ClientMemorySemantic, MemoryInsights } from '@/types/memory'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS_INSIGHTS = 800
const MAX_TOKENS_EPISODES = 1000
const TEMPERATURE = 0.3

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ExtractedEpisode {
  conversation_excerpt: string
  excerpt_summary: string
  topic_tags: string[]
}

interface AnthropicMessageResponse {
  content?: Array<{ type: string; text?: string }>
}

const EMPTY_INSIGHTS: MemoryInsights = {
  preferred_name: null,
  preferences: [],
  last_service: null,
  observations: null,
  raw_insights: {},
}

const INSIGHTS_SYSTEM_PROMPT = `Você é um analista de relacionamento com clientes para um SaaS de atendimento. Dada uma conversa concluída e (opcionalmente) o resumo prévio do cliente, ATUALIZE o resumo mantendo o que ainda é relevante e adicionando novos insights. Responda APENAS um JSON com o seguinte formato:
{ "preferred_name": string|null, "preferences": string[], "last_service": string|null, "observations": string|null, "raw_insights": object }
Seja conciso. Resumo total < 500 chars. Não invente fatos.`

const EPISODES_SYSTEM_PROMPT = `Você é um analista de conversas para um SaaS de atendimento. Dada uma conversa concluída, identifique TRECHOS relevantes para memória episódica de longo prazo: tool calls executadas, objeções do cliente, perguntas sobre produto/preço, problemas relatados, decisões tomadas. Ignore small-talk e mensagens sem valor analítico. Responda APENAS um JSON no formato:
{ "episodes": [ { "conversation_excerpt": string, "excerpt_summary": string, "topic_tags": string[] } ] }
- conversation_excerpt: trecho literal (até ~400 chars) do diálogo onde aconteceu.
- excerpt_summary: resumo de 1 frase em pt-BR (até ~140 chars).
- topic_tags: 1 a 4 tags curtas em snake_case (ex: ["objecao_preco", "agendamento_cancelado"]).
Se a conversa não tiver trechos relevantes, retorne { "episodes": [] }. Não invente fatos.`

/**
 * Extrai entre o primeiro `{` e o último `}` do texto e tenta JSON.parse.
 * Tolera prefácios/sufixos do modelo.
 */
function extractJson(text: string): unknown | null {
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  const slice = text.slice(first, last + 1)
  try {
    return JSON.parse(slice) as unknown
  } catch {
    return null
  }
}

async function callAnthropic(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        temperature: TEMPERATURE,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!res.ok) {
      console.warn(
        '[memory/extractor] Anthropic non-200',
        res.status,
        await res.text().catch(() => ''),
      )
      return null
    }

    const json = (await res.json()) as AnthropicMessageResponse
    const text = json.content?.find((b) => b.type === 'text')?.text ?? ''
    return text || null
  } catch (e) {
    console.warn('[memory/extractor] Anthropic error', (e as Error).message)
    return null
  }
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

function coerceStringOrNull(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return null
}

function coerceRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>
  }
  return {}
}

/**
 * Extrai/atualiza insights semânticos de uma conversa concluída.
 *
 * Skip graceful sem ANTHROPIC_API_KEY OU em qualquer falha do modelo:
 * retorna `EMPTY_INSIGHTS` (caller decide se atualiza ou não a memória).
 */
export async function extractInsightsFromConversation(
  messages: ConversationMessage[],
  existingMemory?: ClientMemorySemantic,
): Promise<MemoryInsights> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '[memory/extractor] ANTHROPIC_API_KEY ausente — retornando insights vazios (graceful skip)',
    )
    return { ...EMPTY_INSIGHTS, raw_insights: {} }
  }

  if (!messages || messages.length === 0) {
    return { ...EMPTY_INSIGHTS, raw_insights: {} }
  }

  const userContent = JSON.stringify({
    existingMemory: existingMemory ?? null,
    messages,
  })

  const text = await callAnthropic(
    INSIGHTS_SYSTEM_PROMPT,
    userContent,
    MAX_TOKENS_INSIGHTS,
  )
  if (!text) return { ...EMPTY_INSIGHTS, raw_insights: {} }

  const parsed = extractJson(text)
  if (!parsed || typeof parsed !== 'object') {
    return { ...EMPTY_INSIGHTS, raw_insights: {} }
  }

  const obj = parsed as Record<string, unknown>
  return {
    preferred_name: coerceStringOrNull(obj.preferred_name),
    preferences: coerceStringArray(obj.preferences),
    last_service: coerceStringOrNull(obj.last_service),
    observations: coerceStringOrNull(obj.observations),
    raw_insights: coerceRecord(obj.raw_insights),
  }
}

/**
 * Extrai uma lista de episódios relevantes da conversa.
 * Uma conversa pode gerar múltiplos episódios (ou nenhum).
 *
 * Skip graceful sem ANTHROPIC_API_KEY: retorna [].
 */
export async function extractEpisodes(
  messages: ConversationMessage[],
): Promise<ExtractedEpisode[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '[memory/extractor] ANTHROPIC_API_KEY ausente — sem extração de episódios (graceful skip)',
    )
    return []
  }

  if (!messages || messages.length === 0) return []

  const userContent = JSON.stringify({ messages })

  const text = await callAnthropic(
    EPISODES_SYSTEM_PROMPT,
    userContent,
    MAX_TOKENS_EPISODES,
  )
  if (!text) return []

  const parsed = extractJson(text)
  if (!parsed || typeof parsed !== 'object') return []

  const root = parsed as Record<string, unknown>
  const list = root.episodes
  if (!Array.isArray(list)) return []

  const out: ExtractedEpisode[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const ep = item as Record<string, unknown>
    const excerpt = coerceStringOrNull(ep.conversation_excerpt)
    const summary = coerceStringOrNull(ep.excerpt_summary)
    const tags = coerceStringArray(ep.topic_tags)
    if (!excerpt || !summary) continue
    out.push({
      conversation_excerpt: excerpt,
      excerpt_summary: summary,
      topic_tags: tags,
    })
  }
  return out
}
