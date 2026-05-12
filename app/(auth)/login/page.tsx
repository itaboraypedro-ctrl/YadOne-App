import Link from 'next/link'
import { AuthShell } from '../AuthShell'
import LoginForm from './LoginForm'

export const metadata = {
  title: 'Entrar — Yadone',
}

export default function LoginPage() {
  return (
    <AuthShell topRightLabel="Comece hoje mesmo" topRightHref="/signup">
      <h1 className="text-center text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">
        Olá
      </h1>
      <p className="mt-3 text-center text-neutral-500">
        Bem-vindo de volta ao Yadone
      </p>

      <div className="mt-10">
        <LoginForm />
      </div>

      <p className="mt-8 text-center text-sm text-neutral-500">
        Não tem uma conta?{' '}
        <Link
          href="/signup"
          className="font-semibold text-[oklch(0.45_0.16_140)] hover:underline"
        >
          Comece hoje mesmo
        </Link>
      </p>
    </AuthShell>
  )
}
