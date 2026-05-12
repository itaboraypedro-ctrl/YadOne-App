'use client'

import Link from 'next/link'
import { Dialog as DialogPrimitive } from 'radix-ui'
import BusinessForm from '@/app/(auth)/signup/business/BusinessForm'

export function BusinessOnboardingDialog() {
  return (
    <DialogPrimitive.Root open>
      <DialogPrimitive.Portal>
        {/* Liquid-glass overlay — borra o app por trás (tint bem leve pra deixar visível) */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          style={{
            background: 'oklch(0.10 0.025 150 / 0.08)',
            backdropFilter: 'blur(16px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
          }}
        />

        {/* Modal — glass card translúcido com border highlight */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg max-h-[92vh] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-3xl p-7 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          style={{
            background:
              'linear-gradient(160deg, oklch(0.18 0.040 150 / 0.78) 0%, oklch(0.13 0.025 150 / 0.85) 100%)',
            backdropFilter: 'blur(20px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
            border: '1px solid oklch(1 0 0 / 0.14)',
            boxShadow:
              '0 30px 80px -20px oklch(0 0 0 / 0.6), 0 0 0 1px oklch(1 0 0 / 0.04), inset 0 1px 0 oklch(1 0 0 / 0.12)',
          }}
        >
          {/* halo lime sutil no topo do card pra reforçar o efeito premium */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-12 -top-px h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, oklch(0.88 0.20 130 / 0.5), transparent)',
            }}
          />

          <div className="flex flex-col items-center gap-2 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/yadone/yadone-logo.png"
              alt="Yadone"
              className="h-9 w-auto object-contain"
            />
            <DialogPrimitive.Title className="text-2xl font-bold tracking-tight text-[oklch(0.96_0.005_150)]">
              Conte sobre o seu negócio
            </DialogPrimitive.Title>
            <p className="text-sm text-[oklch(0.72_0.018_150)]">
              Isso ajuda nosso time a preparar o Yadone certo pra você. Leva 1 minuto.
            </p>
          </div>

          <BusinessForm />

          <div className="text-center text-xs text-[oklch(0.65_0.018_150)]">
            Quer fazer isso depois?{' '}
            <Link
              href="/api/auth/logout"
              className="font-medium text-[oklch(0.88_0.20_130)] hover:underline"
            >
              Sair da conta
            </Link>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
