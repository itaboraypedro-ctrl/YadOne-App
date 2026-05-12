'use client'

// components/onboarding/OnboardingProgress.tsx — Barra de progresso 4 etapas.

type Step = { label: string; index: 1 | 2 | 3 | 4 }

const STEPS: Step[] = [
  { label: 'Negócio', index: 1 },
  { label: 'Agente', index: 2 },
  { label: 'WhatsApp', index: 3 },
  { label: 'Produtos', index: 4 },
]

export function OnboardingProgress({
  currentStep,
}: {
  currentStep: 1 | 2 | 3 | 4
}) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Progresso do onboarding">
      {STEPS.map((step, i) => {
        const done = step.index < currentStep
        const active = step.index === currentStep
        return (
          <li key={step.index} className="flex flex-1 items-center gap-2 sm:gap-3">
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs font-semibold transition"
                style={
                  done
                    ? {
                        background: 'oklch(0.88 0.20 130)',
                        color: 'oklch(0.18 0.04 150)',
                      }
                    : active
                    ? {
                        background: 'transparent',
                        color: 'oklch(0.88 0.20 130)',
                        border: '1.5px solid oklch(0.88 0.20 130)',
                        boxShadow: '0 0 0 4px oklch(0.88 0.20 130 / 0.12)',
                      }
                    : {
                        background: 'oklch(1 0 0 / 0.05)',
                        color: 'oklch(0.65 0.018 150)',
                        border: '1px solid oklch(1 0 0 / 0.12)',
                      }
                }
                aria-current={active ? 'step' : undefined}
              >
                {done ? '✓' : step.index}
              </div>
              <span
                className={`hidden sm:block text-[11px] font-medium tracking-tight ${
                  active
                    ? 'text-[oklch(0.95_0.005_150)]'
                    : done
                    ? 'text-[oklch(0.85_0.015_150)]'
                    : 'text-[oklch(0.62_0.018_150)]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-px flex-1 rounded-full"
                style={{
                  background: done
                    ? 'oklch(0.88 0.20 130 / 0.6)'
                    : 'oklch(1 0 0 / 0.10)',
                }}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
