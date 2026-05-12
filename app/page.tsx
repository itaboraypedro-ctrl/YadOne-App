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
  title: 'Yadone — Cuide do seu paciente como a rede grande nunca vai conseguir',
  description:
    'Acompanhamos cada paciente da sua farmácia depois da compra. Lembramos do tratamento, avisamos quando o remédio acaba e trazemos o cliente de volta. Não com a rede.',
  openGraph: {
    title: 'Yadone — Cuide do seu paciente como a rede grande nunca vai conseguir',
    description:
      'Relacionamento contínuo com pacientes para farmácias independentes. Acompanhamento, lembrete, recompra ativa — tudo automatizado, com a voz da sua farmácia.',
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
