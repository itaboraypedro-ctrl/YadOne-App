import type { Metadata } from 'next'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Yadone — Atendimento contínuo para sua farmácia',
  description:
    'O Yadone acompanha cada paciente pelo WhatsApp — lembra o tratamento, avisa na hora certa e traz de volta para comprar. Sem esforço do seu time.',
}

export default function Home() {
  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        {/* ============ NAV ============ */}
        <nav className={styles.nav}>
          <div className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.brandLogo} src="/yadone/yadone-logo.png" alt="Yadone" />
          </div>
          <div className={styles.navLinks}>
            <a href="#">Sobre</a>
            <a href="#">Como funciona</a>
            <a href="#">Casos</a>
            <a href="#">Preços</a>
            <a href="#">Contato</a>
          </div>
          <a className={`${styles.btn} ${styles.btnDark}`} href="#">
            <span className={styles.dot} /> Agendar demo
          </a>
        </nav>

        {/* ============ HERO ============ */}
        <section className={styles.hero}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.heroBg} src="/yadone/hero.jpg" alt="" />
          <div className={styles.heroWash} />
          <div className={styles.heroGlow} />

          {/* BACK layer: first two pharmacy bubbles (behind the woman) */}
          <div className={styles.hotspots}>
            <div className={`${styles.bubble} ${styles.bubbleIn} ${styles.b1}`}>
              <div className={styles.who}>
                <span className={styles.av}>F</span> Farmácia
              </div>
              Oi Ana! Faltam <strong>3 dias</strong> pro fim do tratamento.
              <span className={styles.time}>14:02</span>
            </div>

            <div className={`${styles.bubble} ${styles.bubbleIn} ${styles.b2}`}>
              Como você está se sentindo?
              <span className={styles.time}>14:02</span>
            </div>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.heroFg} src="/yadone/hero.png" alt="" />

          {/* FRONT layer: rest of the thread (in front of the woman) */}
          <div className={styles.hotspotsFront}>
            <div className={`${styles.bubble} ${styles.bubbleOut} ${styles.b3}`}>
              <div className={styles.who}>
                <span className={styles.av}>A</span> Você
              </div>
              Melhor, só a garganta ainda inflamada.
              <span className={styles.time}>14:05</span>
            </div>

            <div className={`${styles.bubble} ${styles.bubbleIn} ${styles.b4}`}>
              <div className={styles.who}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.aiIcon} src="/yadone/yadone-icon.png" alt="" /> Yadone AI
              </div>
              Ana, que tal aquele própolis em spray que você comprou mês passado?
              <span className={styles.time}>14:05</span>
            </div>

            <div className={`${styles.bubble} ${styles.bubbleOut} ${styles.b5}`}>
              Boa ideia! Obrigada pelo cuidado 💚
              <span className={styles.time}>14:06</span>
            </div>
          </div>

          <div className={styles.heroGrid}>
            {/* LEFT: copy + "Como funciona" card */}
            <div className={styles.copy}>
              <div>
                <h1 className={styles.h1}>
                  Atenda cada cliente<br />
                  como se fosse<br />
                  <span className={styles.accent}>o único.</span>
                </h1>
                <p className={styles.lede}>
                  O Yadone acompanha cada paciente pelo WhatsApp —
                  lembra o tratamento, avisa na hora certa e traz
                  de volta para comprar. Sem esforço do seu time.
                </p>
              </div>

              <div className={styles.docCard}>
                <div className={styles.video}>
                  <span className={styles.play}>▶</span>
                  <span className={styles.videoCap}>Intro · 42s</span>
                </div>
                <div className={styles.info}>
                  <div>
                    <div className={styles.label}>Como funciona · 01</div>
                    <p className={styles.blurb}>
                      Do atendimento à recompra, o Yadone mantém
                      o vínculo com cada cliente — com a voz
                      e o cuidado da sua farmácia.
                    </p>
                  </div>
                  <div className={styles.docRow}>
                    <div className={styles.docName}>
                      <b>Time Yadone</b>
                      <span>Time de Customer Success</span>
                    </div>
                    <a className={`${styles.btn} ${styles.btnLime}`} href="#">
                      Ver demo
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT column: spacer for grid — chat lives at hero level */}
            <div className={styles.subject} />
          </div>
        </section>

        {/* ============ FOOTER LINE ============ */}
        <div className={styles.marquee}>
          <span>Yadone · Brasil</span>
          <span className={styles.pillline} />
          <span>Desde 2024</span>
          <span className={styles.pillline} />
          <span>Para sua farmácia</span>
        </div>
      </div>
    </div>
  )
}
