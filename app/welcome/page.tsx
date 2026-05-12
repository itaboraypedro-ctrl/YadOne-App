import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Bem-vindo — Yadone',
}

export default async function WelcomePage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: wu } = await supabase
    .from('workspace_users')
    .select('workspace_id, workspaces(name, pending_team_setup)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!wu) redirect('/signup/business')

  // @ts-expect-error supabase types do not infer the joined row shape here
  const workspaceName: string = wu.workspaces?.name ?? 'seu negócio'

  return (
    <main className="min-h-screen w-full bg-[oklch(0.10_0.025_150)] px-4 py-12 text-[oklch(0.95_0.005_150)]">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/yadone/yadone-logo.png"
            alt="Yadone"
            className="h-14 w-auto object-contain"
          />
        </div>

        <div
          className="w-full rounded-3xl p-10"
          style={{
            background: 'oklch(0.14 0.030 150)',
            border: '1px solid oklch(1 0 0 / 0.10)',
            boxShadow: '0 30px 80px -28px oklch(0 0 0 / 0.6)',
          }}
        >
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              background: 'oklch(0.88 0.20 130 / 0.18)',
              border: '1px solid oklch(0.88 0.20 130 / 0.45)',
              color: 'oklch(0.88 0.20 130)',
            }}
          >
            <span className="text-3xl">✓</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Cadastro concluído
          </h1>
          <p className="mt-3 text-[oklch(0.75_0.018_150)]">
            Tudo pronto pra{' '}
            <strong className="font-semibold text-[oklch(0.95_0.005_150)]">{workspaceName}</strong>.
          </p>

          <div
            className="mt-8 rounded-2xl p-6 text-left"
            style={{
              background: 'oklch(0.88 0.20 130 / 0.08)',
              border: '1px solid oklch(0.88 0.20 130 / 0.30)',
            }}
          >
            <h2 className="font-semibold text-[oklch(0.95_0.005_150)]">Próximos passos</h2>
            <p className="mt-2 text-sm leading-relaxed text-[oklch(0.80_0.015_150)]">
              Nosso time vai entrar em contato em até{' '}
              <strong className="font-semibold text-[oklch(0.95_0.005_150)]">24 horas</strong> pra
              configurar a plataforma, conectar o WhatsApp e treinar o agente com a voz da sua
              farmácia. Você não precisa fazer nada por enquanto — só esperar.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[oklch(0.80_0.015_150)]">
              Enquanto isso, você já pode explorar o painel.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/conversations"
              className="inline-flex items-center justify-center rounded-full px-8 py-3.5 text-base font-semibold transition hover:opacity-90"
              style={{
                background: 'oklch(0.88 0.20 130)',
                color: 'oklch(0.18 0.04 150)',
                boxShadow:
                  '0 14px 36px -10px oklch(0.88 0.20 130 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.5)',
              }}
            >
              Ir para o painel →
            </Link>
            <Link
              href="/settings/profile"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-8 py-3.5 text-base font-medium text-[oklch(0.85_0.012_150)] transition hover:bg-white/5"
            >
              Completar meu perfil
            </Link>
          </div>
        </div>

        <p className="mt-6 text-xs text-[oklch(0.65_0.018_150)]">
          Dúvidas? Escreva pra{' '}
          <a href="mailto:contato@yadone.com.br" className="font-medium hover:underline">
            contato@yadone.com.br
          </a>
        </p>
      </div>
    </main>
  )
}
