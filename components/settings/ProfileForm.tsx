'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfile } from '@/app/settings/actions'

type Initial = {
  full_name: string
  phone: string
  avatar_url: string | null
}

export function ProfileForm({
  initial,
  email,
}: {
  initial: Initial
  email: string
}) {
  const [fullName, setFullName] = useState(initial.full_name)
  const [phone, setPhone] = useState(initial.phone)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? '')
  const [isPending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateProfile({
        full_name: fullName,
        phone,
        avatar_url: avatarUrl || undefined,
      })
      if (result.success) {
        toast.success('Perfil atualizado com sucesso.')
      } else {
        toast.error(result.error ?? 'Não foi possível salvar.')
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input
          id="full_name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatar">Avatar</Label>
        <div className="space-y-2">
          <Input
            id="avatar"
            type="url"
            placeholder="URL da imagem"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            disabled={isPending}
          />
          {/* TODO: implementar upload real para storage. Por enquanto aceita apenas URL textual. */}
          <p className="text-xs text-muted-foreground">
            Upload de arquivo em breve. Por enquanto, informe a URL de uma imagem.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} readOnly disabled />
        <p className="text-xs text-muted-foreground">
          <Link href="/settings/security" className="underline hover:text-foreground">
            Alterar em Segurança →
          </Link>
        </p>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}
