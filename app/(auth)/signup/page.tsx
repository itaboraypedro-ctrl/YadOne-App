import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthShell } from '../AuthShell'
import SignupForm from './SignupForm'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Criar conta — Yadone',
}

export default async function SignupPage() {
  // Se já logado, mandar pro próximo passo natural.
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { data: wu } = await supabase
      .from('workspace_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    redirect(wu ? '/conversations' : '/signup/business')
  }

  return (
    <AuthShell topRightLabel="Já tenho conta" topRightHref="/login" theme="dark">
      <h1 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
        Comece hoje mesmo
      </h1>
      <p className="mt-2 text-center text-sm text-[oklch(0.70_0.018_150)]">
        Crie sua conta e dê o primeiro passo pra cuidar dos seus pacientes
      </p>

      <div className="mt-6">
        <SignupForm />
      </div>

      <p className="mt-5 text-center text-xs text-[oklch(0.70_0.018_150)]">
        Já tem uma conta?{' '}
        <Link
          href="/login"
          className="font-semibold text-[oklch(0.88_0.20_130)] hover:underline"
        >
          Entrar
        </Link>
      </p>
    </AuthShell>
  )
}
