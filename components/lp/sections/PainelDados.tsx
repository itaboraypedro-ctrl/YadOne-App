"use client"

import { motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { SectionLabel } from '@/components/lp/ui/SectionLabel'

const churn = [
  { name: 'Ana M.', color: 'bg-red-500', when: 'há 45 dias' },
  { name: 'Carlos R.', color: 'bg-yellow-500', when: 'há 31 dias' },
  { name: 'Maria S.', color: 'bg-green-500', when: 'há 28 dias' },
]

const abandono = [
  { drug: 'Metformina 500mg', pct: 34 },
  { drug: 'Losartana 50mg', pct: 28 },
  { drug: 'Omeprazol', pct: 19 },
]

function PainelDados() {
  return (
    <section
      id="dados"
      className="bg-[oklch(0.12_0.025_150)] py-32 px-8 md:px-16 relative overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(rgba(74,222,128,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SectionLabel>INTELIGÊNCIA DE DADOS</SectionLabel>
          <h2 className="font-serif text-4xl md:text-5xl mb-6 text-[--text-primary]">
            Os números são consequência.<br />O cuidado é a causa.
          </h2>
          <p className="text-[--text-secondary] leading-relaxed mb-8">
            Você sabe quantos pacientes não voltaram nos últimos 30 dias? Qual medicamento tem maior abandono? Quais horários geram mais engajamento?{' '}
            <strong className="font-semibold text-[--text-primary]">A rede grande sabe. Agora você também.</strong>
          </p>
          <div className="border-t border-[--accent] pt-6 mt-8">
            <p className="font-serif italic text-xl text-[--accent]">
              Farmácia independente com a inteligência que só a rede grande tinha.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="rounded-2xl p-6 backdrop-blur-md"
          style={{
            background:
              'linear-gradient(160deg, color-mix(in oklab, black 30%, transparent) 0%, color-mix(in oklab, black 44%, transparent) 100%)',
            border: '1px solid color-mix(in oklab, white 12%, transparent)',
            boxShadow:
              '0 1px 0 oklch(1 0 0 / 0.05) inset, 0 30px 80px -28px oklch(0.78 0.20 130 / 0.18)',
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div
              className="col-span-2 rounded-xl p-4 transition-transform duration-300 hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(160deg, color-mix(in oklab, black 18%, transparent), color-mix(in oklab, black 30%, transparent))',
                border: '1px solid color-mix(in oklab, white 10%, transparent)',
              }}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-mono text-xs text-[--accent] uppercase tracking-widest mb-1">TAXA DE RETENÇÃO</p>
                  <p
                    className="text-3xl font-bold text-[--accent]"
                    style={{ textShadow: '0 0 16px oklch(0.88 0.20 130 / 0.35)' }}
                  >
                    78%
                  </p>
                </div>
                <span
                  className="text-sm text-[--accent] px-2 py-0.5 rounded-full"
                  style={{
                    background: 'oklch(0.88 0.20 130 / 0.10)',
                    border: '1px solid oklch(0.88 0.20 130 / 0.30)',
                  }}
                >
                  ↑ 12%
                </span>
              </div>
              <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="w-full h-16 text-[--accent]">
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline points="0,50 40,35 80,30 120,20 160,12 200,8" fill="none" stroke="currentColor" strokeWidth="2" />
                <polyline points="0,50 40,35 80,30 120,20 160,12 200,8 200,60 0,60" fill="url(#grad)" />
              </svg>
            </div>

            <div
              className="rounded-xl p-4 transition-transform duration-300 hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(160deg, color-mix(in oklab, black 18%, transparent), color-mix(in oklab, black 30%, transparent))',
                border: '1px solid color-mix(in oklab, white 10%, transparent)',
              }}
            >
              <p className="font-mono text-xs text-[--accent] uppercase tracking-widest mb-1">EM RISCO DE CHURN</p>
              <p className="text-2xl font-bold text-[--text-primary] mb-3">23</p>
              {churn.map(({ name, color, when }) => (
                <div key={name} className="flex items-center gap-2 text-xs text-[--text-muted] mb-1">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span>{name}</span>
                  <span className="ml-auto">{when}</span>
                </div>
              ))}
            </div>

            <div
              className="rounded-xl p-4 transition-transform duration-300 hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(160deg, color-mix(in oklab, black 18%, transparent), color-mix(in oklab, black 30%, transparent))',
                border: '1px solid color-mix(in oklab, white 10%, transparent)',
              }}
            >
              <p className="font-mono text-xs text-[--accent] uppercase tracking-widest mb-3">ABANDONO DE TRATAMENTO</p>
              {abandono.map(({ drug, pct }) => (
                <div key={drug} className="mb-2">
                  <div className="flex justify-between text-xs text-[--text-muted] mb-1">
                    <span>{drug}</span>
                    <span>{pct}%</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'color-mix(in oklab, white 8%, transparent)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background:
                          'linear-gradient(90deg, oklch(0.78 0.20 130) 0%, oklch(0.88 0.20 130) 100%)',
                        boxShadow: '0 0 12px oklch(0.88 0.20 130 / 0.35)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              className="col-span-2 rounded-xl p-4 transition-transform duration-300 hover:-translate-y-0.5 relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in oklab, oklch(0.88 0.20 130) 14%, transparent) 0%, color-mix(in oklab, oklch(0.88 0.20 130) 4%, transparent) 100%)',
                border: '1px solid color-mix(in oklab, oklch(0.88 0.20 130) 32%, transparent)',
                boxShadow: 'inset 0 1px 0 oklch(0.88 0.20 130 / 0.15)',
              }}
            >
              <div className="flex justify-between items-center relative">
                <div>
                  <p className="font-mono text-xs text-[--accent] uppercase tracking-widest mb-1">RECEITA RECUPERADA</p>
                  <p
                    className="text-4xl font-bold text-[--accent]"
                    style={{ textShadow: '0 0 24px oklch(0.88 0.20 130 / 0.45)' }}
                  >
                    R$ 4.280
                  </p>
                  <p className="text-xs text-[--text-muted] mt-1">em recompras geradas pelo Yadone este mês</p>
                </div>
                <ArrowUp className="w-10 h-10 text-[--accent] opacity-60" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default PainelDados
