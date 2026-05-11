// app/api/upload/route.ts — POST upload de anexos para Supabase Storage.
// SPEC_FRONTEND_CONVERSATIONS.md §7 (anexos no envio manual).

import { NextRequest, NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
])
const BUCKET = 'attachments'

function isAllowedMime(mime: string): boolean {
  if (mime.startsWith('image/')) return true
  // Aceita audio/* com codecs (ex: "audio/webm;codecs=opus")
  const base = mime.split(';')[0].trim()
  if (base.startsWith('audio/') && ALLOWED_MIME.has(base)) return true
  return ALLOWED_MIME.has(mime)
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

function uuidish(): string {
  // crypto.randomUUID disponível em runtime Node 19+.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as { randomUUID: () => string }).randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function POST(req: NextRequest) {
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { workspace_id, svc } = auth.ctx

  const ctype = req.headers.get('content-type') ?? ''
  if (!ctype.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'expected_multipart_form_data' }, { status: 400 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: 'empty_file' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large', max_bytes: MAX_BYTES }, { status: 413 })
  }
  const mime = file.type || 'application/octet-stream'
  if (!isAllowedMime(mime)) {
    return NextResponse.json({ error: 'mime_not_allowed', mime_type: mime }, { status: 415 })
  }

  const path = `${workspace_id}/${uuidish()}-${safeName(file.name || 'file')}`

  const arrayBuf = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuf)

  const { error: upErr } = await svc.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  })
  if (upErr) {
    const msg = upErr.message?.toLowerCase() ?? ''
    if (msg.includes('not found') || msg.includes('bucket')) {
      return NextResponse.json(
        { error: 'bucket_attachments_missing', detail: upErr.message },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: 'upload_failed', detail: upErr.message }, { status: 500 })
  }

  const { data: pub } = svc.storage.from(BUCKET).getPublicUrl(path)
  const url = pub?.publicUrl ?? ''

  return NextResponse.json({
    url,
    path,
    size: file.size,
    mime_type: mime,
  })
}
