'use client'

import { LogOut, User as UserIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useUser } from '@/hooks/useUser'
import { logoutAction } from '@/app/(auth)/login/actions'

function initialFromEmail(email: string): string {
  const trimmed = email.trim()
  if (!trimmed) return '?'
  return trimmed[0]!.toUpperCase()
}

/**
 * UserMenu — para uso no rodapé da sidebar (72px). Mostra apenas o avatar;
 * abre dropdown ao clicar com info do usuário e ações.
 */
export default function UserMenu() {
  const { user, loading } = useUser()

  const email = user?.email ?? ''
  const initial = loading ? '…' : initialFromEmail(email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center justify-center rounded-md p-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Menu do usuário"
      >
        <Avatar>
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">
            {email || (loading ? 'Carregando…' : 'Não autenticado')}
          </span>
          {user?.workspace_name ? (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.workspace_name}
            </span>
          ) : null}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <UserIcon />
          <span>Perfil (em breve)</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <form action={logoutAction}>
          <button
            type="submit"
            className="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-hidden select-none hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
          >
            <LogOut />
            <span>Sair</span>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
