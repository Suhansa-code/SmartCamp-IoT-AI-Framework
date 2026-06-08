import { useState, useEffect } from 'react'
import { LANGUAGES } from '@/components/psychoedu/lib/translations'
import Eli from './Eli'
import SceneBackground from './SceneBackground'

//Confetti piece 
function ConfettiPiece({ x, color, delay, shape }) {
  const size = 8 + Math.random() * 8
  return (
    <div style={{
      position:'fixed', top:'-20px', left:`${x}%`,
      width: size, height: shape === 'circle' ? size : size * 0.6,
      borderRadius: shape === 'circle' ? '50%' : '2px',
      background: color,
      animation: `confetti-fall ${1.2 + Math.random()}s ease-out ${delay}s forwards`,
      zIndex: 50,
      pointerEvents: 'none',
    }} />
  )
}

// Language card 
const LANG_DESIGNS = {
  si: {
    gradient: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 50%, #FFB347 100%)',
    glow:     'rgba(255,107,53,0.35)',
    shadow:   '0 12px 40px rgba(255,107,53,0.3)',
    icon:     '🇱🇰',
    bg:       '#FFF3EE',
    accent:   '#FF6B35',
    pattern:  '❋ ❋ ❋',
  },
  ta: {
    gradient: 'linear-gradient(135deg, #A855F7 0%, #C084FC 50%, #E879F9 100%)',
    glow:     'rgba(168,85,247,0.35)',
    shadow:   '0 12px 40px rgba(168,85,247,0.3)',
    icon:     '🌺',
    bg:       '#FAF5FF',
    accent:   '#A855F7',
    pattern:  '✿ ✿ ✿',
  },
  en: {
    gradient: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 50%, #2DD4BF 100%)',
    glow:     'rgba(13,148,136,0.35)',
    shadow:   '0 12px 40px rgba(13,148,136,0.3)',
    icon:     '📖',
    bg:       '#F0FDF9',
    accent:   '#0D9488',
    pattern:  '★ ★ ★',
  },
}

function LangCard({ lang, onSelect, delay, selected, disabled }) {
  const d = LANG_DESIGNS[lang.code]
  const isSelected = selected === lang.code

  return (
    <button
      onClick={() => !disabled && onSelect(lang.code)}
      className="btn-press"
      style={{
        width:'100%',
        minHeight:'clamp(80px,16vw,100px)',
        borderRadius:'clamp(1.25rem,4vw,1.75rem)',
        border:`3px solid ${isSelected ? d.accent : 'rgba(255,255,255,0.7)'}`,
        background: isSelected ? d.gradient : 'rgba(255,255,255,0.88)',
        backdropFilter:'blur(12px)',
        boxShadow: isSelected ? d.shadow : '0 4px 20px rgba(0,0,0,0.08)',
        display:'flex', alignItems:'center', gap:'clamp(0.75rem,3vw,1.25rem)',
        padding:'0 clamp(1rem,4vw,1.75rem)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: isSelected ? 'scale(1.03)' : 'scale(1)',
        transition:'all 0.2s cubic-bezier(0.34,1.4,0.64,1)',
        animation:`card-enter 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay}s both`,
        opacity: 0,
        position:'relative', overflow:'hidden',
      }}
    >
      <style>{`
        @keyframes card-enter{0%{opacity:0;transform:translateY(30px) scale(0.9)}100%{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>

      {/* Background pattern (subtle) */}
      <div style={{
        position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
        fontSize:28, opacity: isSelected ? 0.25 : 0.08, letterSpacing:8,
        color: isSelected ? 'white' : d.accent, pointerEvents:'none',
        fontFamily:'serif',
      }}>
        {d.pattern}
      </div>

      {/* Flag/icon circle */}
      <div style={{
        width:'clamp(52px,13vw,64px)', height:'clamp(52px,13vw,64px)',
        borderRadius:'50%',
        background: isSelected ? 'rgba(255,255,255,0.25)' : `${d.bg}`,
        border:`3px solid ${isSelected ? 'rgba(255,255,255,0.5)' : d.accent}22`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'clamp(1.6rem,6vw,2rem)', flexShrink:0,
        boxShadow: isSelected ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
        transition:'all 0.2s',
      }}>
        {d.icon}
      </div>

      {/* Labels */}
      <div style={{ flex:1, textAlign:'left' }}>
        <p style={{
          fontFamily:"'Baloo 2',cursive",
          fontSize:'clamp(1.3rem,5vw,1.75rem)', fontWeight:900, lineHeight:1.1,
          color: isSelected ? 'white' : '#1E3A5F',
          transition:'color 0.2s',
        }}>
          {lang.label}
        </p>
        <p style={{
          fontSize:'clamp(0.75rem,2.5vw,0.9rem)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
          color: isSelected ? 'rgba(255,255,255,0.8)' : d.accent,
          marginTop:2, transition:'color 0.2s',
        }}>
          {lang.labelEn}
        </p>
      </div>

      {/* Check */}
      <div style={{
        width:'clamp(28px,6vw,36px)', height:'clamp(28px,6vw,36px)',
        borderRadius:'50%',
        background: isSelected ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)',
        border:`2px solid ${isSelected ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.1)'}`,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        fontSize:16, transition:'all 0.2s',
      }}>
        {isSelected ? '✓' : ''}
      </div>
    </button>
  )
}

