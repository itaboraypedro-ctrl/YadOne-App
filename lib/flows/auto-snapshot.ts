// lib/flows/auto-snapshot.ts — Hook para snapshot automático ao publicar/editar fluxo (T27).
//
// Caller (endpoints de publish/edit) invoca triggerAutoSnapshot ANTES da operação
// destrutiva, garantindo que sempre há um ponto de restauração para rollback.
// O created_by usa prefixo 'system:' para distinguir de snapshots manuais.

import { createSnapshot } from './snapshot-manager'

export type AutoSnapshotReason = 'publish' | 'edit'

export async function triggerAutoSnapshot(
  flow_id: string,
  reason: AutoSnapshotReason,
): Promise<void> {
  await createSnapshot(flow_id, `system:${reason}`)
}
