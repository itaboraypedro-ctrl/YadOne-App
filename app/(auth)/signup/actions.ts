'use server'

import { redirect } from 'next/navigation'
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server'

export type SignupState = { error: string | null }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// E.164: + seguido de 8-15 dígitos (DDI + número).
const PHONE_RE = /^\+\d{8,15}$/

export async function signupAction(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const phone = String(formData.get('phone') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('password_confirm') ?? '')

  if (!fullName) return { error: 'Informe seu nome.' }
  if (!email) return { error: 'Email é obrigatório.' }
  if (!EMAIL_RE.test(email)) return { error: 'Formato de email inválido.' }
  if (!phone) return { error: 'Telefone é obrigatório.' }
  if (!PHONE_RE.test(phone)) {
    return { error: 'Telefone inválido — informe DDI + número (ex: +55 11 98765-4321).' }
  }
  if (password.length < 8) {
    return { error: 'A senha precisa ter pelo menos 8 caracteres.' }
  }
  if (password !== passwordConfirm) {
    return { error: 'As senhas não conferem.' }
  }

  const service = createSupabaseServiceClient()

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  })

  if (createErr || !created.user) {
    if (createErr?.message?.toLowerCase().includes('already')) {
      return { error: 'Já existe uma conta com esse email. Faça login.' }
    }
    return { error: 'Não foi possível criar a conta. Tente novamente.' }
  }

  const userId = created.user.id

  await service
    .from('user_profiles')
    .upsert({ id: userId, full_name: fullName, phone }, { onConflict: 'id' })

  const supabase = await createSupabaseServerClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signInErr) {
    return { error: 'Conta criada, mas não foi possível iniciar sessão. Faça login.' }
  }

  redirect('/conversations')
}
