export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs text-[--accent] uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}
