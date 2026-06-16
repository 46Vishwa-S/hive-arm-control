interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledLabel?: string;
}

export function AxisSlider({ label, value, min, max, unit = "°", onChange, icon, disabled, disabledLabel }: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`group rounded-xl border backdrop-blur px-4 py-3.5 transition-all ${
      disabled 
        ? "border-destructive/40 bg-destructive/5" 
        : "border-border/60 bg-card/60 hover:border-primary/50 hover:glow-honey"
    }`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className={disabled ? "text-destructive animate-pulse" : "text-primary"}>{icon}</span>
          <span className={`text-xs font-mono uppercase tracking-[0.18em] ${disabled ? "text-destructive/80 font-bold" : "text-muted-foreground"}`}>
            {label}
          </span>
        </div>
        {disabled ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-destructive font-bold animate-pulse">
            {disabledLabel || "LOCKED"}
          </span>
        ) : (
          <span className="font-mono text-sm text-primary text-glow tabular-nums">
            {value.toFixed(0)}{unit}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`hive-slider ${disabled ? "opacity-35 cursor-not-allowed" : ""}`}
          style={{
            background: disabled
              ? `linear-gradient(90deg, oklch(0.6 0.22 25) 0%, oklch(0.6 0.22 25) ${pct}%, oklch(0.22 0.02 250) ${pct}%, oklch(0.22 0.02 250) 100%)`
              : `linear-gradient(90deg, oklch(0.82 0.17 85) 0%, oklch(0.82 0.17 85) ${pct}%, oklch(0.22 0.02 250) ${pct}%, oklch(0.22 0.02 250) 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] font-mono text-muted-foreground/60">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
