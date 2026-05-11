// lib/knowledge/chunker.ts — Tokeniza com cl100k_base (compatível com text-embedding-3-small)
// e fatia em janelas com overlap para indexação RAG.
//
// Usa js-tiktoken/lite + ranks/cl100k_base para evitar carregar todos os encoders.

import { Tiktoken } from 'js-tiktoken/lite'
import cl100k_base from 'js-tiktoken/ranks/cl100k_base'

interface ChunkOptions {
  chunkSize?: number
  overlap?: number
}

export interface Chunk {
  text: string
  token_count: number
}

const DEFAULT_CHUNK_SIZE = 500
const DEFAULT_OVERLAP = 50

let encoderInstance: Tiktoken | null = null

function getEncoder(): Tiktoken {
  if (!encoderInstance) {
    encoderInstance = new Tiktoken(cl100k_base)
  }
  return encoderInstance
}

export function countTokens(text: string): number {
  if (!text) return 0
  return getEncoder().encode(text).length
}

export function chunkText(text: string, opts: ChunkOptions = {}): Chunk[] {
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE
  const overlap = opts.overlap ?? DEFAULT_OVERLAP

  if (chunkSize <= 0) throw new Error('[chunker] chunkSize deve ser > 0')
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error('[chunker] overlap deve ser >=0 e < chunkSize')
  }

  const trimmed = text?.trim() ?? ''
  if (!trimmed) return []

  const enc = getEncoder()
  const tokens = enc.encode(trimmed)
  if (tokens.length === 0) return []

  const stride = chunkSize - overlap
  const chunks: Chunk[] = []
  for (let start = 0; start < tokens.length; start += stride) {
    const slice = tokens.slice(start, start + chunkSize)
    if (slice.length === 0) break
    const decoded = enc.decode(slice)
    chunks.push({ text: decoded, token_count: slice.length })
    if (start + chunkSize >= tokens.length) break
  }
  return chunks
}
