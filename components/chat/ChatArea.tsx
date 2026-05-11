'use client'

// components/chat/ChatArea.tsx — Container principal da área de chat.
// SPEC_FRONTEND_CONVERSATIONS.md §3.3.
//
// Compõe internamente ChatHeader (F09), AIStatusBanner (F09),
// ChatMessages (F10) e MessageInput (F11).

import { useRef, useState } from 'react'
import { useConversationDetail } from '@/hooks/useConversationDetail'
import { useUser } from '@/hooks/useUser'
import { ChatHeader } from './ChatHeader'
import { AIStatusBanner } from './AIStatusBanner'
import { ChatMessages, type ChatMessagesHandle } from './ChatMessages'
import { MessageInput } from './MessageInput'
import { ClientPanel } from '@/components/client-panel/ClientPanel'
import type { AIToggleResponse } from '@/lib/types/frontend'
import {
  buildSystemMessage,
  aiPausedText,
  aiResumedText,
} from '@/lib/format/system-messages'

interface ChatAreaProps {
  conversationId: string
}

function SkeletonChatHeader() {
  return (
    <div className="border-b p-3 flex items-center gap-3 bg-card">
      <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 bg-muted rounded animate-pulse" />
        <div className="h-3 w-56 bg-muted rounded animate-pulse" />
      </div>
    </div>
  )
}

export function ChatArea({ conversationId }: ChatAreaProps) {
  const { conversation, loading, error, refetch, setConversation } =
    useConversationDetail(conversationId)
  const { user } = useUser()
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [togglePending, setTogglePending] = useState(false)
  // F17 — painel de detalhes do cliente (Sheet lateral).
  const [clientPanelOpen, setClientPanelOpen] = useState(false)
  const messagesRef = useRef<ChatMessagesHandle>(null)

  const handleToggleAIPause = async (paused: boolean) => {
    setTogglePending(true)
    setConversation((prev) => (prev ? { ...prev, ai_paused: paused } : prev))
    try {
      const res = await fetch(`/api/conversations/${conversationId}/ai`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused }),
      })
      if (!res.ok) {
        console.error('handleToggleAIPause failed', res.status)
        await refetch()
        return
      }
      const data = (await res.json()) as AIToggleResponse
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              ai_paused: data.ai_paused ?? paused,
              ai_status: data.status,
            }
          : prev,
      )
      // Feedback visual: mensagem de sistema centralizada no chat (não persistida).
      const actor = user?.email ?? 'atendente'
      const text = paused ? aiPausedText(actor) : aiResumedText(actor)
      const systemMsg = buildSystemMessage({
        session_id: conversationId,
        workspace_id: conversation?.session.workspace_id ?? '',
        text,
      })
      messagesRef.current?.appendMessage(systemMsg)
    } catch (e) {
      console.error('handleToggleAIPause error', e)
      await refetch()
    } finally {
      setTogglePending(false)
    }
  }

  return (
    <section className="flex-1 flex flex-col bg-background min-w-0">
      {loading && <SkeletonChatHeader />}
      {!loading && error && (
        <div className="p-6 text-destructive text-sm">Erro: {error}</div>
      )}
      {!loading && !error && conversation && (
        <>
          <ChatHeader
            conversation={conversation}
            onToggleClientPanel={() => setClientPanelOpen((o) => !o)}
          />
          {!bannerDismissed && (
            <AIStatusBanner
              conversation={conversation}
              onToggleAIPause={handleToggleAIPause}
              pending={togglePending}
              onDismiss={() => setBannerDismissed(true)}
            />
          )}
          <div className="flex-1 overflow-hidden">
            <ChatMessages
              ref={messagesRef}
              conversationId={conversationId}
              client={conversation.client}
            />
          </div>
          <div className="shrink-0">
            <MessageInput
              conversationId={conversationId}
              aiPaused={conversation.ai_paused === true}
              onRequestPauseAI={() => handleToggleAIPause(true)}
              onMessageSent={(m) => messagesRef.current?.appendMessage(m)}
            />
          </div>
          <ClientPanel
            open={clientPanelOpen}
            onOpenChange={setClientPanelOpen}
            conversation={conversation}
            onToggleAIPause={handleToggleAIPause}
            togglePending={togglePending}
          />
        </>
      )}
    </section>
  )
}
