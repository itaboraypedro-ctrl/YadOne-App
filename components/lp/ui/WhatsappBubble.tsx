type Props = {
  type: 'sent' | 'received'
  sender?: string
  message: string
  time: string
  isAudio?: boolean
  dark?: boolean
}

export function WhatsappBubble({ type, sender, message, time, isAudio, dark }: Props) {
  const isSent = type === 'sent'
  // Inline styles guarantee the colors apply correctly regardless of Tailwind v4 arbitrary-value quirks.
  const bubbleStyle: React.CSSProperties = dark
    ? {
        background:
          'linear-gradient(160deg, color-mix(in oklab, black 30%, transparent) 0%, color-mix(in oklab, black 44%, transparent) 100%)',
        border: '1px solid color-mix(in oklab, white 14%, transparent)',
        color: 'oklch(0.92 0.005 150)',
        boxShadow: '0 1px 0 oklch(1 0 0 / 0.05) inset, 0 8px 24px oklch(0 0 0 / 0.25)',
      }
    : isSent
      ? { background: 'var(--verda-lime)', color: 'oklch(0.18 0.04 150)' }
      : { background: '#FFFFFF', color: 'oklch(0.20 0.02 150)' }
  const avatarStyle: React.CSSProperties = dark
    ? { background: 'oklch(0.30 0.04 150)', color: 'var(--verda-lime)' }
    : isSent
      ? { background: 'oklch(0.30 0.04 150)', color: 'var(--verda-lime)' }
      : { background: 'oklch(0.45 0.08 150)', color: '#FFFFFF' }

  return (
    <div className={`flex flex-col ${isSent ? 'items-end' : 'items-start'} mb-2`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.32)] ${
          isSent ? 'rounded-br-[5px]' : 'rounded-bl-[5px]'
        }`}
        style={bubbleStyle}
      >
        {sender && (
          <div
            className="flex items-center gap-1.5 font-mono uppercase mb-1"
            style={{ fontSize: '8.5px', letterSpacing: '0.14em', opacity: 0.65 }}
          >
            <span
              className="inline-flex items-center justify-center w-3 h-3 rounded-full font-sans font-semibold overflow-hidden"
              style={{ ...avatarStyle, fontSize: '7px', letterSpacing: '0' }}
            >
              {sender.charAt(0)}
            </span>
            {sender}
          </div>
        )}

        {isAudio ? (
          <div className="flex items-center gap-2">
            <span className="text-lg">🔊</span>
            <div className="flex gap-0.5 items-end h-4">
              {[3, 5, 7, 4, 6, 8, 5, 3, 6, 4].map((h, i) => (
                <div
                  key={i}
                  className="w-0.5 rounded-full"
                  style={{
                    height: `${h * 2}px`,
                    background: isSent ? 'rgba(0,0,0,0.4)' : '#9CA3AF',
                  }}
                />
              ))}
            </div>
            <span className="text-xs" style={{ opacity: 0.6 }}>0:12</span>
          </div>
        ) : (
          <p className="text-[11.5px] leading-[1.35]">{message}</p>
        )}

        <span
          className={`block font-mono mt-1 ${isSent ? 'text-right' : ''}`}
          style={{ fontSize: '8.5px', letterSpacing: '0.10em', opacity: 0.55 }}
        >
          {time}
        </span>
      </div>
    </div>
  )
}
