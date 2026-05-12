// app/onboarding/page.tsx — Entrada do onboarding, redireciona pra etapa de negócio.

import { redirect } from 'next/navigation'

export default function OnboardingIndexPage() {
  redirect('/onboarding/business')
}
