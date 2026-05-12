'use client'

// components/layout/SidebarItem.tsx — item de menu lateral. Esconde se permission='none',
// destaca rota ativa, e mostra badge "Somente leitura" se permission='view'.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface SidebarItemProps {
  icon: string
  label: string
  href: string
  permission: 'none' | 'view' | 'edit' | 'owner'
  /** Indenta visualmente sub-itens (ex.: Financeiro dentro de Configurações). */
  indent?: boolean
}

export function SidebarItem({
  icon,
  label,
  href,
  permission,
  indent = false,
}: SidebarItemProps) {
  const pathname = usePathname()

  if (permission === 'none') return null

  const isActive =
    pathname === href || (pathname?.startsWith(`${href}/`) ?? false)

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        indent && 'pl-7',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
      )}
    >
      <span aria-hidden className="text-base leading-none">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {permission === 'view' ? (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
          Somente leitura
        </Badge>
      ) : null}
    </Link>
  )
}

export default SidebarItem
