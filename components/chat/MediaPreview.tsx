// components/chat/MediaPreview.tsx — preview de arquivos selecionados antes do envio.
// SPEC_FRONTEND_CONVERSATIONS.md §3.3.

'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { classifyFile, formatBytes } from '@/lib/format/file-icons'
import { cn } from '@/lib/utils'

export interface PendingAttachment {
  id: string
  file: File
  /** ObjectURL para preview de imagem (criar com URL.createObjectURL no callsite). */
  previewUrl?: string
}

interface MediaPreviewProps {
  attachments: PendingAttachment[]
  onRemove: (id: string) => void
  className?: string
}

export function MediaPreview({
  attachments,
  onRemove,
  className,
}: MediaPreviewProps) {
  if (attachments.length === 0) return null
  return (
    <div
      className={cn(
        'flex items-center gap-2 overflow-x-auto p-2 border-b',
        className,
      )}
    >
      {attachments.map((att) => {
        const info = classifyFile(att.file.type, att.file.name)
        return (
          <div key={att.id} className="relative shrink-0 group">
            {info.isImage && att.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={att.previewUrl}
                alt={att.file.name}
                className="size-20 object-cover rounded-md border"
              />
            ) : (
              <div className="size-20 rounded-md border bg-card p-2 flex flex-col items-center justify-center text-center">
                <info.Icon className="size-6 text-muted-foreground mb-1" />
                <span className="text-[10px] truncate w-full">
                  {att.file.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatBytes(att.file.size)}
                </span>
              </div>
            )}
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-1 -right-1 size-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(att.id)}
              aria-label={`Remover ${att.file.name}`}
            >
              <X className="size-3" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}

export default MediaPreview
