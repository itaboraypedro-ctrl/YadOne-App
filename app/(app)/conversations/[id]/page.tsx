// app/(app)/conversations/[id]/page.tsx — Conversa selecionada (lista + chat).

import { ConversationList } from '@/components/conversations/ConversationList'
import { ChatArea } from '@/components/chat/ChatArea'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <>
      <ConversationList activeId={id} hideOnMobile />
      <ChatArea conversationId={id} />
    </>
  )
}
