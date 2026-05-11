// lib/memory/embedding.ts — Helper local de embeddings para a memória episódica.
//
// TODO: deduplicar com /lib/knowledge/embeddings.ts após merge da T08.
// T08 está criando o helper canônico em paralelo; mantemos uma cópia mínima aqui
// para evitar acoplamento durante a execução paralela. Após merge:
//   - importar embedText de '@/lib/knowledge/embeddings'
//   - apagar este arquivo

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings'
const MODEL = 'text-embedding-3-small'
const DIMENSIONS = 1536
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 400

interface OpenAIEmbedResponse {
  data?: Array<{ embedding?: number[] }>
  error?: { message?: string }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Gera embedding (1536 dim) via OpenAI text-embedding-3-small.
 * Throws se OPENAI_API_KEY ausente OU se todas as tentativas falharem.
 *
 * O caller é responsável por tratar falha de embedding (ex: pular indexação
 * episódica de uma conversa específica em vez de derrubar o motor).
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      '[memory/embedding] OPENAI_API_KEY ausente — não é possível gerar embedding para indexação/busca episódica',
    )
  }

  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('[memory/embedding] texto vazio não pode ser embedded')
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(OPENAI_EMBED_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          input: trimmed,
        }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        // 4xx (exceto 429) não vale retry
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(
            `[memory/embedding] OpenAI ${res.status}: ${body.slice(0, 200)}`,
          )
        }
        throw new Error(
          `[memory/embedding] OpenAI transient ${res.status}: ${body.slice(0, 200)}`,
        )
      }

      const json = (await res.json()) as OpenAIEmbedResponse
      const vec = json.data?.[0]?.embedding
      if (!Array.isArray(vec) || vec.length !== DIMENSIONS) {
        throw new Error(
          `[memory/embedding] resposta inválida: esperado vetor de ${DIMENSIONS} dim`,
        )
      }
      return vec
    } catch (e) {
      lastError = e as Error
      // se for erro 4xx (não-retryable), aborta
      if (lastError.message.includes('OpenAI 4') && !lastError.message.includes('429')) {
        throw lastError
      }
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
      }
    }
  }

  throw lastError ?? new Error('[memory/embedding] falha desconhecida ao gerar embedding')
}
