import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, phone, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const initial = {
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    avatar_url: profile?.avatar_url ?? null,
  }

  return <ProfileForm initial={initial} email={user.email ?? ''} />
}
