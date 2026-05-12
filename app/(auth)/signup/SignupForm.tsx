'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { signupAction, type SignupState } from './actions'
import { PhoneInput } from './PhoneInput'
import { PasswordInput } from '../PasswordInput'

const initialState: SignupState = { error: null }

const inputClass =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-[oklch(0.95_0.005_150)] placeholder:text-[oklch(0.65_0.018_150)] focus:border-[oklch(0.88_0.20_130)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.88_0.20_130_/_0.25)]'

const labelClass = 'mb-1 block text-[11px] font-medium tracking-wide text-[oklch(0.80_0.012_150)]'
const requiredStar = (
  <span className="ml-0.5 text-[oklch(0.88_0.20_130)]">*</span>
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-full py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
      style={{
        background: 'oklch(0.88 0.20 130)',
        color: 'oklch(0.18 0.04 150)',
        boxShadow:
          '0 14px 36px -10px oklch(0.88 0.20 130 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.5)',
      }}
    >
      {pending ? 'Criando conta…' : 'Criar conta'}
    </button>
  )
}

export default function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialState)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const emailValid = email.length === 0 || EMAIL_RE.test(email)
  const passwordsMatch = confirm.length === 0 || password === confirm
  const canSubmit =
    email.length > 0 &&
    EMAIL_RE.test(email) &&
    password.length >= 8 &&
    password === confirm

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className={labelClass}>Nome completo{requiredStar}</label>
        <input
          name="full_name"
          type="text"
          autoComplete="name"
          required
          placeholder="Como você quer ser chamado"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Email{requiredStar}</label>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
          pattern="^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"
          title="Informe um email válido (ex: voce@empresa.com)"
          className={inputClass}
        />
        {!emailValid ? (
          <p className="mt-1 text-xs text-red-400">Formato de email inválido.</p>
        ) : null}
      </div>

      <div>
        <label className={labelClass}>Telefone{requiredStar}</label>
        <PhoneInput name="phone" required inputClass={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Senha{requiredStar}</label>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mín. 8 caracteres"
            inputClass={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Confirmar{requiredStar}</label>
          <PasswordInput
            name="password_confirm"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha"
            inputClass={inputClass}
          />
        </div>
      </div>
      {!passwordsMatch ? (
        <p className="-mt-1 text-xs text-red-400">As senhas não conferem.</p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton disabled={!canSubmit} />

      <p className="pt-0.5 text-[11px] leading-snug text-[oklch(0.65_0.018_150)]">
        <span className="text-[oklch(0.88_0.20_130)]">*</span> campos obrigatórios. Ao criar conta
        você concorda com os termos de uso e a política de privacidade.
      </p>
    </form>
  )
}
