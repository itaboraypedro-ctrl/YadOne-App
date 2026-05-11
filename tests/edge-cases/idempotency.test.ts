// tests/edge-cases/idempotency.test.ts — T24, cenários 11-13: idempotência.
//
// Cada describe usa jest.isolateModulesAsync (ou ciclo manual) para garantir
// que jest.doMock declarado dentro do bloco seja respeitado e não conflite
// com mocks de outros describes neste mesmo arquivo.

// ─────────────────────────────────────────────────────────────────────
// Cenário 11: withIdempotency dedup
// ─────────────────────────────────────────────────────────────────────

describe('Edge case 11: withIdempotency — handler chamado 1x para 3 webhooks idênticos', () => {
  it('mesmo channel_message_id 3x → handler chamado 1x; 2ª e 3ª retornam cached=true', async () => {
    const store = new Map<string, { key: string; result: unknown; processed_at: string; expires_at: string }>()

    const getKeyMock = jest.fn().mockImplementation(async (key: string) => store.get(key) ?? null)
    const createKeyMock = jest.fn().mockImplementation(async (key: string) => {
      if (store.has(key)) {
        throw new Error('duplicate key value violates unique constraint (23505)')
      }
      const v = {
        key,
        result: null,
        processed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      }
      store.set(key, v)
      return v
    })
    const updateResultMock = jest.fn().mockImplementation(async (key: string, result: unknown) => {
      const v = store.get(key)
      if (v) v.result = result
    })
    const deleteKeyMock = jest.fn().mockImplementation(async (key: string) => {
      store.delete(key)
    })

    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/lib/db/idempotency', () => ({
        getIdempotencyKey: getKeyMock,
        createIdempotencyKey: createKeyMock,
        updateIdempotencyResult: updateResultMock,
        deleteIdempotencyKey: deleteKeyMock,
      }))

      const { withIdempotency } = await import('@/lib/idempotency/store')

      const handler = jest.fn().mockResolvedValue({ ok: true, processed: true })
      const key = 'ycloud:msg-abc-123'

      const r1 = await withIdempotency(key, 'ws_1', handler)
      const r2 = await withIdempotency(key, 'ws_1', handler)
      const r3 = await withIdempotency(key, 'ws_1', handler)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(r1.cached).toBe(false)
      expect(r2.cached).toBe(true)
      expect(r3.cached).toBe(true)
      expect(r2.result).toEqual({ ok: true, processed: true })
      expect(r3.result).toEqual({ ok: true, processed: true })
    })
  })
})

// ─────────────────────────────────────────────────────────────────────
// Cenário 12: followup-worker — timer não dispara processMessage 2x
// ─────────────────────────────────────────────────────────────────────

