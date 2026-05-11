// lib/media/processor.ts — Orquestrador de pré-processamento de mídia.
// SPEC_MOTOR_BACKEND.md §8: roda ANTES do Planner.
//   - text → passa direto.
//   - audio → Whisper → "[ÁUDIO TRANSCRITO]: ..."
//   - image → Claude Vision → "[IMAGEM RECEBIDA]: ..."
//   - document → Claude Vision (PDF) → "[DOCUMENTO RECEBIDO]: ..."
// Caption (message.content) é concatenada ao prefixo prefixado por "\n\n".
// Erros de rede/API: skip graceful — retorna "[MÍDIA NÃO PROCESSADA: <tipo>]"
// + caption original e registra audit `media.processing_failed`.

import type { InboundMessage } from '@/types/message'
import { logAudit } from '@/lib/db/audit'
import { transcribeAudio } from './audio'
import { describeImage, parseDocument, type ImageMediaType } from './vision'

interface ProcessOptions {
  workspace_segment?: string
  /** Se fornecido, usado para baixar a mídia (ex.: canais autenticados). */
  channelDownload?: (url: string) => Promise<Buffer>
  /** Contexto opcional para audit em caso de falha. */
  workspace_id?: string | null
  client_id?: string | null
  session_id?: string | null
  trace_id?: string | null
}

const IMAGE_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp'])

function inferImageMediaType(url: string | undefined): ImageMediaType {
  if (!url) return 'image/jpeg'
  const lower = url.toLowerCase().split('?')[0]
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

function inferDocumentMediaType(url: string | undefined): string {
  if (!url) return 'application/pdf'
  const lower = url.toLowerCase().split('?')[0]
  if (lower.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}

async function downloadMedia(url: string, opts: ProcessOptions): Promise<Buffer> {
  if (opts.channelDownload) {
    return opts.channelDownload(url)
  }
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`download falhou ${res.status}`)
  }
  const arr = await res.arrayBuffer()
  return Buffer.from(arr)
}

function joinCaptionAndPrefixed(caption: string, prefixed: string): string {
  const trimmedCaption = caption?.trim() ?? ''
  if (!trimmedCaption) return prefixed
  return `${trimmedCaption}\n\n${prefixed}`
}

/**
 * Pré-processa a mídia anexa a uma InboundMessage e devolve o texto consolidado
 * que o motor verá. Nunca lança: em qualquer erro, faz skip graceful.
 */
export async function processInboundMedia(
  message: InboundMessage,
  opts: ProcessOptions = {},
): Promise<string> {
  // Texto puro ou sem mídia → passa direto.
  if (message.media_type === 'text' || !message.media_url) {
    return message.content
  }

  const auditCtx = {
    workspace_id: opts.workspace_id ?? null,
    client_id: opts.client_id ?? null,
    session_id: opts.session_id ?? null,
    trace_id: opts.trace_id ?? null,
  }

  try {
    const buffer = await downloadMedia(message.media_url, opts)

    if (message.media_type === 'audio') {
      const transcript = await transcribeAudio(buffer)
      const prefixed = `[ÁUDIO TRANSCRITO]: ${transcript}`
      return joinCaptionAndPrefixed(message.content, prefixed)
    }

    if (message.media_type === 'image') {
      const mediaType = inferImageMediaType(message.media_url)
      const description = await describeImage(buffer, mediaType, {
        workspace_segment: opts.workspace_segment,
      })
      const prefixed = `[IMAGEM RECEBIDA]: ${description}`
      return joinCaptionAndPrefixed(message.content, prefixed)
    }

    if (message.media_type === 'document') {
      const mediaType = inferDocumentMediaType(message.media_url)
      const content = await parseDocument(buffer, mediaType, {
        workspace_segment: opts.workspace_segment,
      })
      const prefixed = `[DOCUMENTO RECEBIDO]: ${content}`
      return joinCaptionAndPrefixed(message.content, prefixed)
    }

    // media_type desconhecido — skip silencioso preservando content.
    return message.content
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    // Fire-and-forget: logAudit já é tolerante a falhas internas.
    void logAudit(
      'media.processing_failed',
      {
        media_type: message.media_type,
        media_url: message.media_url,
        channel_message_id: message.channel_message_id,
        error: errMsg,
      },
      auditCtx,
    )
    const prefixed = `[MÍDIA NÃO PROCESSADA: ${message.media_type}]`
    return joinCaptionAndPrefixed(message.content, prefixed)
  }
}

// Helpers exportados para testes futuros — pertencem ao módulo, não à API pública.
export const __internals = {
  inferImageMediaType,
  inferDocumentMediaType,
  joinCaptionAndPrefixed,
  IMAGE_TYPES,
}
