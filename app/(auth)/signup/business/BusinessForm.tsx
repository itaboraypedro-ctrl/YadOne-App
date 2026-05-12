'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createBusinessAction, type BusinessState } from './actions'

const initialState: BusinessState = { error: null }

const inputClass =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-[oklch(0.95_0.005_150)] placeholder:text-[oklch(0.65_0.018_150)] focus:border-[oklch(0.88_0.20_130)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.88_0.20_130_/_0.25)]'

const selectClass =
  inputClass +
  ' appearance-none cursor-pointer bg-[oklch(0.14_0.030_150)] [&>option]:bg-[oklch(0.14_0.030_150)] [&>option]:text-[oklch(0.95_0.005_150)]'

const SEGMENTS = [
  { value: 'farmacia', label: 'Farmácia' },
  { value: 'barbearia', label: 'Barbearia' },
  { value: 'salao', label: 'Salão de beleza' },
  { value: 'clinica', label: 'Clínica' },
  { value: 'estetica', label: 'Estética' },
  { value: 'outro', label: 'Outro' },
]

const CHALLENGES = [
  { value: 'perder_pacientes', label: 'Perder pacientes pra concorrência' },
  { value: 'baixa_recompra', label: 'Baixa taxa de recompra/retorno' },
  { value: 'falta_tempo_atendimento', label: 'Falta de tempo pra atender bem cada cliente' },
  { value: 'sem_dados', label: 'Não tenho dados de quem comprou e quando' },
  { value: 'concorrencia_rede', label: 'Competir com redes grandes' },
  { value: 'outro', label: 'Outro' },
]

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
      style={{
        background: 'oklch(0.88 0.20 130)',
        color: 'oklch(0.18 0.04 150)',
        boxShadow:
          '0 14px 36px -10px oklch(0.88 0.20 130 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.5)',
      }}
    >
      {pending ? 'Salvando…' : 'Concluir cadastro'}
    </button>
  )
}

export default function BusinessForm() {
  const [state, formAction] = useActionState(createBusinessAction, initialState)

  return (
    <form action={formAction} className="space-y-3">
      <input
        name="business_name"
        type="text"
        required
        placeholder="Nome do negócio"
        className={inputClass}
      />

      <select name="segment" required defaultValue="" className={selectClass}>
        <option value="" disabled>
          Segmento
        </option>
        {SEGMENTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <input
        name="units_count"
        type="number"
        min={1}
        required
        placeholder="Quantas unidades você tem?"
        className={inputClass}
      />

      <div className="grid grid-cols-3 gap-3">
        <input
          name="city"
          type="text"
          required
          placeholder="Cidade"
          className={inputClass + ' col-span-2'}
        />
        <input
          name="state"
          type="text"
          required
          maxLength={2}
          placeholder="UF"
          className={inputClass + ' uppercase'}
        />
      </div>

      <select name="biggest_challenge" required defaultValue="" className={selectClass}>
        <option value="" disabled>
          Qual seu maior desafio hoje?
        </option>
        {CHALLENGES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <input
        name="contact_phone"
        type="tel"
        placeholder="Telefone do negócio (opcional)"
        className={inputClass}
      />

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
