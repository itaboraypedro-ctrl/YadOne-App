'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { loginAction, type LoginState } from './actions'
import { PasswordInput } from '../PasswordInput'

const initialState: LoginState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full py-3.5 text-base font-semibold transition hover:opacity-90 disabled:opacity-50"
      style={{
        background: 'oklch(0.88 0.20 130)',
        color: 'oklch(0.18 0.04 150)',
        boxShadow: '0 14px 36px -10px oklch(0.88 0.20 130 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.5)',
      }}
    >
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}

function ForgotPasswordButton() {
  return (
    <button
      type="button"
      className="text-sm font-medium text-[oklch(0.45_0.16_140)] transition hover:underline"
      onClick={() => alert('Em breve')}
    >
      Esqueceu a senha?
    </button>
  )
}

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-[oklch(0.55_0.18_140)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.55_0.18_140_/_0.15)]'

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="Email"
        className={inputClass}
      />

      <PasswordInput
        id="password"
        name="password"
        autoComplete="current-password"
        required
        placeholder="Senha"
        inputClass={inputClass}
      />

      <div className="flex justify-end">
        <ForgotPasswordButton />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  )
}
