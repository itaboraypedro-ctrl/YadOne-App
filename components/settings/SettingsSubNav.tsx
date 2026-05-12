'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type Role = 'owner' | 'member' | 'agent' | null

type NavItem = {
  href: string
  label: string
  ownerOnly?: boolean
}

const ITEMS: NavItem[] = [
  { href: '/settings/profile', label: 'Perfil' },
  { href: '/settings/security', label: 'Segurança' },
  { href: '/settings/workspace', label: 'Organização', ownerOnly: true },
  { href: '/settings/team', label: 'Equipe', ownerOnly: true },
  { href: '/settings/billing', label: 'Financeiro', ownerOnly: true },
]

export function SettingsSubNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const visible = ITEMS.filter((it) => !it.ownerOnly || role === 'owner')

  return (
    <nav className="flex flex-col gap-1">
      {visible.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md border-l-2 px-3 py-2 text-sm transition-colors',
              active
                ? 'border-primary bg-accent text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
