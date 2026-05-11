'use client'

// components/layout/Sidebar.tsx — Sidebar lateral fixa (72px) com navegação por ícones.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, MessageSquare, Settings, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { useAIStatus } from '@/hooks/useAIStatus'
import type { AIStatus } from '@/lib/types/frontend'
import { cn } from '@/lib/utils'

interface NavItem {
  key: string
  label: string
  icon: LucideIcon
  href?: string
  disabled?: boolean
  tooltipLabel?: string
}

const NAV_ITEMS: NavItem[] = [
  { key: 'conversations', label: 'Conversas', icon: MessageSquare, href: '/conversations' },
  { key: 'contacts', label: 'Contatos', icon: Users, disabled: true, tooltipLabel: 'Contatos · Em breve' },
  { key: 'analytics', label: 'Métricas', icon: BarChart2, disabled: true, tooltipLabel: 'Métricas · Em breve' },
  { key: 'settings', label: 'Configurações', icon: Settings, disabled: true, tooltipLabel: 'Configurações · Em breve' },
]

function aiStatusDotClass(status: AIStatus): string {
  switch (status) {
    case 'active':
      return 'bg-secondary'
    case 'paused_global':
      return 'bg-destructive'
    case 'paused_channel':
    case 'paused_conversation':
      return 'bg-warning'
    default:
      return 'bg-muted-foreground'
  }
}

export function Sidebar() {
  const pathname = usePathname()
  const { status: aiStatus } = useAIStatus()

  return (
    <aside
      className={cn(
        'w-[72px] shrink-0 h-screen hidden md:flex flex-col items-center',
        'bg-sidebar border-r border-sidebar-border',
        'py-4',
      )}
    >
      {/* Logo */}
      <Link
        href="/conversations"
        aria-label="Yadone"
        className={cn(
          'size-11 rounded-lg bg-primary text-primary-foreground',
          'flex items-center justify-center font-bold text-xl',
          'hover:opacity-90 transition-opacity',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        )}
      >
        Y
      </Link>

      {/* Navegação principal */}
      <nav className="mt-6 flex flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            !item.disabled && !!item.href && pathname?.startsWith(item.href)
          const showAIDot = item.key === 'conversations'
          const tooltipLabel = item.tooltipLabel ?? item.label

          const buttonClasses = cn(
            'relative size-11 rounded-lg flex items-center justify-center',
            'transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
            item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
          )

          const inner = (
            <>
              <Icon className="size-5" />
              {showAIDot && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-1 right-1 size-2 rounded-full ring-2 ring-sidebar',
                    aiStatusDotClass(aiStatus),
                  )}
                />
              )}
            </>
          )

          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                {item.disabled || !item.href ? (
                  <button
                    type="button"
                    disabled
                    aria-label={tooltipLabel}
                    className={buttonClasses}
                  >
                    {inner}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    aria-label={tooltipLabel}
                    aria-current={isActive ? 'page' : undefined}
                    className={buttonClasses}
                  >
                    {inner}
                  </Link>
                )}
              </TooltipTrigger>
              <TooltipContent side="right">{tooltipLabel}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      {/* Espaço flex */}
      <div className="flex-1" />

      {/* Rodapé: ThemeToggle + slot para UserMenu */}
      <div className="flex flex-col items-center gap-2">
        <ThemeToggle />
        {/* UserMenu de F02 entra aqui — por ora um div placeholder 40x40 */}
        <div
          aria-hidden
          className="size-10 rounded-full bg-sidebar-accent/60"
        />
      </div>
    </aside>
  )
}
