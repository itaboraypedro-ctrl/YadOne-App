// lib/tools/handlers.ts — Map estático tool_id → handler async.
// O executor consulta este registry para resolver a função da tool.

import type { ToolExecutionContext } from '@/types/tools'
import { buscarHorariosLivres } from './implementations/buscar-horarios-livres'
import { criarAgendamento } from './implementations/criar-agendamento'
import { cancelarAgendamento } from './implementations/cancelar-agendamento'
import { buscarHistoricoCliente } from './implementations/buscar-historico-cliente'
import { registrarOuAtualizarCliente } from './implementations/registrar-ou-atualizar-cliente'

export type ToolHandler = (params: unknown, ctx: ToolExecutionContext) => Promise<unknown>

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  buscar_horarios_livres: buscarHorariosLivres,
  criar_agendamento: criarAgendamento,
  cancelar_agendamento: cancelarAgendamento,
  buscar_historico_cliente: buscarHistoricoCliente,
  registrar_ou_atualizar_cliente: registrarOuAtualizarCliente,
}
