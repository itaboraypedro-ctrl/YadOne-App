// components/chat/TypingIndicator.tsx — Indicador "AI digitando..." com 3 dots animados.

'use client'

import { Bot } from 'lucide-react'

export interface TypingIndicatorProps {
  name?: string
}

export function TypingIndicator({ name }: TypingIndicatorProps) {
  return (
    <div className="flex items-end gap-2 px-3 py-2" aria-live="polite">
      <div className="size-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
        <Bot className="size-3.5 text-primary" />
      </div>
      <div className="bg-card border rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
        {name && (
          <span className="text-xs text-muted-foreground mr-1">{name}</span>
        )}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground"
            style={{
              animation: 'bounce-dots 600ms infinite',
              animationDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default TypingIndicator
