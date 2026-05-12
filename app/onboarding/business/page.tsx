// app/onboarding/business/page.tsx — Etapa 1 do onboarding: "Conte sobre o seu negócio".
// Sem sidebar (fora do (app)). Layout centralizado.

import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress'
import { BusinessOnboardingFlow } from '@/components/onboarding/BusinessOnboardingFlow'

export const metadata = {
  title: 'Conte sobre o seu negócio — Yadone',
}

export default async function BusinessOnboardingPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Busca workspace + status do onboarding.
  const { data: wu } = await supabase
    .from('workspace_users')
    .select('workspace_id, workspaces(onboarding_status)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!wu?.workspace_id) {
    // Sem workspace ativo — manda pro cadastro do negócio (signup).
    redirect('/signup/business')
  }

  const rawWs = (wu as unknown as {
    workspaces?: { onboarding_status?: string | null } | { onboarding_status?: string | null }[]
  }).workspaces
  const ws = Array.isArray(rawWs) ? rawWs[0] : rawWs
  const status = ws?.onboarding_status ?? null

  if (status === 'business_complete' || status === 'agent_pending') {
    redirect('/onboarding/agent')
  }
  if (status === 'complete') {
    redirect('/conversations')
  }

  return (
    <main
      className="min-h-screen w-full"
      style={{ background: 'oklch(0.10 0.025 150)' }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-center justify-between">
          <Image
            src="/yadone/yadone-logo.png"
            alt="Yadone"
            width={110}
            height={32}
            className="h-7 w-auto object-contain"
            priority
          />
          <a
            href="/api/auth/logout"
            className="text-xs font-medium text-[oklch(0.65_0.018_150)] hover:text-[oklch(0.88_0.20_130)]"
          >
            Sair
          </a>
        </header>

        <div className="mt-8 sm:mt-10">
          <OnboardingProgress currentStep={1} />
        </div>

        <div className="mt-8 sm:mt-10">
          <h1 className="text-2xl font-bold tracking-tight text-[oklch(0.96_0.005_150)] sm:text-3xl">
            Conte sobre o seu negócio
          </h1>
          <p className="mt-2 text-sm text-[oklch(0.72_0.018_150)] sm:text-base">
            Vamos encontrar seu negócio para preencher seu perfil automaticamente.
            Você poderá editar tudo antes de confirmar.
          </p>
        </div>

        <div className="mt-6 sm:mt-8">
          <BusinessOnboardingFlow />
        </div>
      </div>
    </main>
  )
}
