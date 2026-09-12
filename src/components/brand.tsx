export function BrandLogo({ size = 32, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span
        className="inline-flex items-center justify-center rounded-lg bg-gradient-brand font-black text-white shadow-lg shadow-primary/30"
        style={{ width: size, height: size, fontSize: size * 0.55 }}
      >
        S
      </span>
      {withText && <span className="text-lg font-bold tracking-tight">Slux</span>}
    </span>
  );
}

export function EqualizerBars({ className = "", bars = 4 }: { className?: string; bars?: number }) {
  return (
    <span className={`inline-flex items-end gap-[3px] h-4 ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="eq-bar w-[3px] rounded-sm bg-gradient-brand"
          style={{ height: "100%", animationDelay: `${i * 0.15}s`, animationDuration: `${0.9 + i * 0.12}s` }}
        />
      ))}
    </span>
  );
}
