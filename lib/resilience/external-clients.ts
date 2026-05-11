// lib/resilience/external-clients.ts — Wrappers tipados com retry + circuit breaker para APIs externas.

import { retryWithBackoff } from './retry'
import { withBreaker } from './circuit-breaker'
import { logAudit } from '@/lib/db/audit'
import { getChannelAdapter } from '@/lib/channels/factory'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | Array<Record<string, unknown>>
}

interface AnthropicCompleteInput {
  model: string
  system?: string
  messages: AnthropicMessage[]
  max_tokens: number
  temperature?: number
  metadata?: Record<string, unknown>
}

interface AnthropicResponse {
  content: string
  /** Input tokens consumidos pela chamada (Anthropic Messages API). */
  usage_input: number
  /** Output tokens consumidos pela chamada (Anthropic Messages API). */
  usage_output: number
  raw: unknown
}

/**
 * Tool schema no formato da Anthropic Messages API (tool_use blocks).
 * Mantido permissivo para evitar acoplamento estrito com a SDK.
 */
export interface AnthropicToolSpec {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: string; [key: string]: unknown }

export interface AnthropicCompleteWithToolsInput {
  model: string
  system?: string
  messages: AnthropicMessage[]
  max_tokens: number
  temperature?: number
  tools: AnthropicToolSpec[]
  /** Default 'auto' — modelo decide se chama tool ou responde texto. */
  tool_choice?: { type: 'auto' | 'any' | 'tool'; name?: string }
  metadata?: Record<string, unknown>
}

export interface AnthropicCompleteWithToolsResponse {
  content_blocks: AnthropicContentBlock[]
  text: string
  /** stop_reason expostos pela API: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' */
  stop_reason: string
  usage_input: number
  usage_output: number
  raw: unknown
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>
}

interface OpenAITranscriptionResponse {
  text: string
}

class HttpError extends Error {
  status: number
  body: string
  constructor(status: number, body: string, message?: string) {
    super(message ?? `HTTP ${status}: ${body.slice(0, 200)}`)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new HttpError(res.status, text)
  }
  return res
}

// ============================================================
// Anthropic (Claude API)
// ============================================================

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

interface AnthropicMessagesApiResponse {
  content?: Array<Record<string, unknown>>
  stop_reason?: string
  usage?: { input_tokens?: number; output_tokens?: number }
}

export const anthropicClient = {
  async completeWithTools(
    input: AnthropicCompleteWithToolsInput,
  ): Promise<AnthropicCompleteWithToolsResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('[anthropicClient.completeWithTools] ANTHROPIC_API_KEY não configurada.')
    }

    const result = await retryWithBackoff(
      () =>
        withBreaker('anthropic', async () => {
          const res = await postJson(
            ANTHROPIC_URL,
            {
              model: input.model,
              max_tokens: input.max_tokens,
              ...(input.system ? { system: input.system } : {}),
              messages: input.messages,
              ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
              tools: input.tools,
              ...(input.tool_choice ? { tool_choice: input.tool_choice } : {}),
              ...(input.metadata ? { metadata: input.metadata } : {}),
            },
            {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
          )
          const json = (await res.json()) as AnthropicMessagesApiResponse
          const blocks = (json.content ?? []) as AnthropicContentBlock[]
          const text = blocks
            .filter((b) => (b as { type?: string }).type === 'text')
            .map((b) => (b as { text?: string }).text ?? '')
            .join('')
          return {
            content_blocks: blocks,
            text,
            stop_reason: json.stop_reason ?? 'end_turn',
            usage_input: json.usage?.input_tokens ?? 0,
            usage_output: json.usage?.output_tokens ?? 0,
            raw: json,
          }
        }),
      {
        on_retry: (attempt, error) => {
          void logAudit('tool.failed', {
            api: 'anthropic.tools',
            attempt,
            error: (error as Error).message,
          })
        },
      },
    )
    return result
  },

  async complete(input: AnthropicCompleteInput): Promise<AnthropicResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('[anthropicClient] ANTHROPIC_API_KEY não configurada.')
    }

    const result = await retryWithBackoff(
      () =>
        withBreaker('anthropic', async () => {
          const res = await postJson(
            ANTHROPIC_URL,
            {
              model: input.model,
              max_tokens: input.max_tokens,
              ...(input.system ? { system: input.system } : {}),
              messages: input.messages,
              ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
              ...(input.metadata ? { metadata: input.metadata } : {}),
            },
            {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
          )
          const json = (await res.json()) as AnthropicMessagesApiResponse
          const text = (json.content ?? [])
            .filter((block) => block.type === 'text' && typeof block.text === 'string')
            .map((block) => block.text as string)
            .join('')
          return {
            content: text,
            usage_input: json.usage?.input_tokens ?? 0,
            usage_output: json.usage?.output_tokens ?? 0,
            raw: json,
          }
        }),
      {
        on_retry: (attempt, error) => {
          void logAudit('tool.failed', {
            api: 'anthropic',
            attempt,
            error: (error as Error).message,
          })
        },
      },
    )
    return result
  },
}

