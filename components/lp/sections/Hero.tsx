"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { HeroYadoneAudioBubble } from "@/components/lp/ui/HeroYadoneAudioBubble";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  // Mouse position relative to section, normalized to [-1, 1]
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  // Very smooth spring (heavy damping → subtle, slow drift)
  const sx = useSpring(mx, { stiffness: 22, damping: 18, mass: 1 });
  const sy = useSpring(my, { stiffness: 22, damping: 18, mass: 1 });

  // Layer 1 — hero.jpg (deepest, smallest drift)
  const jpgX = useTransform(sx, [-1, 1], [8, -8]);
  const jpgY = useTransform(sy, [-1, 1], [5, -5]);

  // Layer 3 — back bubbles (b1 + b2) — between jpg and png
  const backX = useTransform(sx, [-1, 1], [16, -16]);
  const backY = useTransform(sy, [-1, 1], [10, -10]);

  // Layer 5 — front bubbles (b3 + b4 + b5) — closest, biggest drift, opposite direction
  const frontX = useTransform(sx, [-1, 1], [-22, 22]);
  const frontY = useTransform(sy, [-1, 1], [-14, 14]);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    mx.set(x);
    my.set(y);
  };

  const handleMouseLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <section
      ref={sectionRef}
      className="hero-shell"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Layer 1 — JPG full-bleed background (parallax) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ x: jpgX, y: jpgY }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-bg" src="/yadone/hero.jpg" alt="" />
      </motion.div>

      {/* Layer 2 — wash + glow + premium bottom fade (static, between jpg and bubbles) */}
      <div className="hero-wash" />
      <div className="hero-glow" />
      <div className="hero-fade" aria-hidden />

      {/* Layer 3 — BACK chat (b1 + b2 — behind the subject) — parallax */}
      <motion.div className="hotspots" style={{ x: backX, y: backY }}>
        <div className="bubble in b1">
          <div className="who">
            <span className="av">F</span> Farmácia
          </div>
          Oi Ana! Faltam <strong>3 dias</strong> pro fim do tratamento.
          <span className="time">14:02</span>
        </div>

        <div className="bubble in b2">
          Como você está?
          <span className="time">14:02</span>
        </div>
      </motion.div>

      {/* Layer 4 — PNG cutout (the subject) — STATIC, does not move */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hero-fg" src="/yadone/hero.png" alt="" />

      {/* Layer 5 — FRONT chat (b3 + b4 + b5 — in front of the subject) — parallax */}
      <motion.div className="hotspots-front" style={{ x: frontX, y: frontY }}>
        <div className="bubble out b3">
          <div className="who">
            <span className="av">A</span> Você
          </div>
          Melhor, só a garganta ainda inflamada.
          <span className="time">14:05</span>
        </div>

        <HeroYadoneAudioBubble />

        <div className="bubble out b5">
          Boa ideia! Obrigada pelo cuidado 💚
          <span className="time">14:06</span>
        </div>
      </motion.div>

      {/* Top layer — Copy + doc-card — STATIC, always on top */}
      <div className="hero-grid">
        <div className="flex flex-col max-w-[620px]">
          <h1 className="hero-h1">
            Atenda cada cliente
            <br />
            como se fosse
            <br />
            <span className="accent">o único.</span>
          </h1>
          <p className="hero-lede">
            O Yadone acompanha cada paciente pelo WhatsApp — lembra o
            tratamento, avisa na hora certa e traz de volta para comprar. Sem
            esforço do seu time.
          </p>

          <div className="flex items-center gap-2 mt-6">
            <Image
              src="/images/logo-tech-provider.webp"
              width={96}
              height={26}
              alt="Meta Tech Provider Oficial"
              className="opacity-75"
            />
            <span className="text-[11px] text-[--text-muted] font-mono">
              API Oficial WhatsApp Business
            </span>
          </div>

          <div className="flex items-center gap-5 mt-10">
            <motion.a
              href="#agendar"
              className="group relative inline-flex items-center gap-2 font-semibold text-base md:text-lg px-7 md:px-8 py-3 md:py-3.5 rounded-full overflow-hidden"
              style={{
                background: "oklch(0.88 0.20 130)",
                color: "oklch(0.18 0.04 150)",
                boxShadow:
                  "0 14px 36px -12px oklch(0.88 0.20 130 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.5)",
              }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[800ms] ease-out"
                style={{
                  background:
                    "linear-gradient(110deg, transparent 30%, oklch(1 0 0 / 0.45) 50%, transparent 70%)",
                }}
              />
              <span className="relative">Comece hoje mesmo</span>
              <span className="relative transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden>→</span>
            </motion.a>

            <a
              href="#problema"
              className="group inline-flex items-center gap-2 text-base md:text-lg text-[--text-secondary] hover:text-[--text-primary] transition-colors font-medium"
            >
              <span>Conhecer mais</span>
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </a>
          </div>
        </div>

        <div className="relative min-h-[560px]" />
      </div>
    </section>
  );
}
