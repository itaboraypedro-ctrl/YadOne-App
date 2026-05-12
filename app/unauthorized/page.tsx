import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Sem permissão</h1>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta área.
        </p>
        <Button asChild>
          <Link href="/conversations">Voltar ao dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
