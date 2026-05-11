// app/(auth)/login/page.tsx — Tela de login (Server Component que monta o form client-side).

import LoginForm from './LoginForm'

export const metadata = {
  title: 'Entrar — Yadone',
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Yadone</h1>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h2>
            <p className="text-sm text-muted-foreground">
              Entre com seu email e senha para acessar suas conversas.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </main>
  )
}
