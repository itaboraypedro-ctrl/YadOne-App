import Image from 'next/image'
import Link from 'next/link'

type Props = {
  children: React.ReactNode
  topRightLabel?: string
  topRightHref?: string
  theme?: 'light' | 'dark'
}

export function AuthShell({
  children,
  topRightLabel = 'Comece hoje mesmo',
  topRightHref = '/signup',
  theme = 'light',
}: Props) {
  const isDark = theme === 'dark'

  return (
    <main
      className={
        'h-screen w-screen overflow-hidden p-4 sm:p-6 lg:p-8 ' +
        (isDark
          ? 'bg-[oklch(0.10_0.025_150)] text-[oklch(0.95_0.005_150)]'
          : 'bg-neutral-100 text-neutral-900')
      }
    >
      <div className="mx-auto flex h-full max-w-[1400px] flex-col gap-6 lg:flex-row lg:gap-8">
        {/* LEFT — image card */}
        <aside className="relative hidden flex-1 overflow-hidden rounded-[28px] lg:block">
          <Image
            src="/images/login.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-x-8 top-8 flex items-center justify-between text-white">
            <span className="text-base font-semibold tracking-wide">Yadone</span>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/" className="opacity-90 transition hover:opacity-100">
                Voltar ao site
              </Link>
              <Link
                href={topRightHref}
                className="rounded-full border border-white/40 px-4 py-1.5 transition hover:bg-white/10"
              >
                {topRightLabel}
              </Link>
            </div>
          </div>
        </aside>

        {/* RIGHT — content */}
        <section
          className={
            'flex flex-1 flex-col overflow-hidden rounded-[28px] p-6 sm:p-8 lg:p-10 ' +
            (isDark
              ? 'bg-[oklch(0.14_0.030_150)] border border-white/10'
              : 'bg-white')
          }
        >
          <header className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={isDark ? '/yadone/yadone-logo.png' : '/yadone/logo-escura.png'}
                alt="Yadone"
                className="h-10 w-auto object-contain"
              />
            </Link>
          </header>

          <div className="flex flex-1 items-center justify-center overflow-y-auto py-4">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
