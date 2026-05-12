import { redirect } from 'next/navigation'
import { AuthShell } from '../../AuthShell'
import BusinessForm from './BusinessForm'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Dados do negócio — Yadone',
}

export default async function BusinessPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signup')

  // Se já tem workspace ativo, pula direto pro welcome.
  const { data: wu } = await supabase
    .from('workspace_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (wu) redirect('/welcome')

  return (
    <AuthShell topRightLabel="Sair" topRightHref="/api/auth/logout" theme="dark">
      <h1 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
        Conte sobre o seu negócio
      </h1>
      <p className="mt-2 text-center text-sm text-[oklch(0.70_0.018_150)]">
        Isso ajuda nosso time a preparar o Yadone certo pra você
      </p>

      <div className="mt-6">
        <BusinessForm />
      </div>
    </AuthShell>
  )
}
