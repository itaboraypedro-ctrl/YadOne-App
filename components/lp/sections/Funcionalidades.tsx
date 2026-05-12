"use client"

import { motion } from 'framer-motion'
import { Bell, Mic, Clock, BookOpen, RefreshCw, Users } from 'lucide-react'

type Feature = {
  Icon: typeof Bell
  impact: string
  title: string
  before: string
  bold: string
  after?: string
  gradient: string
}

const features: Feature[] = [
  {
    Icon: Bell,
    impact: '+40% recompra',
    title: 'Lembrete de medicamento contínuo',
    before: 'O paciente não esquece de repor. ',
    bold: 'Você não perde a venda para o concorrente.',
    gradient:
      'radial-gradient(40% 40% at 100% 0%, oklch(0.85 0.20 130 / 0.22) 0%, transparent 70%)',
  },
  {
    Icon: Mic,
    impact: '3x mais resposta que texto',
    title: 'Áudio personalizado de follow-up',
    before: 'A voz da sua farmácia no ouvido do cliente. ',
    bold: 'Não é bot. É presença.',
    gradient:
      'radial-gradient(45% 45% at 0% 100%, oklch(0.78 0.20 135 / 0.24) 0%, transparent 65%)',
  },
  {
    Icon: Clock,
    impact: '0 custo adicional de pessoal',
    title: 'Atendimento 24h sem contratar',
    before: 'Responde às 22h com a ',
    bold: 'mesma qualidade das 10h da manhã.',
    gradient:
      'radial-gradient(55% 30% at 50% 0%, oklch(0.88 0.18 135 / 0.20) 0%, transparent 70%)',
  },
  {
    Icon: BookOpen,
    impact: '100% do contexto preservado',
    title: 'Histórico completo de cada paciente',
    before: 'Sabe o que comprou, quando, quanto. ',
    bold: 'Cada conversa continua de onde parou.',
    gradient:
      'radial-gradient(38% 38% at 0% 0%, oklch(0.82 0.18 130 / 0.22) 0%, transparent 68%)',
  },
  {
    Icon: RefreshCw,
    impact: 'Receita previsível todo mês',
    title: 'Recompra ativa antes do estoque acabar',
    before: '',
    bold: 'Antecipa a necessidade do paciente.',
    after: ' Entra em contato antes dele ir para o concorrente.',
    gradient:
      'radial-gradient(48% 48% at 100% 100%, oklch(0.80 0.20 135 / 0.22) 0%, transparent 65%)',
  },
  {
    Icon: Users,
    impact: 'Reativa clientes inativos',
    title: 'Campanhas de reengajamento',
    before: 'Paciente sumiu há 60 dias? ',
    bold: 'O Yadone vai atrás com o contexto certo.',
    gradient:
      'radial-gradient(30% 75% at 100% 50%, oklch(0.78 0.20 130 / 0.20) 0%, transparent 70%)',
  },
]

function Funcionalidades() {
  return (
    <section id="funcionalidades" className="bg-[--bg] pt-16 pb-32 px-8 md:px-16 relative overflow-hidden">
      {/* Ambient lime gradient orb top-right */}
      <div
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none"
        aria-hidden
        style={{
          background:
            'radial-gradient(closest-side, oklch(0.78 0.20 130 / 0.10), transparent)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative">
        <h2 className="font-serif font-normal text-4xl text-center mb-2 text-[--text-primary] text-balance">
          Cada recurso existe para uma razão:
        </h2>
        <p className="text-xl italic text-[--accent] text-center mb-16">
          você vender mais.
        </p>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {features.map(({ Icon, impact, title, before, bold, after, gradient }) => (
            <motion.div
              key={title}
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ y: -6 }}
              transition={{ y: { duration: 0.25, ease: [0.2, 0.7, 0.2, 1] } }}
              className="group relative rounded-2xl p-8 backdrop-blur-md cursor-default overflow-hidden transition-[border-color,box-shadow] duration-300 hover:shadow-[0_22px_56px_-18px_oklch(0.78_0.20_130_/_0.20)]"
              style={{
                background:
                  'linear-gradient(160deg, color-mix(in oklab, black 32%, transparent) 0%, color-mix(in oklab, black 44%, transparent) 100%)',
                border: '1px solid color-mix(in oklab, white 12%, transparent)',
              }}
            >
              {/* Unique gradient accent per card (positioned via radial 'at' keyword) */}
              <div
                className="absolute inset-0 pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity duration-500"
                aria-hidden
                style={{ background: gradient }}
              />

              {/* Content wrapper sits above the gradient layer */}
              <div className="relative">
                {/* Icon with circular bg */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-[background,transform] duration-300 group-hover:scale-110"
                  style={{
                    background: 'color-mix(in oklab, oklch(0.88 0.20 130) 12%, transparent)',
                    border: '1px solid color-mix(in oklab, oklch(0.88 0.20 130) 28%, transparent)',
                  }}
                >
                  <Icon strokeWidth={1.5} className="w-6 h-6 text-[--accent]" />
                </div>

                <p className="font-mono text-xs font-bold tracking-widest text-[--accent] mb-2 uppercase">
                  {impact}
                </p>
                <h3 className="font-sans font-semibold text-[--text-primary] text-lg mb-3 leading-snug">
                  {title}
                </h3>
                <p className="font-sans text-sm text-[--text-secondary] leading-relaxed">
                  {before}
                  <strong className="font-semibold text-[--text-primary]">{bold}</strong>
                  {after}
                </p>
              </div>

              {/* Subtle bottom hairline accent on hover */}
              <div
                className="absolute bottom-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                aria-hidden
                style={{
                  background:
                    'linear-gradient(90deg, transparent, oklch(0.88 0.20 130 / 0.45), transparent)',
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default Funcionalidades
