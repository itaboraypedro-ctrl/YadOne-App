"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const fullText = "49 mil farmácias\nindependentes estão perdendo pacientes.\nVocê não precisa ser uma delas.";

function CtaFinal() {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="agendar"
      className="px-6 md:px-12 lg:px-16 py-32 md:py-40 relative overflow-hidden min-h-[820px] flex items-center"
      style={{ background: "oklch(0.10 0.025 150)" }}
    >
      {/* Layer 0 — JPG full-bleed scene */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/yadone/hero2.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none select-none"
        style={{
          objectFit: "cover",
          objectPosition: "center right",
          filter: "saturate(0.85) contrast(1.05) brightness(0.7) hue-rotate(-6deg)",
        }}
      />

      {/* Layer 1 — Wash: heavy scrim on the LEFT half (where content lives) so the
          subject on the right stays clear and unobstructed. */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: [
            // Strong left-side scrim for text legibility (covers ~ left half, fades right)
            "linear-gradient(90deg, oklch(0.10 0.025 150 / 0.9) 0%, oklch(0.10 0.025 150 / 0.7) 30%, oklch(0.10 0.025 150 / 0.25) 55%, transparent 75%)",
            // Top fade
            "linear-gradient(180deg, oklch(0.10 0.025 150 / 0.7) 0%, transparent 20%)",
            // Bottom fade (deeper, blends into footer)
            "linear-gradient(0deg, oklch(0.10 0.025 150 / 0.95) 0%, transparent 30%)",
          ].join(", "),
        }}
      />

      {/* Layer 2 — Lime halo behind subject (between bg and PNG, gives skin warmth) */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            "radial-gradient(28% 38% at 75% 55%, oklch(0.78 0.20 130 / 0.18) 0%, transparent 70%)",
          mixBlendMode: "screen",
          filter: "blur(10px)",
        }}
      />

      {/* Layer 3 — PNG cutout, person crisp on top */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/yadone/hero2.png"
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none select-none"
        style={{
          objectFit: "cover",
          objectPosition: "center right",
          filter:
            "contrast(1.06) saturate(1.08) drop-shadow(0 30px 50px rgba(0,0,0,0.55))",
        }}
      />

      {/* Layer 4 — Lime glow pulse, anchored on the LEFT (behind CTA button) */}
      <motion.div
        className="absolute pointer-events-none rounded-full"
        style={{
          left: "18%",
          bottom: "28%",
          width: "26rem",
          height: "11rem",
          background:
            "radial-gradient(45% 60% at 50% 50%, oklch(0.78 0.20 130 / 0.35), transparent)",
          filter: "blur(34px)",
          mixBlendMode: "screen",
        }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Layer 5 — Content (anchored left, leaves the right half clear for the subject) */}
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="max-w-xl">
          <div
            className="mb-8 h-px w-16"
            aria-hidden
            style={{
              background:
                "linear-gradient(90deg, oklch(0.88 0.20 130 / 0.7), transparent)",
            }}
          />

          <h2
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal mb-6 whitespace-pre-line min-h-[3em] text-balance leading-[1.05]"
            style={{
              fontFamily: "'Laviossa', 'Playfair Display', serif",
              color: "oklch(0.97 0.005 150)",
              textShadow:
                "0 2px 24px oklch(0.10 0.025 150 / 0.7), 0 0 40px oklch(0.10 0.025 150 / 0.5)",
            }}
          >
            {text}
            {!done && (
              <motion.span
                className="inline-block w-1 h-10 ml-1 align-middle"
                style={{ background: "oklch(0.88 0.20 130)" }}
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}
          </h2>

          <p
            className="text-base md:text-lg leading-relaxed mb-10 max-w-md"
            style={{
              color: "oklch(0.85 0.010 150)",
              textShadow: "0 2px 16px oklch(0.10 0.025 150 / 0.7)",
            }}
          >
            Comece a acompanhar seus pacientes hoje.{' '}
            <strong className="font-semibold" style={{ color: "oklch(0.97 0.005 150)" }}>Em poucos dias, o primeiro áudio sai.</strong>{' '}
            Em 30 dias, você vê a primeira receita recuperada.
          </p>

          <motion.a
            href="https://calendly.com/yadone"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="group relative inline-flex items-center gap-2 font-semibold text-base md:text-lg px-8 md:px-10 py-3.5 md:py-4 rounded-full overflow-hidden transition-shadow duration-300 hover:shadow-[0_22px_50px_-12px_oklch(0.88_0.20_130_/_0.65)]"
            style={{
              background: "oklch(0.88 0.20 130)",
              color: "oklch(0.18 0.04 150)",
              boxShadow:
                "0 14px 36px -10px oklch(0.88 0.20 130 / 0.45), inset 0 1px 0 oklch(1 0 0 / 0.5)",
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
              style={{
                background:
                  "linear-gradient(110deg, transparent 30%, oklch(1 0 0 / 0.45) 50%, transparent 70%)",
              }}
            />
            <span className="relative">Comece hoje mesmo</span>
            <span className="relative" aria-hidden>→</span>
          </motion.a>

          <p
            className="text-sm mt-4"
            style={{
              color: "oklch(0.75 0.015 150)",
              textShadow: "0 2px 16px oklch(0.10 0.025 150 / 0.7)",
            }}
          >
            Atendemos farmácias em todo o Brasil. Cadastro rápido. Nosso time entra em contato em até 24h.
          </p>
        </div>
      </div>
    </section>
  );
}

export default CtaFinal;
