// src/components/psychoedu/child/SceneBackground.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Layered animated scene background — sky, clouds, floating stars,
// grass, butterflies, flowers. Used on welcome + language pages.
// Pure CSS animations, no external libs.
// ─────────────────────────────────────────────────────────────────────────────

'use client'

// ── Cloud SVG ─────────────────────────────────────────────────────────────────
function Cloud({ style, animClass = 'cloud-1', opacity = 0.9 }) {
  return (
    <svg
      viewBox="0 0 120 60"
      style={{ position: 'absolute', opacity, ...style }}
      className={animClass}
      aria-hidden="true"
    >
      <ellipse cx="60" cy="40" rx="50" ry="22" fill="white" />
      <ellipse cx="40" cy="32" rx="28" ry="22" fill="white" />
      <ellipse cx="80" cy="30" rx="24" ry="20" fill="white" />
    </svg>
  )
}

// ── Butterfly SVG ─────────────────────────────────────────────────────────────
function Butterfly({ style, animClass = 'butterfly', color1 = '#FF6B9D', color2 = '#FFD93D' }) {
  return (
    <svg viewBox="0 0 40 30" style={{ position: 'absolute', width: 36, height: 28, ...style }} className={animClass} aria-hidden="true">
      <ellipse cx="10" cy="12" rx="10" ry="12" fill={color1} opacity="0.8" transform="rotate(-20 10 12)" />
      <ellipse cx="30" cy="12" rx="10" ry="12" fill={color2} opacity="0.8" transform="rotate(20 30 12)" />
      <ellipse cx="10" cy="22" rx="7" ry="8" fill={color1} opacity="0.6" transform="rotate(15 10 22)" />
      <ellipse cx="30" cy="22" rx="7" ry="8" fill={color2} opacity="0.6" transform="rotate(-15 30 22)" />
      <rect x="19" y="8" width="2" height="20" rx="1" fill="#1E3A5F" opacity="0.5" />
    </svg>
  )
}

// ── Flower SVG ────────────────────────────────────────────────────────────────
function Flower({ style, color = '#FF6B9D', size = 28 }) {
  return (
    <svg viewBox="0 0 40 48" style={{ position: 'absolute', width: size, height: size * 1.2, ...style }} aria-hidden="true">
      {/* Stem */}
      <rect x="18" y="24" width="4" height="22" rx="2" fill="#4ADE80" />
      {/* Petals */}
      {[0,60,120,180,240,300].map((deg, i) => (
        <ellipse key={i} cx="20" cy="20" rx="5" ry="11"
          fill={color} opacity="0.85"
          transform={`rotate(${deg} 20 20)`}
        />
      ))}
      {/* Centre */}
      <circle cx="20" cy="20" r="6" fill="#FFD93D" />
      <circle cx="20" cy="20" r="3" fill="#FF6B35" />
    </svg>
  )
}

// ── Star SVG ──────────────────────────────────────────────────────────────────
function Star({ style, color = '#FFD93D', size = 18, animClass = 'twinkle-1' }) {
  return (
    <svg viewBox="0 0 24 24" style={{ position: 'absolute', width: size, height: size, ...style }} className={animClass} aria-hidden="true">
      <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill={color} />
    </svg>
  )
}

// ── Rainbow arc ───────────────────────────────────────────────────────────────
function Rainbow({ style }) {
  const colors = ['#FF6B6B','#FF6B35','#FFD93D','#4ADE80','#60A5FA','#A855F7']
  return (
    <svg viewBox="0 0 200 100" style={{ position: 'absolute', opacity: 0.35, ...style }} aria-hidden="true">
      {colors.map((c, i) => (
        <path key={i}
          d={`M ${10 + i*5} 95 Q 100 ${-10 + i*6} ${190 - i*5} 95`}
          fill="none" stroke={c} strokeWidth="10"
        />
      ))}
    </svg>
  )
}

