// lib/format/file-icons.ts — classifica mime types em ícones + labels.
// SPEC_FRONTEND_CONVERSATIONS.md §3.3.

import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File as FileIcon,
} from 'lucide-react'

export interface FileTypeInfo {
  Icon: typeof FileText
  label: string
  isImage: boolean
}

export function classifyFile(mimeType: string, fileName?: string): FileTypeInfo {
  if (mimeType.startsWith('image/')) {
    return { Icon: ImageIcon, label: 'Imagem', isImage: true }
  }
  if (mimeType === 'application/pdf') {
    return { Icon: FileText, label: 'PDF', isImage: false }
  }
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    /\.xlsx?$/.test(fileName ?? '')
  ) {
    return { Icon: FileSpreadsheet, label: 'Planilha', isImage: false }
  }
  if (mimeType.includes('word') || /\.docx?$/.test(fileName ?? '')) {
    return { Icon: FileText, label: 'Documento', isImage: false }
  }
  return { Icon: FileIcon, label: 'Arquivo', isImage: false }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
