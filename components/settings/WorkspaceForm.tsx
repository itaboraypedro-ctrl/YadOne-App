'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateWorkspace } from '@/app/settings/actions'

type Props = {
  initial: {
    name: string
    cnpj?: string | null
    logo_url?: string | null
  }
}

export function WorkspaceForm({ initial }: Props) {
  const [name, setName] = useState(initial.name)
  const [logoUrl, setLogoUrl] = useState(initial.logo_url ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateWorkspace({
        name,
        logo_url: logoUrl,
      })
      if (res.success) {
        toast.success('Workspace atualizado')
      } else {
        toast.error(res.error ?? 'Erro ao atualizar workspace')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="ws-name">Nome da empresa</Label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ws-cnpj">CNPJ</Label>
        <Input
          id="ws-cnpj"
          value={initial.cnpj ?? ''}
          readOnly
          disabled
          placeholder="Não informado"
        />
        <p className="text-xs text-muted-foreground">
          O CNPJ é definido no cadastro e não pode ser alterado por aqui.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ws-logo">URL do logo</Label>
        <Input
          id="ws-logo"
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://..."
          disabled={isPending}
        />
        <div className="flex items-center gap-2">
          <Input type="file" disabled className="cursor-not-allowed" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Upload em breve</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
