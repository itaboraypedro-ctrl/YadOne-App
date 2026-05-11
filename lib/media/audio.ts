// lib/media/audio.ts — Transcrição de áudio via OpenAI Whisper.
// SPEC_MOTOR_BACKEND.md §8: OGG/m4a → Whisper (model whisper-1, language pt) → texto.
//
// Política de erro:
//   - OPENAI_API_KEY ausente → console.warn + retorna "" (graceful skip).
//   - Erros 4xx (exceto 429) não retentam; 5xx e 429 retentam até 3x com
//     exponential backoff 500ms / 1000ms / 2000ms + jitter ±100ms.
// TODO: substituir o retry inline por `@/lib/resilience/retry` após T31.

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions'
const MAX_ATTEMPTS = 3
const BASE_DELAYS_MS = [500, 1000, 2000]
const JITTER_MS = 100

interface TranscribeOptions {
  language?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitter(baseMs: number): number {
  const delta = Math.floor((Math.random() * 2 - 1) * JITTER_MS)
  return Math.max(0, baseMs + delta)
}

function isRetryableStatus(status: number): boolean {
  // Apenas 429 (rate limit) e 5xx são retryable — 4xx (exceto 429) são definitivos.
  return status === 429 || status >= 500
}

/**
 * Transcreve áudio (OGG/m4a/mp3...) via OpenAI Whisper.
 * Retorna string vazia se a chave não estiver configurada (graceful skip).
 *
 * @throws Error em falha persistente após retries OU em erro 4xx não-retryable.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options: TranscribeOptions = {},
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[media/audio] OPENAI_API_KEY ausente — pulando transcrição (graceful skip)')
    return ''
  }

  const language = options.language ?? 'pt'

  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      // FormData precisa ser criado a cada tentativa: o fetch consome o body
      // (Blob/ReadableStream) e re-uso pode falhar em algumas runtimes.
      const form = new FormData()
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' })
      form.append('file', blob, 'audio.ogg')
      form.append('model', 'whisper-1')
      form.append('language', language)
      form.append('response_format', 'text')

      const res = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      })

      if (res.ok) {
        // response_format=text → corpo é o texto puro.
        const text = await res.text()
        return text.trim()
      }

      const bodyText = await res.text().catch(() => '')
      const errorMsg = `Whisper API ${res.status}: ${bodyText.slice(0, 300)}`

      if (!isRetryableStatus(res.status)) {
        throw new Error(errorMsg)
      }

      lastError = new Error(errorMsg)
    } catch (e) {
      // Erros já lançados por nós (4xx não-retryable) propagam imediatamente.
      if (e instanceof Error && e.message.startsWith('Whisper API ') && !isRetryableStatus(parseStatus(e.message))) {
        throw e
      }
      lastError = e instanceof Error ? e : new Error(String(e))
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(jitter(BASE_DELAYS_MS[attempt]))
    }
  }

  throw lastError ?? new Error('Whisper API: falha desconhecida após retries')
}

function parseStatus(msg: string): number {
  const m = msg.match(/Whisper API (\d+):/)
  return m ? Number(m[1]) : 0
}
