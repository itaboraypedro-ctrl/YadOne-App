import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function BillingSettingsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('workspace_users')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    redirect('/unauthorized')
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('plan, created_at')
    .eq('id', membership.workspace_id)
    .maybeSingle()

  const ws = (workspace ?? { plan: 'trial', created_at: null }) as {
    plan: string | null
    created_at: string | null
  }

  const startedAt = ws.created_at
    ? new Date(ws.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—'

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie sua assinatura Yadone. Em breve disponível nesta área.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano ativo</p>
          <p className="text-lg font-medium mt-1 capitalize">{ws.plan ?? 'trial'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Início</p>
          <p className="text-lg font-medium mt-1">{startedAt}</p>
        </div>
      </div>
    </div>
  )
}
