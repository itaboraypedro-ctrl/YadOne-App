'use client'

// components/layout/ThemeToggle.tsx — Alterna entre dark/light via next-themes.

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Placeholder com mesmo footprint para evitar layout shift / hydration mismatch.
    return <div className="size-10" aria-hidden />
  }

  const current = theme === 'system' ? resolvedTheme : theme
  const isDark = current === 'dark'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className={cn(
            'relative size-10 rounded-lg flex items-center justify-center',
            'text-sidebar-foreground/70 hover:text-sidebar-foreground',
            'hover:bg-sidebar-accent transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          )}
        >
          <Sun
            className={cn(
              'absolute size-5 transition-all duration-300',
              isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100',
            )}
          />
          <Moon
            className={cn(
              'absolute size-5 transition-all duration-300',
              isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50',
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {isDark ? 'Modo claro' : 'Modo escuro'}
      </TooltipContent>
    </Tooltip>
  )
}
