// hooks/useAIControl.ts — Hook centralizado para controle global e por canal de IA.
// SPEC_FRONTEND_CONVERSATIONS.md §3.2 + §6.
//
// Decisões:
// - Otimistic updates: muda state ANTES da resposta; em erro, reverte e console.error
//   (toast/UX final em F19).
// - derivedStatus calculado client-side a partir de global.ai_enabled + channels[].ai_enabled.
//   Não cobre 'paused_conversation' (tratado por hook diferente, F09/F10).
// - Estado inicial: GET /api/workspace/ai e GET /api/workspace/channels em paralelo.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AIStatus,
  AIToggleResponse,
  ChannelStatus,
} from '@/lib/types/frontend'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { useUser } from './useUser'

interface GlobalState {
  ai_enabled: boolean
  loading: boolean
}

export interface UseAIControlResult {
  global: GlobalState
  channels: ChannelStatus[]
  channelsLoading: boolean
  derivedStatus: AIStatus
  toggleGlobal: (enabled: boolean) => Promise<boolean>
  toggleChannel: (channelId: string, enabled: boolean) => Promise<boolean>
  refetch: () => Promise<void>
}

function computeDerivedStatus(
  globalEnabled: boolean,
  channels: ChannelStatus[],
): AIStatus {
  if (!globalEnabled) return 'paused_global'
  if (channels.length > 0 && channels.some((c) => !c.ai_enabled))
    return 'paused_channel'
  return 'active'
}

export function useAIControl(): UseAIControlResult {
  const [global, setGlobal] = useState<GlobalState>({
    ai_enabled: true,
    loading: true,
  })
  const [channels, setChannels] = useState<ChannelStatus[]>([])
  const [channelsLoading, setChannelsLoading] = useState<boolean>(true)
  const mountedRef = useRef(true)

  const fetchAll = useCallback(async () => {
    setGlobal((g) => ({ ...g, loading: true }))
    setChannelsLoading(true)
    try {
      const [aiRes, chRes] = await Promise.all([
        fetch('/api/workspace/ai', { method: 'GET', cache: 'no-store' }),
        fetch('/api/workspace/channels', { method: 'GET', cache: 'no-store' }),
      ])
      if (aiRes.ok) {
        const data = (await aiRes.json()) as AIToggleResponse
        if (mountedRef.current) {
          setGlobal({
            ai_enabled: data.ai_enabled ?? true,
            loading: false,
          })
        }
      } else {
        if (mountedRef.current) setGlobal((g) => ({ ...g, loading: false }))
        console.error('useAIControl: failed to fetch /api/workspace/ai', aiRes.status)
      }
      if (chRes.ok) {
        const data = (await chRes.json()) as { channels: ChannelStatus[] }
        if (mountedRef.current) setChannels(data.channels ?? [])
      } else {
        console.error(
          'useAIControl: failed to fetch /api/workspace/channels',
          chRes.status,
        )
      }
    } catch (err) {
      console.error('useAIControl: fetchAll error', err)
    } finally {
      if (mountedRef.current) {
        setChannelsLoading(false)
        setGlobal((g) => ({ ...g, loading: false }))
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void fetchAll()
    return () => {
      mountedRef.current = false
    }
  }, [fetchAll])

  const toggleGlobal = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      const prev = global.ai_enabled
      setGlobal((g) => ({ ...g, ai_enabled: enabled }))
      try {
        const res = await fetch('/api/workspace/ai', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        })
        if (!res.ok) {
          if (mountedRef.current) setGlobal((g) => ({ ...g, ai_enabled: prev }))
          console.error('toggleGlobal failed', res.status)
          return false
        }
        const data = (await res.json()) as AIToggleResponse
        if (mountedRef.current) {
          setGlobal((g) => ({ ...g, ai_enabled: data.ai_enabled ?? enabled }))
        }
        return true
      } catch (err) {
        if (mountedRef.current) setGlobal((g) => ({ ...g, ai_enabled: prev }))
        console.error('toggleGlobal error', err)
        return false
      }
    },
    [global.ai_enabled],
  )

  const toggleChannel = useCallback(
    async (channelId: string, enabled: boolean): Promise<boolean> => {
      const snapshot = channels
      setChannels((curr) =>
        curr.map((c) => (c.id === channelId ? { ...c, ai_enabled: enabled } : c)),
      )
      try {
        const res = await fetch(`/api/workspace/channels/${channelId}/ai`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        })
        if (!res.ok) {
          if (mountedRef.current) setChannels(snapshot)
          console.error('toggleChannel failed', res.status)
          return false
        }
        return true
      } catch (err) {
        if (mountedRef.current) setChannels(snapshot)
        console.error('toggleChannel error', err)
        return false
      }
    },
    [channels],
  )

  const derivedStatus = computeDerivedStatus(global.ai_enabled, channels)

  // ---- Realtime (F18) -------------------------------------------------------
  // Mudanças globais (workspace_agent_config) ou por canal (channel_configs)
  // disparam refetch para re-derivar status.
  const { user } = useUser()
  const workspaceId = user?.workspace_id

  useRealtimeSubscription<{ workspace_id: string; ai_enabled?: boolean }>({
    channel: `aicontrol:workspace:${workspaceId ?? 'none'}`,
    table: 'workspace_agent_config',
    event: 'UPDATE',
    filter: workspaceId ? `workspace_id=eq.${workspaceId}` : undefined,
    enabled: !!workspaceId,
    onPayload: () => {
      void fetchAll()
    },
  })

  useRealtimeSubscription<{ id: string; ai_enabled?: boolean }>({
    channel: `aicontrol:channels:${workspaceId ?? 'none'}`,
    table: 'channel_configs',
    event: 'UPDATE',
    filter: workspaceId ? `workspace_id=eq.${workspaceId}` : undefined,
    enabled: !!workspaceId,
    onPayload: () => {
      void fetchAll()
    },
  })

  // TODO F18b: subscription em crm_events (event_type='planner.decision') para
  // TypingIndicator "IA processando...". Defer porque exige acoplamento mais
  // profundo com ChatMessages.

  return {
    global,
    channels,
    channelsLoading,
    derivedStatus,
    toggleGlobal,
    toggleChannel,
    refetch: fetchAll,
  }
}
