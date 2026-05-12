'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  DEFAULT_PROFESSIONAL_PERMISSIONS,
  PROFESSIONAL_AREAS,
  type ProfessionalPermissions,
  type ProfessionalPermissionArea,
  type PermissionLevel,
} from '@/lib/permissions'
import {
  inviteMember,
  updateMemberPermissions,
  removeMember,
} from '@/app/settings/actions'

export type Member = {
  id: string
  userId: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  role: 'owner' | 'professional'
  permissions: ProfessionalPermissions
  isActive: boolean
}

export type PendingInvite = {
  id: string
  email: string
  token: string
  createdAt: string
  expiresAt: string
}

type Props = {
  initialMembers: Member[]
  initialInvites: PendingInvite[]
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

function initialsFrom(name: string | null, email: string): string {
  const source = name || email || '?'
  const parts = source.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function formatDatePtBr(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function TeamManager({ initialMembers, initialInvites }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [invites] = useState<PendingInvite[]>(initialInvites)
  const [inviteEmail, setInviteEmail] = useState('')
  const [permissionsModal, setPermissionsModal] = useState<PermissionsModalState>(null)
  const [draftPermissions, setDraftPermissions] = useState<ProfessionalPermissions>({
    ...DEFAULT_PROFESSIONAL_PERMISSIONS,
  })
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)
  const [isPending, startTransition] = useTransition()

  function openInvite() {
    const email = inviteEmail.trim()
    if (!email) {
      toast.error('Informe um e-mail')
      return
    }
    setDraftPermissions({ ...DEFAULT_PROFESSIONAL_PERMISSIONS })
    setPermissionsModal({ mode: 'invite', email })
  }

  function openEdit(member: Member) {
    setDraftPermissions({ ...member.permissions })
    setPermissionsModal({ mode: 'edit', member })
  }

  function closeModal() {
    setPermissionsModal(null)
  }

  function setLevel(area: ProfessionalPermissionArea, level: PermissionLevel) {
    setDraftPermissions((prev) => ({ ...prev, [area]: level }))
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
          router.refresh()
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
        router.refresh()
      } else {
        setMembers(prev)
        toast.error(res.error ?? 'Erro ao remover membro')
        setMemberToRemove(null)
      }
    })
  }

  const modalTitle =
    permissionsModal?.mode === 'invite'
      ? `Convite para ${permissionsModal.email}`
      : permissionsModal?.mode === 'edit'
        ? permissionsModal.member.fullName || permissionsModal.member.email
        : ''

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Adicionar membro</h2>
          <p className="text-sm text-muted-foreground">
            Convide um profissional por e-mail e defina o nível de acesso a cada área.
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
        <h2 className="text-base font-semibold">Membros</h2>
        <ul className="space-y-2">
          {members.map((member) => {
            const isOwner = member.role === 'owner'
            return (
              <li
                key={member.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
              >
                <Avatar>
                  {member.avatarUrl ? (
                    <AvatarImage
                      src={member.avatarUrl}
                      alt={member.fullName ?? member.email}
                    />
                  ) : null}
                  <AvatarFallback>
                    {initialsFrom(member.fullName, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {member.fullName || member.email || 'Sem nome'}
                    </span>
                    {isOwner ? (
                      <Badge variant="default">Proprietário</Badge>
                    ) : (
                      <Badge variant="secondary">Profissional</Badge>
                    )}
                  </div>
                  {member.fullName && member.email ? (
                    <p className="text-sm text-muted-foreground truncate">
                      {member.email}
                    </p>
                  ) : null}
                </div>
                {!isOwner ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(member)}
                      disabled={isPending}
                    >
                      Permissões
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setMemberToRemove(member)}
                      disabled={isPending}
                    >
                      Remover
                    </Button>
                  </div>
                ) : null}
              </li>
            )
          })}

          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex items-center gap-4 rounded-lg border border-dashed border-border bg-card p-4"
            >
              <Avatar>
                <AvatarFallback>{initialsFrom(null, invite.email)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{invite.email}</span>
                  <Badge variant="outline">Convite enviado</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  Expira em {formatDatePtBr(invite.expiresAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={permissionsModal !== null} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>
              Defina o nível de acesso em cada área do Yadone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_repeat(3,minmax(0,auto))] gap-x-6 gap-y-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Área</span>
              {LEVELS.map((l) => (
                <span key={l.id} className="text-center">
                  {l.label}
                </span>
              ))}
            </div>
            <Separator />
            {PROFESSIONAL_AREAS.map((area) => (
              <div
                key={area.id}
                className="grid grid-cols-[1fr_repeat(3,minmax(0,auto))] gap-x-6 items-center py-2"
              >
                <span className="text-sm font-medium">{area.label}</span>
                {LEVELS.map((l) => (
                  <label
                    key={l.id}
                    className="flex justify-center items-center cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={`perm-${area.id}`}
                      value={l.id}
                      checked={draftPermissions[area.id] === l.id}
                      onChange={() => setLevel(area.id, l.id)}
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
                {memberToRemove?.fullName || memberToRemove?.email}
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