// ── Main scene ────────────────────────────────────────────────────────────────
export default function SceneBackground({ children, variant = 'day' }) {
  return (
    <div style={{
      position: 'relative',
      minHeight: '100svh',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #87CEEB 0%, #B8E4F7 45%, #D4F1FF 70%, #A8E6A3 85%, #6DBE47 100%)',
    }}>
      {/* ── Sky stars (top area) ── */}
      <Star style={{ top: '5%', left: '8%', width: 14 }}  color="#FFD93D" animClass="twinkle-1" />
      <Star style={{ top: '9%', left: '75%', width: 10 }} color="#FFD93D" animClass="twinkle-2" />
      <Star style={{ top: '3%', left: '50%', width: 12 }} color="#FFF"    animClass="twinkle-3" />
      <Star style={{ top: '7%', right: '12%', width: 9 }} color="#FFD93D" animClass="twinkle-1" />

      {/* ── Rainbow ── */}
      <Rainbow style={{ top: '4%', left: '50%', transform: 'translateX(-50%)', width: '88%', maxWidth: 460 }} />

      {/* ── Clouds ── */}
      <Cloud style={{ top: '8%',  left: '2%',  width: '40%', maxWidth: 180 }} animClass="cloud-1" opacity={0.95} />
      <Cloud style={{ top: '14%', right: '3%', width: '36%', maxWidth: 160 }} animClass="cloud-2" opacity={0.9} />
      <Cloud style={{ top: '5%',  left: '38%', width: '28%', maxWidth: 130 }} animClass="cloud-3" opacity={0.85} />

      {/* ── Sun ── */}
      <div style={{
        position: 'absolute', top: '5%', right: '8%',
        width: 'clamp(50px, 12vw, 70px)',
        height: 'clamp(50px, 12vw, 70px)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, #FFE066 40%, #FFB347 100%)',
        boxShadow: '0 0 30px 10px rgba(255,200,50,0.3)',
        animation: 'breathe-expand 6s ease-in-out infinite',
      }} aria-hidden="true" />

      {/* ── Butterflies ── */}
      <Butterfly style={{ top: '30%', left: '6%' }}  animClass="butterfly"   color1="#FF6B9D" color2="#FFD93D" />
      <Butterfly style={{ top: '40%', right: '8%' }} animClass="butterfly-2" color1="#A855F7" color2="#60A5FA" />

      {/* ── Grass hills (bottom) ── */}
      <svg viewBox="0 0 400 80" preserveAspectRatio="none"
        style={{ position:'absolute', bottom:0, left:0, width:'100%', height:'clamp(60px,15vw,100px)' }}
        aria-hidden="true"
      >
        {/* Back hill */}
        <ellipse cx="100" cy="80" rx="180" ry="60" fill="#86EFAC" opacity="0.5" />
        <ellipse cx="320" cy="80" rx="160" ry="55" fill="#86EFAC" opacity="0.5" />
        {/* Front hill */}
        <ellipse cx="200" cy="80" rx="250" ry="70" fill="#4ADE80" opacity="0.6" />
        {/* Grass strip */}
        <rect x="0" y="65" width="400" height="15" fill="#22C55E" />
      </svg>

      {/* ── Flowers in grass ── */}
      <Flower style={{ bottom: '4%', left: '5%' }}  color="#FF6B9D" size={26} />
      <Flower style={{ bottom: '3%', left: '22%' }} color="#FFD93D" size={22} />
      <Flower style={{ bottom: '5%', left: '60%' }} color="#A855F7" size={24} />
      <Flower style={{ bottom: '3%', right: '8%' }} color="#FF6B35" size={20} />
      <Flower style={{ bottom: '6%', right: '28%'}} color="#FF6B9D" size={18} />

      {/* ── Content layer ── */}
      <div style={{ position: 'relative', zIndex: 10, minHeight: '100svh' }}>
        {children}
      </div>
    </div>
  )
}