// ============================================================
// OpenAI (Embeddings + Whisper)
// ============================================================

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions'

export const openaiClient = {
  async embed(text: string | string[]): Promise<number[][]> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('[openaiClient.embed] OPENAI_API_KEY não configurada.')
    }
    const input = Array.isArray(text) ? text : [text]

    return retryWithBackoff(
      () =>
        withBreaker('openai', async () => {
          const res = await postJson(
            OPENAI_EMBEDDINGS_URL,
            { model: 'text-embedding-3-small', input },
            { Authorization: `Bearer ${apiKey}` },
          )
          const json = (await res.json()) as OpenAIEmbeddingResponse
          return json.data.map((d) => d.embedding)
        }),
      {
        on_retry: (attempt, error) => {
          void logAudit('tool.failed', {
            api: 'openai.embed',
            attempt,
            error: (error as Error).message,
          })
        },
      },
    )
  },

  async transcribe(audio: Buffer, opts?: { language?: string }): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('[openaiClient.transcribe] OPENAI_API_KEY não configurada.')
    }

    return retryWithBackoff(
      () =>
        withBreaker('openai', async () => {
          const form = new FormData()
          // FormData precisa de Blob para arquivos
          const blob = new Blob([new Uint8Array(audio)])
          form.append('file', blob, 'audio.ogg')
          form.append('model', 'whisper-1')
          form.append('language', opts?.language ?? 'pt')
          form.append('response_format', 'text')

          const res = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
          })
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new HttpError(res.status, text)
          }
          const text = await res.text()
          // response_format=text retorna a string crua; se vier JSON, parsear
          try {
            const parsed = JSON.parse(text) as OpenAITranscriptionResponse
            return parsed.text ?? text
          } catch {
            return text
          }
        }),
      {
        on_retry: (attempt, error) => {
          void logAudit('tool.failed', {
            api: 'openai.transcribe',
            attempt,
            error: (error as Error).message,
          })
        },
      },
    )
  },
}

// ============================================================
// Channel client (YCloud / ZAPI / Evolution)
// ============================================================

interface ChannelSendInput {
  text: string
  media_url?: string
  media_type?: 'image' | 'audio' | 'document'
}

export const channelClient = {
  async send(workspace_id: string, to: string, message: ChannelSendInput): Promise<void> {
    const adapter = await getChannelAdapter(workspace_id)
    const breakerKey = `channel:${adapter.type}`

    return retryWithBackoff(
      () =>
        withBreaker(breakerKey, async () => {
          await adapter.send(to, message)
        }),
      {
        on_retry: (attempt, error) => {
          void logAudit(
            'tool.failed',
            { api: breakerKey, attempt, error: (error as Error).message },
            { workspace_id },
          )
        },
      },
    )
  },
}
