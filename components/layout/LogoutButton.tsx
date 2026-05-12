'use client'

// components/layout/LogoutButton.tsx — botão que chama POST /api/auth/logout
// e redireciona pra /login. Toast em caso de falha.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface LogoutButtonProps {
  variant?: 'default' | 'ghost'
  className?: string
}

export function LogoutButton({ variant = 'ghost', className }: LogoutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok && res.status !== 303 && res.status !== 0) {
        // 303 redirect já trata sessão, mas se 4xx/5xx tratamos como falha.
        throw new Error(`HTTP ${res.status}`)
      }
      router.push('/login')
      router.refresh()
    } catch (err) {
      setLoading(false)
      const msg = err instanceof Error ? err.message : 'erro desconhecido'
      toast.error(`Falha ao sair: ${msg}`)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10',
        className,
      )}
    >
      <LogOut />
      <span>{loading ? 'Saindo…' : 'Sair'}</span>
    </Button>
  )
}

export default LogoutButton
