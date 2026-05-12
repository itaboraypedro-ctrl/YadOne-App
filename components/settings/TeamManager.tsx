'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DEFAULT_PERMISSIONS,
  MODULES,
  type PermissionsMap,
  type PermissionLevel,
  type ModuleId,
} from '@/lib/permissions'
import {
  inviteMember,
  updateMemberPermissions,
  removeMember,
} from '@/app/settings/actions'

export type Member = {
  id: string
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'owner' | 'member' | 'agent'
  permissions: PermissionsMap
  invited_at: string | null
  accepted_at: string | null
}

type Props = {
  initialMembers: Member[]
  workspaceId: string
}

type PermissionsModalState =
  | { mode: 'invite'; email: string }
  | { mode: 'edit'; member: Member }
  | null

const LEVELS: { id: PermissionLevel; label: string }[] = [
  { id: 'none', label: 'Sem acesso' },
  { id: 'view', label: 'Visualizar' },
  { id: 'edit', label: 'Editar' },
]

function initials(member: Member): string {
  const source = member.full_name || member.email || '?'
  const parts = source.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function TeamManager({ initialMembers }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [inviteEmail, setInviteEmail] = useState('')
  const [permissionsModal, setPermissionsModal] = useState<PermissionsModalState>(null)
  const [draftPermissions, setDraftPermissions] = useState<PermissionsMap>({
    ...DEFAULT_PERMISSIONS,
  })
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)
  const [isPending, startTransition] = useTransition()

  function openInvite() {
    if (!inviteEmail.trim()) {
      toast.error('Informe um e-mail')
      return
    }
    setDraftPermissions({ ...DEFAULT_PERMISSIONS })
    setPermissionsModal({ mode: 'invite', email: inviteEmail.trim() })
  }

  function openEdit(member: Member) {
    setDraftPermissions({ ...member.permissions })
    setPermissionsModal({ mode: 'edit', member })
  }

  function closeModal() {
    setPermissionsModal(null)
  }

  function setLevel(mod: ModuleId, level: PermissionLevel) {
    setDraftPermissions((prev) => ({ ...prev, [mod]: level }))
  }

  function submitPermissions() {
    const state = permissionsModal
    if (!state) return
    startTransition(async () => {
      if (state.mode === 'invite') {
        const res = await inviteMember(state.email, draftPermissions)
        if (res.success) {
          toast.success('Convite enviado')
          setInviteEmail('')
          setPermissionsModal(null)
          const tempId = `pending-${Date.now()}`
          setMembers((prev) => [
            ...prev,
            {
              id: tempId,
              user_id: tempId,
              email: state.email,
              full_name: null,
              avatar_url: null,
              role: 'member',
              permissions: draftPermissions,
              invited_at: new Date().toISOString(),
              accepted_at: null,
            },
          ])
        } else {
          toast.error(res.error ?? 'Erro ao convidar membro')
        }
      } else {
        const res = await updateMemberPermissions(state.member.id, draftPermissions)
        if (res.success) {
          toast.success('Permissões atualizadas')
          setMembers((prev) =>
            prev.map((m) =>
              m.id === state.member.id ? { ...m, permissions: draftPermissions } : m,
            ),
          )
          setPermissionsModal(null)
        } else {
          toast.error(res.error ?? 'Erro ao atualizar permissões')
        }
      }
    })
  }

  function confirmRemove() {
    if (!memberToRemove) return
    const target = memberToRemove
    startTransition(async () => {
      const prev = members
      setMembers((curr) => curr.filter((m) => m.id !== target.id))
      const res = await removeMember(target.id)
      if (res.success) {
        toast.success('Membro removido')
        setMemberToRemove(null)
      } else {
        setMembers(prev)
        toast.error(res.error ?? 'Erro ao remover membro')
        setMemberToRemove(null)
      }
    })
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Adicionar membro</h2>
          <p className="text-sm text-muted-foreground">
            Convide alguém por e-mail e defina o nível de acesso a cada módulo.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="invite-email">E-mail</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="nome@empresa.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={isPending}
            />
          </div>
          <Button type="button" onClick={openInvite} disabled={isPending}>
            Convidar
          </Button>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Membros ativos</h2>
        <ul className="space-y-2">
          {members.map((member) => {
            const isOwner = member.role === 'owner'
            const isPending = !isOwner && !member.accepted_at
            return (
              <li
                key={member.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
              >
                <Avatar>
                  {member.avatar_url ? (
                    <AvatarImage src={member.avatar_url} alt={member.full_name ?? member.email} />
                  ) : null}
                  <AvatarFallback>{initials(member)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {member.full_name || member.email || 'Sem nome'}
                    </span>
                    {isOwner ? (
                      <Badge variant="default">Proprietário</Badge>
                    ) : (
                      <Badge variant="secondary">Membro</Badge>
                    )}
                    {isPending ? <Badge variant="outline">Convite pendente</Badge> : null}
                  </div>
                  {member.full_name && member.email ? (
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                  ) : null}
                </div>
                {!isOwner ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(member)}
                    >
                      Permissões
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setMemberToRemove(member)}
                    >
                      Remover
                    </Button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      <Dialog open={permissionsModal !== null} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {permissionsModal?.mode === 'invite'
                ? `Convidar ${permissionsModal.email}`
                : 'Editar permissões'}
            </DialogTitle>
            <DialogDescription>
              Defina o nível de acesso em cada módulo do Yadone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_repeat(3,minmax(0,auto))] gap-x-6 gap-y-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Módulo</span>
              {LEVELS.map((l) => (
                <span key={l.id} className="text-center">
                  {l.label}
                </span>
              ))}
            </div>
            <Separator />
            {MODULES.map((mod) => (
              <div
                key={mod.id}
                className="grid grid-cols-[1fr_repeat(3,minmax(0,auto))] gap-x-6 items-center py-2"
              >
                <span className="text-sm font-medium">
                  {mod.icon} {mod.label}
                </span>
                {LEVELS.map((l) => (
                  <label key={l.id} className="flex justify-center items-center cursor-pointer">
                    <input
                      type="radio"
                      name={`perm-${mod.id}`}
                      value={l.id}
                      checked={draftPermissions[mod.id] === l.id}
                      onChange={() => setLevel(mod.id, l.id)}
                      className="size-4 cursor-pointer"
                      disabled={isPending}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitPermissions} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={memberToRemove !== null} onOpenChange={(o) => !o && setMemberToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover membro</DialogTitle>
            <DialogDescription>
              Tem certeza?{' '}
              <span className="font-medium text-foreground">
                {memberToRemove?.full_name || memberToRemove?.email}
              </span>{' '}
              perderá acesso imediatamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmRemove}
              disabled={isPending}
            >
              {isPending ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
