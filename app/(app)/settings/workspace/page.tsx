import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { WorkspaceForm } from '@/components/settings/WorkspaceForm'

export default async function WorkspaceSettingsPage() {
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
    .select('id, name, cnpj, logo_url')
    .eq('id', membership.workspace_id)
    .maybeSingle()

  if (!workspace) {
    redirect('/unauthorized')
  }

  const ws = workspace as { id: string; name: string; cnpj?: string | null; logo_url?: string | null }

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informações da sua empresa no Yadone.
        </p>
      </header>
      <WorkspaceForm
        initial={{
          name: ws.name,
          cnpj: ws.cnpj ?? null,
          logo_url: ws.logo_url ?? null,
        }}
      />
    </div>
  )
}
