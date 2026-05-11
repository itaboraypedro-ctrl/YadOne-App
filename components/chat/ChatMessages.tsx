// components/chat/ChatMessages.tsx — Área de mensagens com paginação infinita e auto-scroll.
// SPEC_FRONTEND_CONVERSATIONS.md §3.3.

'use client'

import {
  forwardRef,
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useMessages } from '@/hooks/useMessages'
import { groupMessagesByDate } from '@/lib/format/messages'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import type {
  ConversationWithMeta,
  MessageWithMeta,
} from '@/lib/types/frontend'

export interface ChatMessagesProps {
  conversationId: string
  client?: ConversationWithMeta['client'] | null
  isAIProcessing?: boolean
}

export interface ChatMessagesHandle {
  appendMessage: (m: MessageWithMeta) => void
}

const NEAR_BOTTOM_PX = 80
const NEAR_TOP_PX = 80

export const ChatMessages = forwardRef<ChatMessagesHandle, ChatMessagesProps>(
  function ChatMessages(
    { conversationId, client, isAIProcessing = false },
    ref,
  ) {
    const {
      messages,
      loading,
      error,
      hasOlder,
      loadOlder,
      appendMessage,
    } = useMessages(conversationId)

    const containerRef = useRef<HTMLDivElement | null>(null)
    const bottomRef = useRef<HTMLDivElement | null>(null)
    // Snapshot para preservar posição ao carregar mais antigas.
    const preLoadHeightRef = useRef<number | null>(null)
    const isNearBottomRef = useRef(true)
    const lastMessageIdRef = useRef<string | null>(null)
    const previousLengthRef = useRef(0)

    const [pendingNewCount, setPendingNewCount] = useState(0)
    const [isLoadingOlder, setIsLoadingOlder] = useState(false)

    useImperativeHandle(
      ref,
      () => ({ appendMessage }),
      [appendMessage],
    )

    const groupedMessages = useMemo(
      () => groupMessagesByDate(messages),
      [messages],
    )

    // Detecta posição do scroll
    const onScroll = useCallback(() => {
      const el = containerRef.current
      if (!el) return
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight
      isNearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_PX
      if (isNearBottomRef.current && pendingNewCount > 0) {
        setPendingNewCount(0)
      }
      // Infinite scroll para cima
      if (
        el.scrollTop <= NEAR_TOP_PX &&
        hasOlder &&
        !isLoadingOlder &&
        !loading
      ) {
        void handleLoadOlder()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasOlder, isLoadingOlder, loading, pendingNewCount])

    const handleLoadOlder = useCallback(async () => {
      const el = containerRef.current
      if (!el || isLoadingOlder || !hasOlder) return
      setIsLoadingOlder(true)
      preLoadHeightRef.current = el.scrollHeight
      try {
        await loadOlder()
      } finally {
        setIsLoadingOlder(false)
      }
    }, [loadOlder, isLoadingOlder, hasOlder])

    // Após carregar mais antigas, ajusta scrollTop para preservar posição visual.
    useLayoutEffect(() => {
      const el = containerRef.current
      if (!el) return
      if (preLoadHeightRef.current != null) {
        const delta = el.scrollHeight - preLoadHeightRef.current
        if (delta > 0) {
          el.scrollTop = el.scrollTop + delta
        }
        preLoadHeightRef.current = null
      }
    }, [messages])

    // Auto-scroll quando chegam mensagens novas (no fim da lista).
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const prevLen = previousLengthRef.current
      const currLen = messages.length
      const last = messages[currLen - 1]
      const lastId = last?.id ?? null

      // Caso initial load: scroll bottom
      if (prevLen === 0 && currLen > 0) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight
        })
        lastMessageIdRef.current = lastId
        previousLengthRef.current = currLen
        return
      }

      // Mensagens novas adicionadas no final (não prepend de antigas).
      if (
        currLen > prevLen &&
        lastId &&
        lastId !== lastMessageIdRef.current &&
        // Garante que cresceu no fim (nova msg) — se tiver prepend, o id antigo sumiu mas não estamos tracking isso aqui.
        preLoadHeightRef.current == null
      ) {
        if (isNearBottomRef.current) {
          requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight
          })
        } else {
          setPendingNewCount((c) => c + (currLen - prevLen))
        }
      }

      lastMessageIdRef.current = lastId
      previousLengthRef.current = currLen
    }, [messages])

    const scrollToBottom = useCallback(() => {
      const el = containerRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
      setPendingNewCount(0)
    }, [])

    return (
      <div className="relative h-full">
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto px-1 py-2"
          data-testid="chat-messages"
        >
          {hasOlder && messages.length > 0 && (
            <div className="text-center py-2">
              <button
                type="button"
                onClick={() => void handleLoadOlder()}
                disabled={isLoadingOlder}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {isLoadingOlder ? 'Carregando...' : 'Carregar mais antigas'}
              </button>
            </div>
          )}

          {loading && messages.length === 0 && <SkeletonMessages />}

          {error && (
            <div className="mx-3 my-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Erro ao carregar mensagens: {error}
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Nenhuma mensagem ainda.
            </div>
          )}

          {groupedMessages.map((group, gi) => (
            <Fragment key={`${group.label}-${gi}`}>
              <DateSeparator label={group.label} />
              {group.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  client={
                    client
                      ? { id: client.id, name: client.name }
                      : null
                  }
                />
              ))}
            </Fragment>
          ))}

          {isAIProcessing && <TypingIndicator />}

          <div ref={bottomRef} />
        </div>

        {pendingNewCount > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            className={cn(
              'absolute bottom-4 left-1/2 -translate-x-1/2',
              'rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg',
              'hover:bg-primary/90 transition',
            )}
          >
            ↓ {pendingNewCount}{' '}
            {pendingNewCount === 1 ? 'nova mensagem' : 'novas mensagens'}
          </button>
        )}
      </div>
    )
  },
)

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3 px-3">
      <Separator className="flex-1" />
      <span className="text-xs text-muted-foreground capitalize">{label}</span>
      <Separator className="flex-1" />
    </div>
  )
}

function SkeletonMessages() {
  const items = [
    { side: 'left', w: 'w-40' },
    { side: 'right', w: 'w-56' },
    { side: 'left', w: 'w-32' },
    { side: 'right', w: 'w-48' },
  ] as const
  return (
    <div className="space-y-3 px-3 py-4">
      {items.map((it, i) => (
        <div
          key={i}
          className={cn(
            'flex items-end gap-2',
            it.side === 'right' ? 'justify-end' : 'justify-start',
          )}
        >
          {it.side === 'left' && (
            <div className="size-6 rounded-full bg-muted animate-pulse" />
          )}
          <div
            className={cn(
              'h-10 rounded-2xl bg-muted animate-pulse',
              it.w,
              it.side === 'right' ? 'rounded-br-sm' : 'rounded-bl-sm',
            )}
          />
          {it.side === 'right' && (
            <div className="size-6 rounded-full bg-muted animate-pulse" />
          )}
        </div>
      ))}
    </div>
  )
}

export default ChatMessages
