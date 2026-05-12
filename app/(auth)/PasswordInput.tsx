'use client'

import { useState, forwardRef } from 'react'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  inputClass: string
}

export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput({ inputClass, ...rest }, ref) {
    const [visible, setVisible] = useState(false)

    return (
      <div className="relative">
        <input
          ref={ref}
          {...rest}
          type={visible ? 'text' : 'password'}
          className={inputClass + ' pr-10'}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          tabIndex={-1}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md opacity-55 transition hover:bg-current/5 hover:opacity-100"
        >
          {visible ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8 C 4 4.5, 6 3, 8 3 C 10 3, 12 4.5, 14 8 C 12 11.5, 10 13, 8 13 C 6 13, 4 11.5, 2 8 Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M2.5 2.5 L13.5 13.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8 C 4 4.5, 6 3, 8 3 C 10 3, 12 4.5, 14 8 C 12 11.5, 10 13, 8 13 C 6 13, 4 11.5, 2 8 Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          )}
        </button>
      </div>
    )
  },
)
