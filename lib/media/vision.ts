// lib/media/vision.ts — Descrição de imagem e parsing de documentos via Claude Vision.
// SPEC_MOTOR_BACKEND.md §8: imagens e PDFs descritos por claude-sonnet-4-* com prompt
// orientado ao segmento do workspace.
//
// Modelo: claude-sonnet-4-6 (alinhado ao restante do projeto).
// PDFs: a API Messages do Anthropic suporta `type: 'document'` com source base64
//       (`media_type: 'application/pdf'`) — nós usamos esse caminho. Para mediaTypes
//       desconhecidos / não suportados em parseDocument, retornamos um marker
//       indicativo em vez de quebrar o pipeline.
//
// Política de erro espelha audio.ts: graceful skip sem ANTHROPIC_API_KEY,
// retry inline (3x, backoff 500/1000/2000 ms ± 100 ms jitter), 4xx não-retryable.
// TODO: substituir o retry inline por `@/lib/resilience/retry` após T31.

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024
const MAX_ATTEMPTS = 3
const BASE_DELAYS_MS = [500, 1000, 2000]
const JITTER_MS = 100

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp'

interface VisionContext {
  workspace_segment?: string
}

interface AnthropicTextBlock {
  type: 'text'
  text: string
}
interface AnthropicMessageResponse {
  content?: Array<AnthropicTextBlock | { type: string; [k: string]: unknown }>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitter(baseMs: number): number {
  const delta = Math.floor((Math.random() * 2 - 1) * JITTER_MS)
  return Math.max(0, baseMs + delta)
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function buildPrompt(segment: string | undefined): string {
  const seg = segment ?? 'serviços'
  return (
    `Descreva o conteúdo desta mídia de forma estruturada, focando em informações ` +
    `relevantes para atendimento em ${seg}. Inclua textos visíveis, elementos ` +
    `principais e qualquer informação útil para um atendente.`
  )
}

interface CallVisionParams {
  source:
    | { type: 'image'; media_type: ImageMediaType; data: string }
    | { type: 'document'; media_type: 'application/pdf'; data: string }
  prompt: string
}

async function callVision({ source, prompt }: CallVisionParams): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[media/vision] ANTHROPIC_API_KEY ausente — pulando análise (graceful skip)')
    return ''
  }

  const contentItem =
    source.type === 'image'
      ? {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: source.media_type, data: source.data },
        }
      : {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: source.media_type, data: source.data },
        }

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [contentItem, { type: 'text', text: prompt }],
      },
    ],
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const json = (await res.json()) as AnthropicMessageResponse
        const text = (json.content ?? [])
          .filter((b): b is AnthropicTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim()
        return text
      }

      const bodyText = await res.text().catch(() => '')
      const errorMsg = `Anthropic Vision ${res.status}: ${bodyText.slice(0, 300)}`

      if (!isRetryableStatus(res.status)) {
        throw new Error(errorMsg)
      }
      lastError = new Error(errorMsg)
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.startsWith('Anthropic Vision ') &&
        !isRetryableStatus(parseStatus(e.message))
      ) {
        throw e
      }
      lastError = e instanceof Error ? e : new Error(String(e))
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(jitter(BASE_DELAYS_MS[attempt]))
    }
  }

  throw lastError ?? new Error('Anthropic Vision: falha desconhecida após retries')
}

function parseStatus(msg: string): number {
  const m = msg.match(/Anthropic Vision (\d+):/)
  return m ? Number(m[1]) : 0
}

/**
 * Descreve uma imagem (JPEG/PNG/WEBP) via Claude Vision.
 * Retorna "" se ANTHROPIC_API_KEY ausente.
 */
export async function describeImage(
  imageBuffer: Buffer,
  mediaType: ImageMediaType,
  context: VisionContext = {},
): Promise<string> {
  const data = imageBuffer.toString('base64')
  return callVision({
    source: { type: 'image', media_type: mediaType, data },
    prompt: buildPrompt(context.workspace_segment),
  })
}

/**
 * Faz parse de documento. Atualmente suporta apenas application/pdf via
 * `type: 'document'` da Messages API. Para mediaTypes não suportados,
 * retorna um marcador indicativo (sem throw, sem chamada de API) para
 * não quebrar o pipeline de mídia.
 */
export async function parseDocument(
  documentBuffer: Buffer,
  mediaType: 'application/pdf' | string,
  context: VisionContext = {},
): Promise<string> {
  if (mediaType === 'application/pdf') {
    const data = documentBuffer.toString('base64')
    return callVision({
      source: { type: 'document', media_type: 'application/pdf', data },
      prompt: buildPrompt(context.workspace_segment),
    })
  }
  // Tipos não suportados: retorna placeholder estável.
  return `[DOCUMENTO NÃO PROCESSADO: tipo=${mediaType} bytes=${documentBuffer.length}]`
}
