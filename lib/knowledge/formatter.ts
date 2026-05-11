// lib/knowledge/formatter.ts — Formata items de KB para injeção em system prompt
// Respeita teto em tokens (default 4000). Itens são concatenados em ordem;
// se um item exceder o orçamento, é truncado token-a-token.

import { countTokens } from './chunker'
import { Tiktoken } from 'js-tiktoken/lite'
import cl100k_base from 'js-tiktoken/ranks/cl100k_base'

interface FormatItem {
  title: string
  content: string
}

const SEPARATOR = '\n\n---\n\n'
const DEFAULT_MAX_TOKENS = 4000

let encoderInstance: Tiktoken | null = null
function getEncoder(): Tiktoken {
  if (!encoderInstance) encoderInstance = new Tiktoken(cl100k_base)
  return encoderInstance
}

function truncateToTokens(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return ''
  const enc = getEncoder()
  const tokens = enc.encode(text)
  if (tokens.length <= maxTokens) return text
  return enc.decode(tokens.slice(0, maxTokens))
}

export function formatKnowledgeForPrompt(
  items: FormatItem[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
): string {
  if (items.length === 0 || maxTokens <= 0) return ''

  const blocks: string[] = []
  let used = 0

  for (const item of items) {
    const header = `### ${item.title}\n`
    const headerTokens = countTokens(header)
    const sepTokens = blocks.length === 0 ? 0 : countTokens(SEPARATOR)
    const remaining = maxTokens - used - headerTokens - sepTokens
    if (remaining <= 0) break

    const contentTokens = countTokens(item.content)
    let body = item.content
    if (contentTokens > remaining) {
      body = truncateToTokens(item.content, remaining)
    }

    const block = `${header}${body}`
    blocks.push(block)
    used += headerTokens + (contentTokens > remaining ? remaining : contentTokens) + sepTokens
  }

  return blocks.join(SEPARATOR) + (blocks.length > 0 ? SEPARATOR : '')
}
