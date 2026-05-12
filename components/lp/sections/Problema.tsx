"use client"

import { motion } from 'framer-motion'

type CounterData = {
  id: string
  display: string
  desc: string
}

const counters: readonly CounterData[] = [
  { id: 'c1', display: '30%',  desc: 'dos brasileiros com doença crônica abandonam o tratamento contínuo' },
  { id: 'c2', display: '60%',  desc: 'dos pacientes acima de 40 anos com doença crônica não aderem corretamente ao tratamento' },
  { id: 'c3', display: '5 a 7×', desc: 'mais caro conquistar um cliente novo do que manter um atual' },
] as const

type Pain = { idx: string; title: string; before: string; bold: string; after?: string }

const pains: Pain[] = [
  {
    idx: '01',
    title: 'O paciente comprou. E sumiu.',
    before: '',
    bold: 'Sem follow-up, sem lembrança, sem retorno.',
    after: ' A próxima compra vai pra quem apareceu primeiro — e quase nunca é você.',
  },
  {
    idx: '02',
    title: 'A rede tem CRM, app, time de marketing.',
    before: 'Você tem WhatsApp e boa vontade. ',
    bold: 'Não é falta de esforço — é falta de ferramenta.',
    after: ' E ferramenta não se constrói com o tempo que você não tem.',
  },
  {
    idx: '03',
    title: 'Cada recompra perdida é receita invisível.',
    before: 'Medicamento contínuo esquecido ',
    bold: 'não volta sozinho.',
    after: ' E você nem sabe quantos pacientes já saíram pela porta de trás.',
  },
]

function Counter({ counter, index }: { counter: CounterData; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1], delay: index * 0.1 }}
      className="group relative z-10"
    >
      {/* Lime dot above each counter (visual node on the trajectory line) */}
      <div
        className="mx-auto mb-3 w-2 h-2 rounded-full"
        aria-hidden
        style={{
          background: 'oklch(0.88 0.20 130)',
          boxShadow: '0 0 0 4px oklch(0.88 0.20 130 / 0.16), 0 0 18px oklch(0.88 0.20 130 / 0.45)',
        }}
      />
      <span
        className="block font-mono text-7xl font-bold text-[--accent] leading-none transition-[text-shadow] duration-300 group-hover:[text-shadow:0_0_28px_oklch(0.88_0.20_130_/_0.45)]"
        style={{ textShadow: '0 0 18px oklch(0.88 0.20 130 / 0.18)' }}
      >
        {counter.display}
      </span>
      <p className="text-sm text-[oklch(0.70_0.015_150)] max-w-[200px] mx-auto mt-3 leading-relaxed">
        {counter.desc}
      </p>
    </motion.div>
  )
}

