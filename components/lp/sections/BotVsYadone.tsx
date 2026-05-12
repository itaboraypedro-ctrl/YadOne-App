'use client'

import { motion } from 'framer-motion'

type Row = {
  semYadone: string
  comYadone: string
}

const rows: Row[] = [
  {
    semYadone: 'O paciente comprou. Saiu. Não voltou. Você nem sabe que ele sumiu.',
    comYadone: 'Você sabe exatamente quem comprou, o que comprou e quando o tratamento vai acabar.',
  },
  {
    semYadone: 'O remédio acabou em casa. Ele esqueceu. Foi onde apareceu primeiro.',
    comYadone: '3 dias antes do tratamento acabar, ele recebe um áudio com a voz da sua farmácia.',
  },
  {
    semYadone: 'Cliente fiel virou cliente perdido. Em silêncio.',
    comYadone: 'Cliente fiel vira receita previsível. Todo mês.',
  },
  {
    semYadone: 'Você lembra dos 10 clientes que mais aparecem. Os outros 2.000? Não.',
    comYadone: 'Você lembra de cada um. Nome, tratamento, última compra, o que falou da família.',
  },
  {
    semYadone: 'A farmácia fecha às 22h. As dúvidas dos pacientes não.',
    comYadone: 'Às 23h, 4h, domingo de manhã. Sempre tem alguém respondendo com a sua voz.',
  },
  {
    semYadone: 'Você acha que o cliente voltou. Não tem certeza.',
    comYadone: 'Você vê no painel: quem voltou, quem está em risco, quanto voltou pro caixa.',
  },
  {
    semYadone: 'Você compete por atenção com quem tem 800 farmacêuticos e bilhões em marketing.',
    comYadone: 'Você ganha por proximidade — porque a sua farmácia lembrou primeiro.',
  },
]

const INK_DEEP = 'oklch(0.22 0.04 150)'
const INK_MID = 'oklch(0.45 0.025 150)'
const INK_MUTE = 'oklch(0.62 0.018 150)'
const LIME_DEEP = 'oklch(0.45 0.16 140)'
const LIME_DARK = 'oklch(0.55 0.18 140)'
const HAIR_LIGHT = 'oklch(0.88 0.02 140)'
const HAIR_LIME = 'oklch(0.55 0.18 140 / 0.25)'
const YADONE_BG = 'linear-gradient(180deg, oklch(0.96 0.06 140) 0%, oklch(0.94 0.07 140) 100%)'

function BotVsYadone() {
  return (
    <section
      id="diferenciais"
      className="px-4 sm:px-6 md:px-8 py-20"
      style={{ background: 'oklch(0.16 0.030 150)' }}
    >
      {/* Floating light card */}
      <div
        className="relative max-w-7xl mx-auto rounded-[32px] overflow-hidden px-6 sm:px-10 md:px-16 py-20 md:py-28"
        style={{
          background: 'oklch(0.96 0.012 95)',
          boxShadow:
            '0 1px 0 oklch(1 0 0 / 0.6) inset, 0 30px 80px -20px oklch(0 0 0 / 0.45)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              'radial-gradient(60% 60% at 85% 0%, oklch(0.88 0.20 130 / 0.18) 0%, transparent 60%), radial-gradient(50% 50% at 5% 100%, oklch(0.75 0.10 150 / 0.10) 0%, transparent 65%), linear-gradient(180deg, oklch(0.98 0.012 95) 0%, oklch(0.95 0.012 95) 100%)',
          }}
        />

        <div className="relative">
          <h2
            className="font-serif text-4xl md:text-6xl font-normal text-center mb-3"
            style={{ color: INK_DEEP }}
          >
            Você não precisa de um bot.
          </h2>
          <p className="text-xl text-center mb-6" style={{ color: INK_MID }}>
            Você precisa de presença.
          </p>
          <p
            className="text-base md:text-lg text-center max-w-3xl mx-auto mb-16 leading-relaxed"
            style={{ color: INK_MID }}
          >
            A diferença entre uma farmácia que perde cliente em silêncio e uma que fatura todo mês não está no atendimento. Está no que acontece depois dele.
          </p>

          {/* Comparison table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-5xl mx-auto"
            style={{
              gridTemplateColumns: '1fr 1.2fr',
              display: 'grid',
            }}
          >
            {/* Header row */}
            <div className="px-6 py-4 flex items-center">
              <span
                className="font-mono text-xs uppercase tracking-[0.22em]"
                style={{ color: INK_MUTE }}
              >
                SEM YADONE
              </span>
            </div>
            <div
              className="px-6 py-5 flex items-center gap-2 rounded-t-2xl relative"
              style={{
                background: YADONE_BG,
                borderTop: `2px solid ${LIME_DARK}`,
                borderLeft: `2px solid ${LIME_DARK}`,
                borderRight: `2px solid ${LIME_DARK}`,
                boxShadow:
                  'inset 0 1px 0 oklch(1 0 0 / 0.6), 0 -8px 24px -8px oklch(0.55 0.18 140 / 0.18)',
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  background: LIME_DARK,
                  boxShadow: '0 0 10px oklch(0.55 0.18 140 / 0.6)',
                }}
              />
              <span
                className="font-mono text-xs uppercase tracking-[0.22em] font-bold"
                style={{ color: LIME_DEEP }}
              >
                COM YADONE
              </span>
            </div>

            {/* Data rows */}
            {rows.map((row, i) => {
              const isLast = i === rows.length - 1
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                  style={{ display: 'contents' }}
                >
                  {/* Sem Yadone column (muted) */}
                  <div
                    className="px-6 py-5"
                    style={{
                      borderBottom: isLast ? 'none' : `1px solid ${HAIR_LIGHT}`,
                    }}
                  >
                    <p className="text-sm" style={{ color: INK_MUTE, opacity: 0.85 }}>
                      {row.semYadone}
                    </p>
                  </div>

                  {/* Com Yadone column (highlighted) */}
                  <div
                    className={`px-6 py-5 ${isLast ? 'rounded-b-2xl' : ''}`}
                    style={{
                      background: YADONE_BG,
                      borderLeft: `2px solid ${LIME_DARK}`,
                      borderRight: `2px solid ${LIME_DARK}`,
                      borderBottom: isLast
                        ? `2px solid ${LIME_DARK}`
                        : `1px solid ${HAIR_LIME}`,
                      boxShadow: isLast
                        ? '0 24px 56px -24px oklch(0.55 0.18 140 / 0.30)'
                        : undefined,
                    }}
                  >
                    <p
                      className="text-sm font-medium leading-relaxed"
                      style={{ color: INK_DEEP }}
                    >
                      {row.comYadone}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          <div className="mt-20 text-center max-w-5xl mx-auto">
            <div
              className="mx-auto mb-8 h-px w-32"
              aria-hidden
              style={{
                background:
                  'linear-gradient(90deg, transparent, oklch(0.55 0.18 140 / 0.6), transparent)',
              }}
            />
            <p
              className="font-serif text-4xl md:text-5xl italic text-balance"
              style={{ color: INK_DEEP }}
            >
              Bot responde. <span style={{ color: LIME_DARK }}>Yadone cuida.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BotVsYadone
