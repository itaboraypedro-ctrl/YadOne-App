// app/(app)/layout.tsx — Layout autenticado do app (Sidebar + área principal).
// Auth guard defensivo: se o middleware (F02) não tiver redirecionado, redireciona aqui.

import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden">{children}</main>
    </div>
  )
}
