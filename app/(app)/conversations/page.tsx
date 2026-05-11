// app/(app)/conversations/page.tsx — Lista de conversas + estado vazio.

import { MessageSquare } from 'lucide-react'
import { ConversationList } from '@/components/conversations/ConversationList'

export default function ConversationsPage() {
  return (
    <>
      <ConversationList />
      <div className="hidden md:flex flex-1 flex-col items-center justify-center text-muted-foreground gap-3 px-6 text-center">
        <MessageSquare className="size-16 opacity-30" />
        <p className="text-sm">Selecione uma conversa</p>
      </div>
    </>
  )
}