// Main component
export default function LanguagePicker({ sessionId, onSelect }) {
  const [selected,   setSelected]  = useState(null)
  const [confetti,   setConfetti]  = useState([])
  const [eliMood,    setEliMood]   = useState('wave')
  const [confirmed,  setConfirmed] = useState(false)
  const [eliSize,    setEliSize]   = useState(110)

  useEffect(() => {
    function updateEliSize() {
      setEliSize(Math.min(130, Math.round(window.innerWidth * 0.3)))
    }

    updateEliSize()
    window.addEventListener('resize', updateEliSize)
    return () => window.removeEventListener('resize', updateEliSize)
  }, [])

  function handlePick(code) {
    if (confirmed) return
    setSelected(code)
    setEliMood('excited')

    // Confetti burst
    const pieces = Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: ['#FF6B35','#FFD93D','#FF6B9D','#A855F7','#0D9488','#4ADE80','#60A5FA'][i % 7],
      delay: Math.random() * 0.4,
      shape: i % 3 === 0 ? 'circle' : 'rect',
    }))
    setConfetti(pieces)

    // After brief pause, confirm
    setTimeout(() => {
      setEliMood('star')
      setConfirmed(true)
      setTimeout(() => {
        if (typeof onSelect === 'function') {
          onSelect(code)
        }
      }, 700)
    }, 600)
  }

  // Cleanup confetti
  useEffect(() => {
    if (!confetti.length) return
    const t = setTimeout(() => setConfetti([]), 2200)
    return () => clearTimeout(t)
  }, [confetti])

  return (
    <SceneBackground largeGroundFlowers>
      <style>{`
        @keyframes heading-bounce{0%{opacity:0;transform:translateY(-20px) scale(0.9)}100%{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>

      {/* Confetti */}
      {confetti.map(p => <ConfettiPiece key={p.id} {...p} />)}

      <div style={{
        minHeight:'100svh', display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'space-between',
        padding:'clamp(1rem,4vw,1.5rem) clamp(1rem,4vw,1.25rem)',
        boxSizing:'border-box',
      }}>

        {/* Eli + heading */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'clamp(0.5rem,2vw,0.75rem)', width:'100%' }}>
          <div style={{ animation:'heading-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both', opacity:0 }}>
            <Eli
              size={eliSize}
              mood={eliMood}
            />
          </div>

          {/* Trilingual heading */}
          <div style={{
            background:'rgba(255,255,255,0.88)', backdropFilter:'blur(12px)',
            borderRadius:'1.5rem', padding:'clamp(0.75rem,3vw,1rem) clamp(1.25rem,4vw,1.75rem)',
            textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,0.08)',
            border:'2px solid rgba(255,255,255,0.9)',
            animation:'heading-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.25s both',
            opacity:0,
          }}>
            <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.3rem,5vw,1.8rem)', fontWeight:900, color:'#1E3A5F', lineHeight:1.2 }}>
              ඔබේ භාෂාව තෝරන්න 🌟
            </p>
            <p style={{ fontSize:'clamp(0.95rem,3vw,1.15rem)', fontWeight:700, color:'#A855F7', marginTop:2 }}>
              உங்கள் மொழியை தேர்ந்தெடுக்கவும்
            </p>
            <p style={{ fontSize:'clamp(0.82rem,2.5vw,0.95rem)', fontWeight:700, color:'#0D9488', letterSpacing:'0.06em', textTransform:'uppercase', marginTop:2 }}>
              Choose Your Language
            </p>
          </div>
        </div>

        {/* Language cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:'clamp(0.65rem,2.5vw,0.9rem)', width:'100%', maxWidth:'min(460px,94vw)' }}>
          {LANGUAGES.map((lang, i) => (
            <LangCard
              key={lang.code}
              lang={lang}
              onSelect={handlePick}
              delay={0.4 + i * 0.12}
              selected={selected}
              disabled={confirmed}
            />
          ))}
        </div>

      </div>
    </SceneBackground>
  )
}
