// types/client.ts — Clientes finais (com unificação cross-channel)

export type CRMStatus = 'new' | 'active' | 'inactive' | 'vip'

export interface Client {
  id: string
  workspace_id: string
  phone: string
  name: string | null
  email: string | null
  notes: string | null
  crm_status: CRMStatus
  crm_tags: string[] | null
  unified_id: string | null
  secondary_phones: string[]
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}
