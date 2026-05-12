'use client'

// components/layout/UserMenu.tsx — dropdown do usuário no rodapé da sidebar.
// Recebe identidade via props (preenchidas no server) e expõe acessos a Configurações e Sair.

import { Settings as SettingsIcon } from 'lucide-react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogoutButton } from '@/components/layout/LogoutButton'

export interface UserMenuProps {
  fullName: string
  email: string
  avatarUrl?: string | null
}

function initialsFor(name: string, email: string): string {
  const source = (name || email || '').trim()
  if (!source) return '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase()
  }
  return source[0]!.toUpperCase()
}

export default function UserMenu({ fullName, email, avatarUrl }: UserMenuProps) {
  const initials = initialsFor(fullName, email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2 rounded-md p-2 outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label="Menu do usuário"
      >
        <Avatar>
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col items-start text-left">
          <span className="truncate text-sm font-medium text-sidebar-foreground">
            {fullName}
          </span>
          {email && email !== fullName ? (
            <span className="truncate text-xs text-sidebar-foreground/60">
              {email}
            </span>
          ) : null}
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{fullName}</span>
          {email ? (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          ) : null}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <SettingsIcon />
            <span>Configurações</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="px-1 py-0.5">
          <LogoutButton variant="ghost" />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
