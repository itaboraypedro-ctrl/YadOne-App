'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { WhatsappBubble } from '@/components/lp/ui/WhatsappBubble'
import { SectionLabel } from '@/components/lp/ui/SectionLabel'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

function ComoFunciona() {
  const pinRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pinRef.current || !trackRef.current) return
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const track = trackRef.current!
      const pin = pinRef.current!
      const scrollAmount = () => track.scrollWidth - window.innerWidth
      gsap.to(track, {
        x: () => -scrollAmount(),
        ease: 'none',
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          end: () => `+=${scrollAmount()}`,
          onUpdate: (self) => {
            // Expose horizontal-scroll progress as a CSS var so the fluid bg can react.
            pin.style.setProperty('--journey-progress', String(self.progress))
          },
        },
      })
    })

    // Force a refresh once the page settles + once when fonts/images load,
    // so the scroll distance reflects the final layout.
    const refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 300)
    const onLoad = () => ScrollTrigger.refresh()
    window.addEventListener('load', onLoad)

    return () => {
      window.clearTimeout(refreshTimer)
      window.removeEventListener('load', onLoad)
      mm.revert()
    }
  }, [])

  return (
    <section id="como-funciona" className="bg-[--bg]">
      {/* Pinned area holds title + track so the title stays visible during horizontal scroll. */}
      <div
        ref={pinRef}
        className="lg:h-screen lg:overflow-hidden flex flex-col relative"
      >
        {/* Fluid background gradients — drift horizontally based on --journey-progress (0 → 1).
            Wrapped in a self-contained absolute layer so it never interferes with the
            flex flow or the GSAP-pinned track sizing. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="journey-bg-1" />
          <div className="journey-bg-2" />
          <div className="journey-bg-3" />
        </div>

        <div className="text-center px-8 pt-24 pb-6 lg:pt-36 lg:pb-10 flex-shrink-0 relative z-10">
          <h2 className="font-serif text-4xl md:text-5xl mb-2 text-[--text-primary]">
            Antes, durante e depois.
          </h2>
          <p className="text-xl text-[--text-secondary]">O ciclo completo de cuidado.</p>
        </div>

        <div
          ref={trackRef}
          className="flex flex-col lg:flex-row gap-24 lg:gap-0 lg:w-[300vw] flex-1 min-h-0 relative z-10"
        >
          {/* PAINEL 1 — ANTES */}
          <div className="journey-panel w-full lg:w-screen lg:h-full lg:flex-shrink-0 px-8 lg:px-16 py-8 lg:py-0 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
            <div>
              <SectionLabel>ANTES · 01</SectionLabel>
              <h3 className="font-serif text-3xl mb-4 text-[--text-primary]">
                O paciente chega antes de você abrir.
              </h3>
              <p className="text-[--text-secondary] leading-relaxed">
                São 22h. Um cliente pergunta sobre dosagem de ibuprofeno para criança. O Yadone responde com precisão, anota o perfil e já sugere o produto certo para quando a farmácia abrir.{' '}
                <strong className="font-semibold text-[--text-primary]">Você não perdeu a venda. E ele já te conhece.</strong>
              </p>
            </div>
            <div
              className="rounded-2xl p-6 backdrop-blur-md transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-20px_oklch(0_0_0_/_0.6)]"
              style={{
                background:
                  'linear-gradient(160deg, color-mix(in oklab, black 32%, transparent) 0%, color-mix(in oklab, black 42%, transparent) 100%)',
                border: '1px solid color-mix(in oklab, white 12%, transparent)',
                boxShadow: '0 1px 0 oklch(1 0 0 / 0.05) inset',
              }}
            >
              <WhatsappBubble
                type="received"
                message="Boa noite! Quanto de ibuprofeno posso dar para minha filha de 4 anos com febre?"
                time="22:14"
              />
              <WhatsappBubble
                type="sent"
                sender="YADONE"
                message="Oi! Para crianças de 4 anos, a dose é de 5 a 10mg/kg a cada 6-8 horas. Posso separar o Ibuprofeno Infantil 100mg/mL pra você pegar amanhã de manhã?"
                time="22:14"
              />
              <WhatsappBubble
                type="received"
                message="Sim por favor! Obrigada 🙏"
                time="22:15"
              />
            </div>
          </div>

          {/* PAINEL 2 — DURANTE */}
          <div className="journey-panel w-full lg:w-screen lg:h-full lg:flex-shrink-0 px-8 lg:px-16 py-8 lg:py-0 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
            <div>
              <SectionLabel>DURANTE · 02</SectionLabel>
              <h3 className="font-serif text-3xl mb-4 text-[--text-primary]">
                A venda que você não sabia que ia acontecer.
              </h3>
              <p className="text-[--text-secondary] leading-relaxed">
                O paciente comprou o antibiótico. O Yadone percebe que ele vai precisar de probiótico para proteger a flora intestinal. Ele sugere. O cliente agradece.{' '}
                <strong className="font-semibold text-[--text-primary]">O ticket médio sobe. Sem forçar. Sem vender. Só cuidando.</strong>
              </p>
            </div>
            <div
              className="rounded-2xl p-6 backdrop-blur-md transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-20px_oklch(0_0_0_/_0.6)]"
              style={{
                background:
                  'linear-gradient(160deg, color-mix(in oklab, black 32%, transparent) 0%, color-mix(in oklab, black 42%, transparent) 100%)',
                border: '1px solid color-mix(in oklab, white 12%, transparent)',
                boxShadow: '0 1px 0 oklch(1 0 0 / 0.05) inset',
              }}
            >
              <WhatsappBubble
                type="sent"
                sender="YADONE"
                message="Perfeito! Seu antibiótico está separado. Uma dica: durante o tratamento, um probiótico ajuda a proteger a flora intestinal. Quer que eu inclua o Lactobacilos na sua compra?"
                time="10:32"
              />
              <WhatsappBubble
                type="received"
                message="Não sabia disso! Pode incluir sim."
                time="10:33"
              />
            </div>
          </div>

          {/* PAINEL 3 — DEPOIS */}
          <div className="journey-panel w-full lg:w-screen lg:h-full lg:flex-shrink-0 px-8 lg:px-16 py-8 lg:py-0 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
            <div>
              <SectionLabel>DEPOIS · 03</SectionLabel>
              <h3 className="font-serif text-3xl mb-4 text-[--text-primary]">
                O lembrete que vale uma recompra.
              </h3>
              <p className="text-[--text-secondary] leading-relaxed">
                10 dias depois, o tratamento acaba. O Yadone envia um áudio personalizado com a voz da farmácia lembrando o paciente.{' '}
                <strong className="font-semibold text-[--text-primary]">Não é um spam. É o farmacêutico que você confia aparecendo na hora certa.</strong>
              </p>
            </div>
            <div
              className="rounded-2xl p-6 backdrop-blur-md transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-20px_oklch(0_0_0_/_0.6)]"
              style={{
                background:
                  'linear-gradient(160deg, color-mix(in oklab, black 32%, transparent) 0%, color-mix(in oklab, black 42%, transparent) 100%)',
                border: '1px solid color-mix(in oklab, white 12%, transparent)',
                boxShadow: '0 1px 0 oklch(1 0 0 / 0.05) inset',
              }}
            >
              <WhatsappBubble
                type="sent"
                sender="FARMÁCIA"
                isAudio
                message=""
                time="14:00"
              />
              <p className="italic text-xs text-[--text-muted] -mt-1 mb-2 px-1">
                (Oi Ana! Seu antibiótico acaba em 3 dias. Quer que a gente já separe a próxima caixa?)
              </p>
              <WhatsappBubble
                type="received"
                message="Que atencioso! Pode separar sim, obrigada 💚"
                time="14:03"
              />
            </div>
          </div>
        </div>
      </div>

    </section>
  )
}

export default ComoFunciona
