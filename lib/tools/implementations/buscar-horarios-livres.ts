// lib/tools/implementations/buscar-horarios-livres.ts
// MVP: stub realista — gera 5 slots fictícios distribuídos nas próximas 24h.
// TODO (fase 2): integrar com calendário real (Trinks/Google Calendar) via /lib/calendar/*.

import type { ToolExecutionContext } from '@/types/tools'

interface Params {
  workspace_id?: string
  servico_id: string
  data?: string // ISO date opcional para filtrar slots a partir de uma data
}

interface Result {
  slots: string[] // ISO 8601
}

function isParams(p: unknown): p is Params {
  return typeof p === 'object' && p !== null && typeof (p as Params).servico_id === 'string'
}

export async function buscarHorariosLivres(
  params: unknown,
  _ctx: ToolExecutionContext,
): Promise<Result> {
  if (!isParams(params)) {
    throw new Error('buscarHorariosLivres: params inválidos')
  }

  const base = params.data ? new Date(params.data) : new Date()
  if (Number.isNaN(base.getTime())) {
    throw new Error('buscarHorariosLivres: data inválida')
  }

  // Gera 5 slots: +2h, +5h, +8h, +20h, +24h a partir de `base`, normalizando ao topo da hora.
  const offsets = [2, 5, 8, 20, 24]
  const slots = offsets.map((h) => {
    const d = new Date(base.getTime() + h * 60 * 60 * 1000)
    d.setMinutes(0, 0, 0)
    return d.toISOString()
  })

  return { slots }
}
