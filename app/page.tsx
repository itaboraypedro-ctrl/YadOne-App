import type { Metadata } from 'next'
import Nav from '@/components/lp/Nav'
import Hero from '@/components/lp/sections/Hero'
import Problema from '@/components/lp/sections/Problema'
import BotVsYadone from '@/components/lp/sections/BotVsYadone'
import ComoFunciona from '@/components/lp/sections/ComoFunciona'
import Funcionalidades from '@/components/lp/sections/Funcionalidades'
import PainelDados from '@/components/lp/sections/PainelDados'
import CtaFinal from '@/components/lp/sections/CtaFinal'
import Footer from '@/components/lp/Footer'

export const metadata: Metadata = {
  title: 'Yadone — Atenda cada cliente como se fosse o único',
  description:
    'O farmacêutico digital 24h que acompanha cada paciente pelo WhatsApp. Lembra o tratamento, avisa na hora certa e traz de volta para comprar.',
  openGraph: {
    title: 'Yadone — Atenda cada cliente como se fosse o único',
    description: 'Relacionamento com pacientes via WhatsApp para farmácias independentes.',
    url: 'https://yadone.com.br',
    siteName: 'Yadone',
  },
  robots: { index: true, follow: true },
}

export default function Home() {
  return (
    <main className="lp-root">
      <Nav />
      <div className="shell">
        <Hero />
        <div className="marquee">
          <span>Yadone · Brasil</span>
          <span className="pillline" />
          <span>Para sua farmácia</span>
        </div>
      </div>
      <Problema />
      <BotVsYadone />
      <ComoFunciona />
      <Funcionalidades />
      <PainelDados />
      <CtaFinal />
      <Footer />
    </main>
  )
}
