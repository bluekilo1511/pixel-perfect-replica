interface PetHoldRingProps {
  isHolding: boolean;
  progress: number; // 0 to 1
  size?: number;
}

export function PetHoldRing({ isHolding, progress, size = 136 }: PetHoldRingProps) {
  if (!isHolding && progress <= 0) return null;

  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;
  const remainingSeconds = Math.max(1, Math.ceil((1 - progress) * 3));

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center z-30 select-none animate-in fade-in duration-150"
      style={{ width: size, height: size }}
    >
      <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-amber-500/20"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Glowing progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)] transition-[stroke-dashoffset] duration-75"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Center glowing energy aura */}
      <div
        className="absolute inset-2 rounded-full bg-amber-400/10 animate-pulse pointer-events-none"
        style={{
          transform: `scale(${0.8 + progress * 0.4})`,
          opacity: 0.3 + progress * 0.7,
        }}
      />

      {/* Floating timer hint */}
      <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 text-black px-2.5 py-0.5 text-[11px] font-bold shadow-lg animate-bounce">
        📜 Giữ {remainingSeconds}s...
      </span>
    </div>
  );
}
