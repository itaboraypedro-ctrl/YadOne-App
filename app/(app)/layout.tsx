// app/(app)/layout.tsx — Layout autenticado do app (Sidebar + área principal).
// Auth guard defensivo + gate de workspace: se o user não tiver workspace ativo,
// mostra o popup obrigatório de pesquisa do negócio.

import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { BusinessOnboardingDialog } from '@/components/onboarding/BusinessOnboardingDialog'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: workspaceUser } = await supabase
    .from('workspace_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Sem workspace → renderiza o app por trás (pra o liquid-glass borrar)
  // e bloqueia toda interação com o popup obrigatório.
  if (!workspaceUser) {
    return (
      <>
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          <Sidebar />
          <main className="flex-1" />
        </div>
        <BusinessOnboardingDialog />
      </>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden">{children}</main>
    </div>
  )
}
