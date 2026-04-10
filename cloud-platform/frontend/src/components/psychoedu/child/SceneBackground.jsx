'use client'

// Cloud SVG 
function Cloud({ style, animClass = 'cloud-1', opacity = 1 }) {
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

// Butterfly SVG 
function Butterfly({ style, animClass = 'butterfly', color1 = '#FF6B9D', color2 = '#FFD93D' }) {
  return (
    <svg viewBox="0 0 40 30" style={{ position: 'absolute', bottom: '40px', width: 46, height: 38, ...style }} className={animClass} aria-hidden="true">
      <ellipse cx="10" cy="12" rx="10" ry="12" fill={color1} opacity="0.8" transform="rotate(-20 10 12)" />
      <ellipse cx="30" cy="12" rx="10" ry="12" fill={color2} opacity="0.8" transform="rotate(20 30 12)" />
      <ellipse cx="10" cy="22" rx="7" ry="8" fill={color1} opacity="0.6" transform="rotate(15 10 22)" />
      <ellipse cx="30" cy="22" rx="7" ry="8" fill={color2} opacity="0.6" transform="rotate(-15 30 22)" />
      <rect x="19" y="8" width="2" height="20" rx="1" fill="#1E3A5F" opacity="0.5" />
    </svg>
  )
}

// Flower SVG 
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

// Large ground flower (tall stem)
function LargeGroundFlower({ style, color = '#FF6B9D', size = 84 }) {
  const flowerId = `flower-${color.replace('#', '')}`
  return (
    <svg
      viewBox="0 0 120 260"
      style={{
        position: 'absolute',
        width: size,
        height: Math.round(size * 2.1),
        pointerEvents: 'none',
        ...style,
      }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${flowerId}-petal`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="38%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.72" />
        </radialGradient>
        <radialGradient id={`${flowerId}-center`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#FFF3B0" />
          <stop offset="58%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#FB923C" />
        </radialGradient>
      </defs>

      {/* Soft glow behind petals */}
      <circle cx="60" cy="58" r="36" fill={color} opacity="0.2" />

      {/* Tall stem */}
      <path d="M60 250 C 58 190, 54 135, 60 86" stroke="#15803D" strokeWidth="11" strokeLinecap="round" fill="none" />
      {/* Leaves */}
      <ellipse cx="44" cy="168" rx="20" ry="10" transform="rotate(-26 44 168)" fill="#4ADE80" opacity="0.95" />
      <ellipse cx="77" cy="145" rx="18" ry="9" transform="rotate(28 77 145)" fill="#4ADE80" opacity="0.9" />

      {/* Back petal ring */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
        <ellipse
          key={`b-${i}`}
          cx="60"
          cy="58"
          rx="10"
          ry="26"
          fill={`url(#${flowerId}-petal)`}
          opacity="0.78"
          transform={`rotate(${deg} 60 58)`}
        />
      ))}

      {/* Front petal ring */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <ellipse
          key={`f-${i}`}
          cx="60"
          cy="58"
          rx="12.5"
          ry="24.5"
          fill={`url(#${flowerId}-petal)`}
          opacity="0.96"
          transform={`rotate(${deg} 60 58)`}
        />
      ))}

      {/* Center */}
      <circle cx="60" cy="58" r="14.5" fill={`url(#${flowerId}-center)`} />
      <circle cx="60" cy="58" r="6.5" fill="#F97316" />
      <circle cx="56" cy="54" r="2.2" fill="#FFF7CC" opacity="0.8" />
    </svg>
  )
}

// Rainbow arc 
function Rainbow({ style }) {
  const colors = ['#FF6B6B','#FF6B35','#FFD93D','#4ADE80','#60A5FA','#A855F7']
  return (
    <svg
      viewBox="0 0 2000 1000"
      style={{ position: 'absolute', bottom: 0, width: '100%', height: '100%', opacity: 0.55, ...style }}
      aria-hidden="true"
    >
      {colors.map((c, i) => (
        <path
          key={i}
          // Start way off left (-300,1000), curve up, end way off right (2300,1000)
          d={`M -390 860 Q 1000 ${-300 - i * 40} 2480 900`}
          fill="none"
          stroke={c}
          strokeWidth="35"
        />
      ))}

    </svg>
  )
}


// Main scene 
export default function SceneBackground({ children, variant = 'day', largeGroundFlowers = false }) {
  return (
    <div style={{
      position: 'relative',
      minHeight: '100svh',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #87CEEB 0%, #B8E4F7 45%, #D4F1FF 70%, #A8E6A3 85%, #6DBE47 100%)',
    }}>
      {/* ── Rainbow ── */}
      <Rainbow style={{ top: '-2%', left: 0, width: '100%', height: '78%' }} />

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
      <Butterfly style={{ bottom: '35%', left: '8%' }}  animClass="butterfly"   color1="#FF6B9D" color2="#FFD93D" />
      <Butterfly style={{ bottom: '35%', right: '10%' }} animClass="butterfly-2" color1="#A855F7" color2="#60A5FA" />

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

      {/* ── Large decorative flowers from ground up ── */}
      {largeGroundFlowers && (
        <>
          <LargeGroundFlower style={{ bottom: '3.8%', left: '-2%', transform: 'rotate(-8deg)' }} color="#FF6B9D" size={112} />
          <LargeGroundFlower style={{ bottom: '4.1%', left: '10%', transform: 'rotate(5deg)' }} color="#A855F7" size={98} />
          <LargeGroundFlower style={{ bottom: '4.4%', left: '22%', transform: 'rotate(-4deg)' }} color="#60A5FA" size={88} />
          <LargeGroundFlower style={{ bottom: '4.2%', right: '21%', transform: 'rotate(3deg)' }} color="#34D399" size={92} />
          <LargeGroundFlower style={{ bottom: '4.0%', right: '10%', transform: 'rotate(-4deg)' }} color="#FFD93D" size={104} />
          <LargeGroundFlower style={{ bottom: '3.6%', right: '-2%', transform: 'rotate(8deg)' }} color="#FF6B35" size={118} />
        </>
      )}

      {/* ── Content layer ── */}
      <div style={{ position: 'relative', zIndex: 10, minHeight: '100svh' }}>
        {children}
      </div>
    </div>
  )
}