export default function Problema() {
  return (
    <section id="problema" className="bg-[--bg] py-32 px-8 md:px-16 overflow-hidden relative">
      {/* ============= BACKGROUND LAYERS ============= */}

      {/* Layer 1 — dot grid texture (faint, atmospheric) */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(oklch(0.97 0.005 150) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          opacity: 0.04,
        }}
      />

      {/* Layer 2 — large lime orb (top-left) */}
      <div
        className="absolute pointer-events-none"
        aria-hidden
        style={{
          top: '-220px',
          left: '-160px',
          width: '720px',
          height: '720px',
          background:
            'radial-gradient(closest-side, oklch(0.78 0.20 130 / 0.18), transparent)',
          filter: 'blur(60px)',
        }}
      />

      {/* Layer 3 — large deep-green orb (bottom-right) */}
      <div
        className="absolute pointer-events-none"
        aria-hidden
        style={{
          bottom: '-280px',
          right: '-180px',
          width: '780px',
          height: '780px',
          background:
            'radial-gradient(closest-side, oklch(0.55 0.18 140 / 0.16), transparent)',
          filter: 'blur(70px)',
        }}
      />

      {/* Layer 4 — soft ambient halo behind the counters */}
      <div
        className="absolute pointer-events-none"
        aria-hidden
        style={{
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '1000px',
          height: '460px',
          background:
            'radial-gradient(closest-side, oklch(0.30 0.05 150 / 0.35), transparent)',
          filter: 'blur(60px)',
        }}
      />

      {/* Layer 5 — oversized decorative em-dash behind the H2 (typographic ornament) */}
      <div
        className="absolute pointer-events-none select-none font-serif font-bold"
        aria-hidden
        style={{
          top: '2%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          fontSize: 'min(58vw, 720px)',
          lineHeight: '0.55',
          color: 'oklch(0.97 0.005 150)',
          opacity: 0.028,
          letterSpacing: '-0.05em',
        }}
      >
        —
      </div>

      {/* Layer 6 — corner brackets (top-left + bottom-right, abstract framing) */}
      <svg
        className="absolute top-12 left-10 w-12 h-12 pointer-events-none hidden md:block"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden
        style={{ opacity: 0.35 }}
      >
        <path
          d="M 1 16 L 1 1 L 16 1"
          stroke="oklch(0.88 0.20 130)"
          strokeWidth="1.5"
        />
      </svg>
      <svg
        className="absolute bottom-12 right-10 w-12 h-12 pointer-events-none hidden md:block"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden
        style={{ opacity: 0.35 }}
      >
        <path
          d="M 32 47 L 47 47 L 47 32"
          stroke="oklch(0.88 0.20 130)"
          strokeWidth="1.5"
        />
      </svg>

      {/* ============= CONTENT ============= */}

      <div className="relative">
        {/* Decorative top accent (vertical hairline) */}
        <div
          className="absolute top-[-72px] left-1/2 -translate-x-1/2 w-px h-12"
          aria-hidden
          style={{ background: 'linear-gradient(180deg, transparent, oklch(0.88 0.20 130 / 0.7))' }}
        />

        <h2
          id="problema-title"
          className="font-serif text-[clamp(40px,6vw,84px)] font-normal tracking-tight text-center text-[--text-primary] leading-tight max-w-5xl mx-auto mb-8 text-balance relative z-10"
        >
          A rede grande está roubando{' '}
          <span style={{ color: 'oklch(0.78 0.18 140)' }}>seu cliente no pós-venda.</span>
        </h2>
        <p className="text-lg md:text-xl text-[--text-secondary] text-center max-w-3xl mx-auto mb-24 leading-relaxed relative z-10">
          Você atende com excelência. Conhece o nome, o tratamento, a família. Mas no momento que o paciente sai da sua farmácia, ele entra no campo de batalha — e quem aparece primeiro leva a próxima venda.
        </p>

        {/* Counters with trajectory line passing through them */}
        <div className="relative flex flex-col md:flex-row justify-center gap-12 md:gap-20 mb-28 text-center">
          {/* Decorative dashed trajectory SVG (hidden on mobile) */}
          <svg
            className="hidden md:block absolute left-0 right-0 mx-auto pointer-events-none"
            viewBox="0 0 1000 60"
            preserveAspectRatio="none"
            aria-hidden
            style={{
              top: '4px',
              maxWidth: '900px',
              height: '60px',
              opacity: 0.4,
            }}
          >
            <path
              d="M 0 30 Q 250 6, 500 32 T 1000 14"
              fill="none"
              stroke="oklch(0.88 0.20 130)"
              strokeWidth="1"
              strokeDasharray="4 8"
            />
          </svg>

          {counters.map((c, i) => (
            <Counter key={c.id} counter={c} index={i} />
          ))}
        </div>

        <p className="text-lg md:text-xl text-[--text-secondary] text-center max-w-3xl mx-auto mb-16 leading-relaxed relative z-10">
          Cada paciente que abandona o tratamento é receita que some do seu caixa — e vai para o caixa de quem lembrou dele primeiro.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto relative z-10">
          {pains.map((pain, index) => (
            <motion.div
              key={pain.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.12 }}
              whileHover={{ y: -4 }}
              className="group relative rounded-2xl px-6 py-6 transition-[background,box-shadow,border-color] duration-300"
              style={{
                borderLeft: '2px solid oklch(0.88 0.20 130 / 0.7)',
                background:
                  'linear-gradient(135deg, color-mix(in oklab, black 32%, transparent) 0%, color-mix(in oklab, black 24%, transparent) 100%)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                boxShadow: '0 1px 0 oklch(1 0 0 / 0.04) inset, 0 8px 24px oklch(0 0 0 / 0.18)',
              }}
            >
              <span
                className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2 inline-block"
                style={{ color: 'oklch(0.78 0.18 140 / 0.8)' }}
              >
                · {pain.idx}
              </span>
              <h3 className="font-semibold text-[--text-primary] mb-2 leading-snug text-balance">
                {pain.title}
              </h3>
              <p className="text-sm text-[--text-secondary] leading-relaxed">
                {pain.before}
                <strong className="font-semibold text-[--text-primary]">{pain.bold}</strong>
                {pain.after}
              </p>

              <div
                className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                aria-hidden
                style={{
                  background:
                    'radial-gradient(60% 40% at 0% 0%, oklch(0.88 0.20 130 / 0.10) 0%, transparent 70%)',
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
