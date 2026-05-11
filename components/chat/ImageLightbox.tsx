// components/chat/ImageLightbox.tsx — Dialog dedicado para zoom/download de imagem.
// SPEC_FRONTEND_CONVERSATIONS.md §3.3.

'use client'

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'

interface ImageLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  alt?: string
}

export function ImageLightbox({
  open,
  onOpenChange,
  src,
  alt,
}: ImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 bg-background">
        <DialogTitle className="sr-only">Imagem</DialogTitle>
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt ?? 'Imagem'}
            className="max-w-full max-h-[85vh] object-contain rounded mx-auto"
          />
          <a
            href={src}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-12"
          >
            <Button variant="secondary" size="icon" aria-label="Baixar">
              <Download className="size-4" />
            </Button>
          </a>
          <DialogClose asChild>
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ImageLightbox
