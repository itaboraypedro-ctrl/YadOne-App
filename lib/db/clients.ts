// lib/db/clients.ts — Clientes finais (com unified_id, secondary_phones — gap #3)
// TODO: substituir tipos inline por import from '@/types/client' após merge da T02.

import { supabase } from './client'

interface Client {
  id: string
  workspace_id: string
  phone: string
  name: string | null
  email: string | null
  notes: string | null
  crm_status: string
  crm_tags: string[] | null
  unified_id: string | null
  secondary_phones: string[]
  created_at: string
  updated_at: string
}

interface ClientCreateOpts {
  name?: string | null
  email?: string | null
  notes?: string | null
  crm_status?: string
  crm_tags?: string[] | null
}

export async function findClientByPhone(workspace_id: string, phone: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('phone', phone)
    .maybeSingle()
  if (error) throw new Error(`findClientByPhone failed: ${error.message}`)
  return (data as Client) ?? null
}

export async function findClientBySecondaryPhone(
  workspace_id: string,
  phone: string,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', workspace_id)
    .contains('secondary_phones', [phone])
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`findClientBySecondaryPhone failed: ${error.message}`)
  return (data as Client) ?? null
}

export async function findClientByEmail(
  workspace_id: string,
  email: string,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('email', email)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`findClientByEmail failed: ${error.message}`)
  return (data as Client) ?? null
}

export async function getOrCreateClient(
  workspace_id: string,
  phone: string,
  opts: ClientCreateOpts = {},
): Promise<Client> {
  const existing = await findClientByPhone(workspace_id, phone)
  if (existing) return existing
  const { data, error } = await supabase
    .from('clients')
    .insert({
      workspace_id,
      phone,
      name: opts.name ?? null,
      email: opts.email ?? null,
      notes: opts.notes ?? null,
      crm_status: opts.crm_status ?? 'new',
      crm_tags: opts.crm_tags ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(`getOrCreateClient failed: ${error.message}`)
  return data as Client
}

export async function updateClient(id: string, partial: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update({ ...partial, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(`updateClient(${id}) failed: ${error.message}`)
  return data as Client
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getClient(${id}) failed: ${error.message}`)
  return (data as Client) ?? null
}
