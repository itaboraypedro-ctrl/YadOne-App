import Image from "next/image";

function Footer() {
  return (
    <footer
      className="bg-[--bg] py-8 px-8 md:px-16"
      style={{ borderTop: "1px solid color-mix(in oklab, white 12%, transparent)" }}
    >
      <div
        className="flex items-center justify-between gap-4 font-mono uppercase text-[oklch(0.70_0.015_150)]"
        style={{ fontSize: "11px", letterSpacing: "0.18em" }}
      >
        <span className="flex items-center gap-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: "var(--verda-lime)",
              boxShadow: "0 0 8px oklch(0.88 0.20 130 / 0.6)",
            }}
          />
          Yadone
        </span>
        <span
          className="flex-1 h-px mx-4 hidden sm:block"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in oklab, white 16%, transparent), transparent)",
          }}
        />
        <div className="flex gap-4 sm:gap-6">
          {[
            ["/privacidade", "Privacidade"],
            ["/termos", "Termos"],
            ["/exclusao-de-dados", "Exclusão de dados"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="group relative transition-colors duration-200 hover:text-[--verda-lime]"
            >
              {label}
              <span
                aria-hidden
                className="absolute left-0 -bottom-1 h-px w-0 group-hover:w-full transition-[width] duration-300"
                style={{ background: "var(--verda-lime)" }}
              />
            </a>
          ))}
        </div>
        <span
          className="flex-1 h-px mx-4 hidden sm:block"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in oklab, white 16%, transparent), transparent)",
          }}
        />
        <Image
          src="/images/logo-tech-provider.webp"
          width={100}
          height={26}
          alt="Meta Tech Provider Oficial"
          className="opacity-60 flex-shrink-0 hidden sm:block"
        />
        <span
          className="flex-1 h-px mx-4 hidden sm:block"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in oklab, white 16%, transparent), transparent)",
          }}
        />
        <a
          href="mailto:contato@yadone.com.br"
          className="hidden md:inline-block hover:text-[--verda-lime] transition-colors duration-200"
        >
          contato@yadone.com.br
        </a>
      </div>
    </footer>
  );
}

export default Footer;
