// lib/knowledge/embeddings.ts — OpenAI text-embedding-3-small + cache LRU em memória
// Produz vetores de 1536 dimensões. Cache reduz custo em loops do mesmo texto
// (queries do mesmo turno, indexação de KB com chunks recorrentes etc.).
//
// TODO(T31): migrar retry/backoff inline para `@/lib/resilience/retry` quando T31 ficar pronta.

import { createHash } from 'node:crypto'

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIM = 1536
const MAX_BATCH_INPUTS = 2048
const RETRY_MAX = 3
const RETRY_BASE_MS = 500

interface OpenAIEmbeddingResponse {
  data: { index: number; embedding: number[] }[]
  model: string
  usage?: { prompt_tokens: number; total_tokens: number }
}

interface OpenAIErrorResponse {
  error?: { message?: string; type?: string }
}

class LRUCache<K, V> {
  private readonly map = new Map<K, V>()
  constructor(private readonly capacity: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key) as V
    // refresh recency
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, value)
  }
}

const embeddingCache = new LRUCache<string, number[]>(1000)

function cacheKey(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error(
      '[lib/knowledge/embeddings] OPENAI_API_KEY ausente. Configure a variável de ambiente para gerar embeddings.',
    )
  }
  return key
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callOpenAIEmbeddings(input: string[], apiKey: string): Promise<number[][]> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt < RETRY_MAX; attempt += 1) {
    try {
      const res = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
      })
      if (!res.ok) {
        let errMsg = `OpenAI embeddings HTTP ${res.status}`
        try {
          const errBody = (await res.json()) as OpenAIErrorResponse
          if (errBody.error?.message) errMsg += `: ${errBody.error.message}`
        } catch {
          // ignore parse error
        }
        // 4xx (exceto 429) não vale retry — falha rápido
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(errMsg)
        }
        throw new Error(errMsg)
      }
      const data = (await res.json()) as OpenAIEmbeddingResponse
      // ordena por index para casar 1:1 com `input`
      const sorted = [...data.data].sort((a, b) => a.index - b.index)
      const vectors = sorted.map((item) => item.embedding)
      if (vectors.some((v) => v.length !== EMBEDDING_DIM)) {
        throw new Error(
          `[lib/knowledge/embeddings] vetor com dim inesperada (esperado ${EMBEDDING_DIM})`,
        )
      }
      return vectors
    } catch (err) {
      lastErr = err
      if (attempt < RETRY_MAX - 1) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt)
        await sleep(delay)
        continue
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('[lib/knowledge/embeddings] falha após retries')
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const key = cacheKey(text)
  const cached = embeddingCache.get(key)
  if (cached) return cached
  const apiKey = requireApiKey()
  const [vector] = await callOpenAIEmbeddings([text], apiKey)
  embeddingCache.set(key, vector)
  return vector
}

export async function batchEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const apiKey = requireApiKey()

  const result: number[][] = new Array(texts.length)
  const missingIdx: number[] = []
  const missingTexts: string[] = []

  texts.forEach((t, i) => {
    const cached = embeddingCache.get(cacheKey(t))
    if (cached) {
      result[i] = cached
    } else {
      missingIdx.push(i)
      missingTexts.push(t)
    }
  })

  // chunked calls respeitando MAX_BATCH_INPUTS
  for (let offset = 0; offset < missingTexts.length; offset += MAX_BATCH_INPUTS) {
    const slice = missingTexts.slice(offset, offset + MAX_BATCH_INPUTS)
    const vectors = await callOpenAIEmbeddings(slice, apiKey)
    vectors.forEach((vec, j) => {
      const targetIdx = missingIdx[offset + j]
      result[targetIdx] = vec
      embeddingCache.set(cacheKey(missingTexts[offset + j]), vec)
    })
  }

  return result
}

export const __test__ = { LRUCache, cacheKey, EMBEDDING_DIM, MAX_BATCH_INPUTS }