describe('Edge case 12: timer disparado 2x — sessão avança 1x apenas', () => {
  it('2 execuções do worker → processMessage chamado 1x apenas', async () => {
    let sessionStatus: 'waiting' | 'active' = 'waiting'

    const getPendingTimersMock = jest.fn().mockImplementation(async () => [
      {
        id: 'timer_1',
        session_id: 'session_X',
        workspace_id: 'ws_1',
        client_id: 'client_1',
        target_node_id: 'node_target',
        scheduled_at: new Date().toISOString(),
        fired_at: null,
        cancelled_at: null,
      },
    ])
    const markTimerFiredMock = jest.fn().mockResolvedValue(undefined)
    const getSessionMock = jest.fn().mockImplementation(async () => ({
      id: 'session_X',
      workspace_id: 'ws_1',
      client_id: 'client_1',
      flow_id: 'flow_1',
      flow_version: 1,
      current_node_id: 'node_a',
      channel: 'whatsapp',
      status: sessionStatus,
      digression_state: 'none',
      objective_stack: [],
      collected_data: {},
      completed_steps: [],
      wait_until: null,
      expires_at: null,
      replan_count: 0,
      monitor_flags: [],
      current_trace_id: null,
      memory_processed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    const updateSessionMock = jest.fn().mockImplementation(async (_id: string, partial: { status?: string }) => {
      if (partial.status === 'active') sessionStatus = 'active'
    })
    const getClientMock = jest.fn().mockResolvedValue({
      id: 'client_1',
      workspace_id: 'ws_1',
      phone: '+5511999990000',
    })
    const processMessageMock = jest.fn().mockResolvedValue({
      trace_id: 't',
      session_id: 'session_X',
      status: 'sent',
    })

    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/lib/db/followup-timers', () => ({
        getPendingTimers: getPendingTimersMock,
        markTimerFired: markTimerFiredMock,
      }))
      jest.doMock('@/lib/db/sessions', () => ({
        getSession: getSessionMock,
        updateSession: updateSessionMock,
      }))
      jest.doMock('@/lib/db/clients', () => ({
        getClient: getClientMock,
      }))
      jest.doMock('@/lib/db/audit', () => ({
        logAudit: jest.fn().mockResolvedValue(undefined),
      }))
      jest.doMock('@/lib/db/crm-events', () => ({
        emitEvent: jest.fn().mockResolvedValue(undefined),
      }))
      jest.doMock('@/lib/engine/orchestrator', () => ({
        processMessage: processMessageMock,
      }))

      const { processFollowupTimers } = await import('@/lib/jobs/followup-worker')

      // Primeira execução: sessão está 'waiting' → avança e dispara processMessage
      await processFollowupTimers()
      expect(processMessageMock).toHaveBeenCalledTimes(1)
      expect(sessionStatus).toBe('active')

      // Segunda execução: sessão agora está 'active' → worker pula via markTimerFired
      await processFollowupTimers()
      expect(processMessageMock).toHaveBeenCalledTimes(1)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────
// Cenário 13: memory-updater 2x na mesma sessão
// ─────────────────────────────────────────────────────────────────────

describe('Edge case 13: memory-updater 2x na mesma sessão — 2ª execução é no-op', () => {
  it('1ª execução marca memory_processed=true; 2ª execução não vê sessões pendentes', async () => {
    const sessionsState = new Map<string, { memory_processed: boolean }>()
    sessionsState.set('session_M', { memory_processed: false })

    const updateSessionMock = jest.fn().mockImplementation(async (id: string, partial: { memory_processed?: boolean }) => {
      const cur = sessionsState.get(id)
      if (cur && partial.memory_processed !== undefined) {
        cur.memory_processed = partial.memory_processed
      }
    })

    const fromMock = jest.fn().mockImplementation((table: string) => {
      let filterMatched = false
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.in = () => builder
      builder.eq = (col: string, val: unknown) => {
        if (col === 'memory_processed' && val === false) filterMatched = true
        return builder
      }
      builder.limit = () => Promise.resolve({
        data:
          filterMatched && table === 'sessions'
            ? Array.from(sessionsState.entries())
                .filter(([, s]) => !s.memory_processed)
                .map(([id]) => ({ id, workspace_id: 'ws_1', client_id: 'client_1' }))
            : [],
        error: null,
      })
      return builder
    })

    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/lib/db/client', () => ({
        supabase: { from: fromMock },
      }))
      jest.doMock('@/lib/db/sessions', () => ({
        updateSession: updateSessionMock,
      }))
      jest.doMock('@/lib/db/messages', () => ({
        getHistory: jest.fn().mockResolvedValue([
          { role: 'user', content: 'oi' },
          { role: 'assistant', content: 'olá' },
        ]),
      }))
      jest.doMock('@/lib/memory/semantic', () => ({
        getSemantic: jest.fn().mockResolvedValue(null),
        upsertSemantic: jest.fn().mockResolvedValue(undefined),
      }))
      jest.doMock('@/lib/memory/episodic', () => ({
        indexEpisode: jest.fn().mockResolvedValue(undefined),
      }))
      jest.doMock('@/lib/memory/extractor', () => ({
        extractInsightsFromConversation: jest.fn().mockResolvedValue({
          preferred_name: null,
          preferences: [],
          last_service: null,
          observations: null,
          raw_insights: {},
        }),
        extractEpisodes: jest.fn().mockResolvedValue([]),
      }))
      jest.doMock('@/lib/db/audit', () => ({
        logAudit: jest.fn().mockResolvedValue(undefined),
      }))

      const { processMemoryUpdates } = await import('@/lib/jobs/memory-updater')

      const r1 = await processMemoryUpdates()
      expect(r1.processed).toBe(1)
      expect(updateSessionMock).toHaveBeenCalledWith('session_M', { memory_processed: true })

      const r2 = await processMemoryUpdates()
      expect(r2.processed).toBe(0)
      expect(updateSessionMock).toHaveBeenCalledTimes(1)
    })
  })
})
