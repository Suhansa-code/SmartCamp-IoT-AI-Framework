// src/components/psychoedu/child/Eli.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Eli the elephant — inline SVG mascot with multiple moods and sizes.
// No external image dependency — renders at any resolution perfectly.
//
// Props:
//   size     — number (default 160)
//   mood     — 'happy' | 'excited' | 'calm' | 'breathe' | 'wave' | 'star'
//   animated — boolean (default true) — adds CSS float animation
// ─────────────────────────────────────────────────────────────────────────────

export default function Eli({ size = 160, mood = 'happy', animated = true, className = '', style = {} }) {

  // Eyes per mood
  const eyes = {
    happy:   { l: '●', r: '●', scale: 1,    pupils: true },
    excited: { l: '★', r: '★', scale: 1.08, pupils: false },
    calm:    { l: '—', r: '—', scale: 1,    pupils: false },
    breathe: { l: '◡', r: '◡', scale: 1,    pupils: false },
    wave:    { l: '●', r: '●', scale: 1,    pupils: true  },
    star:    { l: '⭐', r: '⭐', scale: 1.1, pupils: false },
  }

  // Mouth per mood
  const mouths = {
    happy:   'M 62 88 Q 80 100 98 88',
    excited: 'M 60 85 Q 80 102 100 85',
    calm:    'M 68 90 Q 80 95 92 90',
    breathe: 'M 65 90 Q 80 97 95 90',
    wave:    'M 62 88 Q 80 100 98 88',
    star:    'M 58 84 Q 80 104 102 84',
  }

  const animClass = animated
    ? mood === 'breathe' ? '' : 'eli-float'
    : ''

  const shouldBlink = mood === 'happy' || mood === 'wave'

  const s = size / 160   // scale factor for all internal coords → viewBox is 160×180

  return (
    <div
      className={`${animClass} ${className}`}
      style={{ width: size, height: Math.round(size * 1.1), display: 'inline-block', ...style }}
    >
      <svg
        width={size}
        height={Math.round(size * 1.1)}
        viewBox="0 0 160 176"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
        aria-label="Eli the elephant"
      >
        <style>{`
          @keyframes eli-auto-blink {
            0%, 44%, 46%, 48%, 100% { transform: scaleY(1); }
            45%, 47% { transform: scaleY(0.08); }
          }
          .eli-auto-blink {
            transform-origin: 80px 70px;
            animation: eli-auto-blink 4.8s infinite;
          }
        `}</style>

        {/* ── Shadow ── */}
        <ellipse cx="80" cy="168" rx="44" ry="7" fill="#0A7670" opacity="0.18" />

        {/* ── Legs ── */}
        <rect x="48" y="132" width="22" height="28" rx="11" fill="#0A7670" />
        <rect x="90" y="132" width="22" height="28" rx="11" fill="#0A7670" />
        {/* Toe details */}
        <ellipse cx="53" cy="159" rx="5" ry="3" fill="#088678" />
        <ellipse cx="63" cy="160" rx="4" ry="2.5" fill="#088678" />
        <ellipse cx="95" cy="159" rx="5" ry="3" fill="#088678" />
        <ellipse cx="105" cy="160" rx="4" ry="2.5" fill="#088678" />

        {/* ── Body ── */}
        <ellipse cx="80" cy="118" rx="42" ry="36" fill="#0D9488" />
        {/* Belly highlight */}
        <ellipse cx="80" cy="122" rx="24" ry="20" fill="#14B8A6" opacity="0.35" />

        {/* ── Tail ── */}
        <path d="M 122 110 Q 138 106 134 118 Q 130 130 136 134" stroke="#0A7670" strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="136" cy="135" r="4" fill="#FF6B9D" />

        {/* ── Arms ── */}
        {/* Left arm */}
        <ellipse cx="37" cy="118" rx="14" ry="10" fill="#0D9488" transform="rotate(-20 37 118)" />
        {/* Right arm — waving if mood=wave */}
        {mood === 'wave'
          ? <ellipse cx="123" cy="102" rx="14" ry="10" fill="#0D9488" transform="rotate(40 123 102)" />
          : <ellipse cx="123" cy="118" rx="14" ry="10" fill="#0D9488" transform="rotate(20 123 118)" />
        }

        {/* ── Head ── */}
        <circle cx="80" cy="74" r="40" fill="#0D9488" />

        {/* ── Ears ── */}
        {/* Left ear */}
        <ellipse cx="36" cy="70" rx="18" ry="24" fill="#0A7670" />
        <ellipse cx="36" cy="70" rx="11" ry="16" fill="#FF6B9D" opacity="0.5" />
        {/* Right ear */}
        <ellipse cx="124" cy="70" rx="18" ry="24" fill="#0A7670" />
        <ellipse cx="124" cy="70" rx="11" ry="16" fill="#FF6B9D" opacity="0.5" />

        {/* ── Head forehead shine ── */}
        <ellipse cx="72" cy="56" rx="10" ry="7" fill="white" opacity="0.12" transform="rotate(-25 72 56)" />

        {/* ── Eyes ── */}
        {mood === 'excited' ? (
          <>
            <text x="64" y="76" textAnchor="middle" fontSize="18" fill="white">★</text>
            <text x="96" y="76" textAnchor="middle" fontSize="18" fill="white">★</text>
          </>
        ) : mood === 'calm' || mood === 'breathe' ? (
          <>
            {/* Closed / relaxed eyes */}
            <path d="M 56 68 Q 64 64 72 68" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 88 68 Q 96 64 104 68" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </>
        ) : mood === 'star' ? (
          <>
            <text x="64" y="76" textAnchor="middle" fontSize="16" fill="#FFD93D">⭐</text>
            <text x="96" y="76" textAnchor="middle" fontSize="16" fill="#FFD93D">⭐</text>
          </>
        ) : (
          <g className={shouldBlink ? 'eli-auto-blink' : ''}>
            {/* Normal eyes */}
            <circle cx="64" cy="70" r="8" fill="white" />
            <circle cx="96" cy="70" r="8" fill="white" />
            {/* Pupils */}
            <circle cx="66" cy="71" r="5" fill="#1E3A5F" />
            <circle cx="98" cy="71" r="5" fill="#1E3A5F" />
            {/* Eye shine */}
            <circle cx="68" cy="69" r="2" fill="white" />
            <circle cx="100" cy="69" r="2" fill="white" />
          </g>
        )}

        {/* ── Mouth ── */}
        <path d={mouths[mood] || mouths.happy} stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* ── Cheeks ── */}
        <ellipse cx="52" cy="80" rx="7" ry="5" fill="#FF6B9D" opacity="0.45" />
        <ellipse cx="108" cy="80" rx="7" ry="5" fill="#FF6B9D" opacity="0.45" />

        {/* ── Trunk ── */}
        <path d="M 80 108 Q 68 122 72 136 Q 74 144 68 148" stroke="#0A7670" strokeWidth="12" strokeLinecap="round" fill="none" />
        {/* Trunk tip */}
        <circle cx="67" cy="150" r="7" fill="#0A7670" />

        {/* ── Bow tie ── */}
        <polygon points="72,102 80,108 72,114" fill="#FF6B35" />
        <polygon points="88,102 80,108 88,114" fill="#FF6B35" />
        <circle cx="80" cy="108" r="4" fill="#FFD93D" />

        {/* ── Mood decorations ── */}
        {mood === 'excited' && <>
          <text x="22" y="45" fontSize="20">✨</text>
          <text x="125" y="40" fontSize="16">⭐</text>
          <text x="130" y="85" fontSize="14">💫</text>
        </>}
        {mood === 'star' && <>
          <text x="14" y="40" fontSize="22">🌟</text>
          <text x="128" y="36" fontSize="18">⭐</text>
          <text x="135" y="90" fontSize="16">✨</text>
          <text x="10" y="90" fontSize="14">💛</text>
        </>}
        {mood === 'wave' && <>
          <text x="118" y="76" fontSize="20">👋</text>
        </>}
      </svg>
    </div>
  )
}
