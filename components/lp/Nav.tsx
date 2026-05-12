"use client";

import { useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 20);
  });

  return (
    <nav
      className="sticky top-0 z-50 transition-colors duration-200"
      style={{
        background: scrolled ? "oklch(0.14 0.030 150 / 0.82)" : "transparent",
        backdropFilter: scrolled ? "blur(14px) saturate(1.2)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(14px) saturate(1.2)" : "none",
        borderBottom: scrolled
          ? "1px solid color-mix(in oklab, white 10%, transparent)"
          : "1px solid transparent",
      }}
    >
      <div className="max-w-[1320px] mx-auto px-7 md:px-12 flex items-center justify-between py-2">
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/yadone/yadone-logo.png"
            alt="Yadone"
            className="h-[54px] w-auto object-contain"
          />
        </div>

        <div className="hidden md:flex gap-8 text-sm text-[--verda-ink-soft]">
          <a href="#problema" className="hover:text-[--verda-lime] transition-colors">Sobre</a>
          <a href="#problema" className="hover:text-[--verda-lime] transition-colors">Como funciona</a>
          <a href="#diferenciais" className="hover:text-[--verda-lime] transition-colors">Casos</a>
          <a href="#dados" className="hover:text-[--verda-lime] transition-colors">Preços</a>
          <a href="#agendar" className="hover:text-[--verda-lime] transition-colors">Contato</a>
        </div>

        <motion.a
          href="#agendar"
          className="verda-btn verda-btn-dark"
          animate={{
            boxShadow: [
              "0 0 0 0 oklch(0.78 0.20 130 / 0.5)",
              "0 0 0 8px oklch(0.78 0.20 130 / 0)",
              "0 0 0 0 oklch(0.78 0.20 130 / 0)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <span className="dot" /> Agendar demo
        </motion.a>
      </div>
    </nav>
  );
}
