// lib/engine/sentiment-analyzer.ts — Análise de sentiment das últimas mensagens do cliente.
// Modelo: claude-sonnet-4-6 (alinhado ao restante do Monitor). max_tokens curto.
// Retorna trend de até N mensagens + flag is_escalating (frustração crescente).

import { anthropicClient } from '@/lib/resilience/external-clients'
import type { Message } from '@/types/message'
import type { Sentiment, SentimentTrend } from '@/types/monitor'

const SENTIMENT_MODEL = 'claude-sonnet-4-6'
const SENTIMENT_MAX_TOKENS = 200
const SENTIMENT_TEMPERATURE = 0.0
const ANALYSIS_WINDOW = 3

const VALID_SENTIMENTS: ReadonlyArray<Sentiment> = ['positive', 'neutral', 'frustrated', 'angry']

function isValidSentiment(s: unknown): s is Sentiment {
  return typeof s === 'string' && (VALID_SENTIMENTS as readonly string[]).includes(s)
}

function isEscalating(trend: Sentiment[]): boolean {
  if (trend.length < 2) return false
  const last = trend[trend.length - 1]
  const prev = trend[trend.length - 2]
  // Escalada se chegou em angry, ou se virou frustrated/angry depois de neutral/positive.
  if (last === 'angry') return true
  const negatives: Sentiment[] = ['frustrated', 'angry']
  if (negatives.includes(last) && !negatives.includes(prev)) return true
  // Trend totalmente negativo nas últimas 3 mensagens.
  if (trend.length >= 3) {
    const tail = trend.slice(-3)
    if (tail.every((s) => negatives.includes(s))) return true
  }
  return false
}

function extractFenced(raw: string): string | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) return fenced[1].trim()
  const start = raw.indexOf('[')
  if (start >= 0) {
    const end = raw.lastIndexOf(']')
    if (end > start) return raw.slice(start, end + 1)
  }
  const start2 = raw.indexOf('{')
  if (start2 >= 0) {
    const end2 = raw.lastIndexOf('}')
    if (end2 > start2) return raw.slice(start2, end2 + 1)
  }
  return null
}

/**
 * Analisa as últimas mensagens do cliente e retorna trend de sentiment.
 * Considera apenas role='user'. Se houver < 1 mensagem do cliente: neutral.
 */
export async function analyzeSentiment(messages: Message[]): Promise<SentimentTrend> {
  const userMsgs = messages.filter((m) => m.role === 'user').slice(-ANALYSIS_WINDOW)
  if (userMsgs.length === 0) {
    return { trend: ['neutral'], is_escalating: false }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Skip graceful — sem API key, retorna neutral sem chamar.
    return { trend: ['neutral'], is_escalating: false }
  }

  const prompt = `Analise o sentimento de cada uma destas mensagens do cliente, em ordem cronológica.
Para cada uma, escolha exatamente UM rótulo: "positive", "neutral", "frustrated" ou "angry".
Retorne APENAS um array JSON entre \`\`\`json ... \`\`\` na ordem das mensagens.

Mensagens:
${userMsgs.map((m, i) => `${i + 1}. ${(m.content ?? '').replace(/\n/g, ' ').trim()}`).join('\n')}

Responda assim:
\`\`\`json
["neutral", "frustrated", "frustrated"]
\`\`\``

  try {
    const resp = await anthropicClient.complete({
      model: SENTIMENT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: SENTIMENT_MAX_TOKENS,
      temperature: SENTIMENT_TEMPERATURE,
    })
    const block = extractFenced(resp.content ?? '')
    if (!block) return { trend: userMsgs.map(() => 'neutral' as Sentiment), is_escalating: false }
    const parsed = JSON.parse(block) as unknown
    if (!Array.isArray(parsed)) {
      return { trend: userMsgs.map(() => 'neutral' as Sentiment), is_escalating: false }
    }
    const trend: Sentiment[] = parsed.map((p) => (isValidSentiment(p) ? p : 'neutral'))
    return { trend, is_escalating: isEscalating(trend) }
  } catch {
    return { trend: userMsgs.map(() => 'neutral' as Sentiment), is_escalating: false }
  }
}
