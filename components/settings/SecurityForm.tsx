'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  changePassword,
  getActiveSessions,
  revokeOtherSessions,
} from '@/app/settings/actions'

type Session = {
  id: string
  device?: string | null
  ip?: string | null
  created_at?: string | null
  last_active_at?: string | null
}

export function SecurityForm() {
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const [isChanging, startChanging] = useTransition()

  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [isRevoking, startRevoking] = useTransition()

  async function loadSessions() {
    setLoadingSessions(true)
    const result = await getActiveSessions()
    if (result.error) {
      toast.error(result.error)
      setSessions([])
    } else {
      setSessions((result.sessions ?? []) as Session[])
    }
    setLoadingSessions(false)
  }

  useEffect(() => {
    void loadSessions()
  }, [])

  function onChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (newPwd !== confirmPwd) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    startChanging(async () => {
      const result = await changePassword(currentPwd, newPwd)
      if (result.success) {
        toast.success('Senha atualizada.')
        setCurrentPwd('')
        setNewPwd('')
        setConfirmPwd('')
      } else {
        toast.error(result.error ?? 'Não foi possível alterar a senha.')
      }
    })
  }

  function onRevokeOthers() {
    startRevoking(async () => {
      const result = await revokeOtherSessions()
      if (result.success) {
        toast.success('Outras sessões encerradas.')
        await loadSessions()
      } else {
        toast.error(result.error ?? 'Não foi possível encerrar as sessões.')
      }
    })
  }

  return (
    <div className="space-y-8 max-w-xl">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Trocar senha</h2>
          <p className="text-sm text-muted-foreground">
            Use uma senha forte e única para sua conta.
          </p>
        </div>
        <form onSubmit={onChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current_pwd">Senha atual</Label>
            <Input
              id="current_pwd"
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              disabled={isChanging}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_pwd">Nova senha</Label>
            <Input
              id="new_pwd"
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              disabled={isChanging}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_pwd">Confirmar nova senha</Label>
            <Input
              id="confirm_pwd"
              type="password"
              value={confirmPwd}
              onChange={(e) => {
                setConfirmPwd(e.target.value)
                if (mismatch) setMismatch(false)
              }}
              disabled={isChanging}
              required
            />
            {mismatch ? (
              <p className="text-xs text-destructive">
                A confirmação não coincide com a nova senha.
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={isChanging}>
            {isChanging ? 'Atualizando...' : 'Atualizar senha'}
          </Button>
        </form>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Sessões ativas</h2>
          <p className="text-sm text-muted-foreground">
            Dispositivos atualmente conectados à sua conta.
          </p>
        </div>

        {loadingSessions ? (
          <p className="text-sm text-muted-foreground">Carregando sessões...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem dados de sessões disponíveis no momento.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {sessions.map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{s.device ?? 'Dispositivo desconhecido'}</div>
                <div className="text-muted-foreground text-xs">
                  {s.ip ?? 'IP desconhecido'}
                  {s.last_active_at ? ` · último acesso ${s.last_active_at}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={onRevokeOthers}
          disabled={isRevoking}
        >
          {isRevoking ? 'Encerrando...' : 'Encerrar outras sessões'}
        </Button>
      </section>
    </div>
  )
}
