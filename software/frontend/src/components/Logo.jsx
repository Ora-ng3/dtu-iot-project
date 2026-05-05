export function Logo({ size = 48, className }) {
  const h = Math.round(size * 40 / 52)
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 52 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="MotionWave logo"
    >
      {/* Dashed corridor border — mirrors the in-game corridor */}
      <path
        d="M2 22 C8 8 20 8 26 22 C32 36 44 36 50 22"
        stroke="var(--color-primary)"
        strokeWidth="1"
        strokeOpacity="0.35"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      {/* Main wave */}
      <path
        d="M2 18 C8 4 20 4 26 18 C32 32 44 32 50 18"
        stroke="var(--color-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Ball sitting in the corridor (between the two lines) */}
      <circle cx="38" cy="30" r="4" fill="var(--color-text-1)" />
      <circle cx="38" cy="30" r="6" stroke="var(--color-good)" strokeWidth="1.5" />
    </svg>
  )
}
