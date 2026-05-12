'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Country = {
  iso: string
  code: string
  flag: string
  name: string
  mask?: (digits: string) => string
  minDigits?: number
}

function maskBR(digits: string): string {
  const d = digits.slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const COUNTRIES: Country[] = [
  // LATAM
  { iso: 'BR', code: '+55',  flag: '🇧🇷', name: 'Brasil',         mask: maskBR, minDigits: 10 },
  { iso: 'AR', code: '+54',  flag: '🇦🇷', name: 'Argentina',      minDigits: 10 },
  { iso: 'CL', code: '+56',  flag: '🇨🇱', name: 'Chile',          minDigits: 9 },
  { iso: 'CO', code: '+57',  flag: '🇨🇴', name: 'Colômbia',       minDigits: 10 },
  { iso: 'MX', code: '+52',  flag: '🇲🇽', name: 'México',         minDigits: 10 },
  { iso: 'PE', code: '+51',  flag: '🇵🇪', name: 'Peru',           minDigits: 9 },
  { iso: 'UY', code: '+598', flag: '🇺🇾', name: 'Uruguai',        minDigits: 8 },
  { iso: 'PY', code: '+595', flag: '🇵🇾', name: 'Paraguai',       minDigits: 9 },
  { iso: 'BO', code: '+591', flag: '🇧🇴', name: 'Bolívia',        minDigits: 8 },
  { iso: 'EC', code: '+593', flag: '🇪🇨', name: 'Equador',        minDigits: 9 },
  { iso: 'VE', code: '+58',  flag: '🇻🇪', name: 'Venezuela',      minDigits: 10 },

  // América do Norte
  { iso: 'US', code: '+1',   flag: '🇺🇸', name: 'Estados Unidos', minDigits: 10 },
  { iso: 'CA', code: '+1',   flag: '🇨🇦', name: 'Canadá',         minDigits: 10 },

  // Europa
  { iso: 'PT', code: '+351', flag: '🇵🇹', name: 'Portugal',       minDigits: 9 },
  { iso: 'ES', code: '+34',  flag: '🇪🇸', name: 'Espanha',        minDigits: 9 },
  { iso: 'FR', code: '+33',  flag: '🇫🇷', name: 'França',         minDigits: 9 },
  { iso: 'IT', code: '+39',  flag: '🇮🇹', name: 'Itália',         minDigits: 9 },
  { iso: 'DE', code: '+49',  flag: '🇩🇪', name: 'Alemanha',       minDigits: 10 },
  { iso: 'GB', code: '+44',  flag: '🇬🇧', name: 'Reino Unido',    minDigits: 10 },
  { iso: 'IE', code: '+353', flag: '🇮🇪', name: 'Irlanda',        minDigits: 9 },
  { iso: 'NL', code: '+31',  flag: '🇳🇱', name: 'Holanda',        minDigits: 9 },
  { iso: 'BE', code: '+32',  flag: '🇧🇪', name: 'Bélgica',        minDigits: 9 },
  { iso: 'CH', code: '+41',  flag: '🇨🇭', name: 'Suíça',          minDigits: 9 },
  { iso: 'AT', code: '+43',  flag: '🇦🇹', name: 'Áustria',        minDigits: 10 },
  { iso: 'SE', code: '+46',  flag: '🇸🇪', name: 'Suécia',         minDigits: 9 },
  { iso: 'NO', code: '+47',  flag: '🇳🇴', name: 'Noruega',        minDigits: 8 },
  { iso: 'DK', code: '+45',  flag: '🇩🇰', name: 'Dinamarca',      minDigits: 8 },
  { iso: 'FI', code: '+358', flag: '🇫🇮', name: 'Finlândia',      minDigits: 9 },
  { iso: 'PL', code: '+48',  flag: '🇵🇱', name: 'Polônia',        minDigits: 9 },
  { iso: 'GR', code: '+30',  flag: '🇬🇷', name: 'Grécia',         minDigits: 10 },
  { iso: 'RU', code: '+7',   flag: '🇷🇺', name: 'Rússia',         minDigits: 10 },
  { iso: 'UA', code: '+380', flag: '🇺🇦', name: 'Ucrânia',        minDigits: 9 },
  { iso: 'TR', code: '+90',  flag: '🇹🇷', name: 'Turquia',        minDigits: 10 },

  // Ásia
  { iso: 'JP', code: '+81',  flag: '🇯🇵', name: 'Japão',          minDigits: 10 },
  { iso: 'CN', code: '+86',  flag: '🇨🇳', name: 'China',          minDigits: 11 },
  { iso: 'KR', code: '+82',  flag: '🇰🇷', name: 'Coreia do Sul',  minDigits: 9 },
  { iso: 'IN', code: '+91',  flag: '🇮🇳', name: 'Índia',          minDigits: 10 },
  { iso: 'SG', code: '+65',  flag: '🇸🇬', name: 'Singapura',      minDigits: 8 },
  { iso: 'TH', code: '+66',  flag: '🇹🇭', name: 'Tailândia',      minDigits: 9 },
  { iso: 'VN', code: '+84',  flag: '🇻🇳', name: 'Vietnã',         minDigits: 9 },
  { iso: 'ID', code: '+62',  flag: '🇮🇩', name: 'Indonésia',      minDigits: 9 },
  { iso: 'PH', code: '+63',  flag: '🇵🇭', name: 'Filipinas',      minDigits: 10 },
  { iso: 'IL', code: '+972', flag: '🇮🇱', name: 'Israel',         minDigits: 9 },
  { iso: 'AE', code: '+971', flag: '🇦🇪', name: 'Emirados Árabes', minDigits: 9 },
  { iso: 'SA', code: '+966', flag: '🇸🇦', name: 'Arábia Saudita', minDigits: 9 },
  { iso: 'QA', code: '+974', flag: '🇶🇦', name: 'Catar',          minDigits: 8 },

  // Oceania
  { iso: 'AU', code: '+61',  flag: '🇦🇺', name: 'Austrália',      minDigits: 9 },
  { iso: 'NZ', code: '+64',  flag: '🇳🇿', name: 'Nova Zelândia',  minDigits: 8 },

  // África
  { iso: 'ZA', code: '+27',  flag: '🇿🇦', name: 'África do Sul',  minDigits: 9 },
  { iso: 'EG', code: '+20',  flag: '🇪🇬', name: 'Egito',          minDigits: 10 },
  { iso: 'NG', code: '+234', flag: '🇳🇬', name: 'Nigéria',        minDigits: 10 },
  { iso: 'KE', code: '+254', flag: '🇰🇪', name: 'Quênia',         minDigits: 9 },
  { iso: 'MA', code: '+212', flag: '🇲🇦', name: 'Marrocos',       minDigits: 9 },
]

function strip(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

type Props = {
  name: string
  required?: boolean
  defaultIso?: string
  inputClass: string
}

export function PhoneInput({ name, required, defaultIso = 'BR', inputClass }: Props) {
  const [iso, setIso] = useState(defaultIso)
  const [display, setDisplay] = useState('')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const country = useMemo(
    () => COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0],
    [iso],
  )
  const digits = useMemo(() => display.replace(/\D/g, ''), [display])
  const minDigits = country.minDigits ?? 7
  const fullValue = digits ? `${country.code}${digits}` : ''
  const tooShort = digits.length > 0 && digits.length < minDigits

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES
    const q = strip(search)
    return COUNTRIES.filter(
      (c) => strip(c.name).includes(q) || c.code.includes(q) || c.iso.toLowerCase().includes(q),
    )
  }, [search])

  // fechar ao clicar fora
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escape)
    // foca a busca quando abre
    requestAnimationFrame(() => searchRef.current?.focus())
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const onDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    setDisplay(country.mask ? country.mask(raw) : raw)
  }

  const selectCountry = (next: Country) => {
    setIso(next.iso)
    setOpen(false)
    setSearch('')
    setDisplay(next.mask ? next.mask(digits) : digits)
  }

  return (
    <div className="space-y-1">
      <div className="relative flex gap-2" ref={wrapRef}>
        {/* Trigger custom — botão estilizado, abre painel */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={
            'flex shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[oklch(0.95_0.005_150)] transition hover:bg-white/10 focus:border-[oklch(0.88_0.20_130)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.88_0.20_130_/_0.25)]'
          }
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="text-sm font-medium">{country.code}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            className="opacity-60 transition-transform"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
          >
            <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <input
          type="tel"
          value={display}
          onChange={onDigitsChange}
          required={required}
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={iso === 'BR' ? '(00) 00000-0000' : 'Número'}
          className={inputClass + ' flex-1'}
        />
        <input type="hidden" name={name} value={fullValue} />

        {/* Painel premium */}
        {open ? (
          <div
            role="listbox"
            className="absolute left-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-white/15 shadow-[0_30px_80px_-20px_oklch(0_0_0_/_0.7)]"
            style={{
              background:
                'linear-gradient(160deg, oklch(0.16 0.030 150) 0%, oklch(0.13 0.025 150) 100%)',
              backdropFilter: 'blur(14px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
            }}
          >
            <div className="border-b border-white/10 p-2.5">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(0.65_0.018_150)]"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M10 10 L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar país ou DDI…"
                  className="w-full rounded-lg border border-transparent bg-white/5 py-2 pl-9 pr-3 text-sm text-[oklch(0.95_0.005_150)] placeholder:text-[oklch(0.65_0.018_150)] focus:border-[oklch(0.88_0.20_130_/_0.5)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.88_0.20_130_/_0.15)]"
                />
              </div>
            </div>
            <ul className="max-h-[160px] overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-[oklch(0.65_0.018_150)]">
                  Nenhum país encontrado.
                </li>
              ) : (
                filtered.map((c) => {
                  const isSelected = c.iso === iso
                  return (
                    <li key={c.iso}>
                      <button
                        type="button"
                        onClick={() => selectCountry(c)}
                        role="option"
                        aria-selected={isSelected}
                        className={
                          'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition ' +
                          (isSelected
                            ? 'bg-[oklch(0.88_0.20_130_/_0.12)] text-[oklch(0.95_0.005_150)]'
                            : 'text-[oklch(0.85_0.012_150)] hover:bg-white/5')
                        }
                      >
                        <span className="text-base leading-none">{c.flag}</span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="font-mono text-xs text-[oklch(0.65_0.018_150)]">
                          {c.code}
                        </span>
                        {isSelected ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            className="text-[oklch(0.88_0.20_130)]"
                          >
                            <path
                              d="M2 7 L6 11 L12 3"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
      {tooShort ? (
        <p className="text-xs text-red-400">
          Telefone incompleto — ao menos {minDigits} dígitos para {country.name}.
        </p>
      ) : null}
    </div>
  )
}
