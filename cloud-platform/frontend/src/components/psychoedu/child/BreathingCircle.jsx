'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/child/BreathingCircle.jsx — PAGES Calming Screen
// Language-aware via useLang() · Fully responsive with clamp()
// bg #EDE9FE · circle #8B5CF6 · text #5B21B6 · NO red anywhere
// 3 cycles of: breathe-in 4s → hold 2s → breathe-out 4s → calls onComplete
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import { t }       from '@/components/psychoedu/lib/translations'

// ── Phase data (durations only — labels come from translations) ───────────────
const PHASES = [
  { key: 'in',   durationKey: 'breathe.in',   dur: 4, sizePx: 200, mascotScale: 1.18 },
  { key: 'hold', durationKey: 'breathe.hold',  dur: 2, sizePx: 200, mascotScale: 1.18 },
  { key: 'out',  durationKey: 'breathe.out',   dur: 4, sizePx: 100, mascotScale: 1.0  },
]
const TOTAL_CYCLES = 3

// ── Breathing elephant mascot ─────────────────────────────────────────────────
function BreathingMascot({ scale = 1.0, lang }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
      <div style={{
        width: 'clamp(120px,28vw,168px)',
        height: 'clamp(120px,28vw,168px)',
        borderRadius: '50%',
        background: 'linear-gradient(135deg,#DDD6FE,#EDE9FE)',
        display: 'flex', alignItems:'center', justifyContent:'center',
        boxShadow: '0 4px 24px rgba(139,92,246,0.18)',
        transition: 'transform 4s ease-in-out',
        transform: `scale(${scale})`,
      }}>
        <img
          src="/psychoedu/mascots/elephant-breathe.svg"
          alt="Elephant mascot"
          style={{ width:'82%', height:'82%', objectFit:'contain' }}
        />
      </div>
    </div>
  )
}

// ── Cycle progress dots ───────────────────────────────────────────────────────
function CycleDots({ completed, total }) {
  return (
    <div style={{ display:'flex', gap:'0.6rem' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: 'clamp(10px,3vw,14px)',
          height: 'clamp(10px,3vw,14px)',
          borderRadius: '50%',
          background: i < completed ? '#8B5CF6' : '#DDD6FE',
          transition: 'background 0.4s',
        }} />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BreathingCircle({ onComplete }) {
  const { lang } = useLang()

  const [phaseIdx,   setPhaseIdx]   = useState(0)
  const [cycles,     setCycles]     = useState(0)
  const [countdown,  setCountdown]  = useState(PHASES[0].dur)
  const [circleSize, setCircleSize] = useState(100)
  const [isDone,     setIsDone]     = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)

  const tickRef = useRef(null)
  const phase   = PHASES[phaseIdx]

  // Auto-advance from instructions after 6 seconds
  useEffect(() => {
    if (!showInstructions) return
    const timer = setTimeout(() => setShowInstructions(false), 6000)
    return () => clearTimeout(timer)
  }, [showInstructions])

  // Animate circle size with a small delay so CSS transition fires
  useEffect(() => {
    const timer = setTimeout(() => setCircleSize(phase.sizePx), 40)
    return () => clearTimeout(timer)
  }, [phaseIdx])

  // Per-second tick
  useEffect(() => {
    if (isDone) return
    tickRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(tickRef.current); advancePhase(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(tickRef.current)
  }, [phaseIdx, isDone])

  function advancePhase() {
    const next = (phaseIdx + 1) % PHASES.length
    const endOfCycle = next === 0
    if (endOfCycle) {
      const nextCycles = cycles + 1
      setCycles(nextCycles)
      if (nextCycles >= TOTAL_CYCLES) {
        setIsDone(true)
        setTimeout(() => onComplete?.(), 700)
        return
      }
    }
    setPhaseIdx(next)
    setCountdown(PHASES[next].dur)
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (showInstructions) {
    return (
      <div style={{
        minHeight:'100svh', background:'#EDE9FE',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:'clamp(1.5rem,4vw,2rem)', padding:'clamp(1.5rem,4vw,2rem)',
        textAlign:'center', position:'relative', overflow:'hidden', boxSizing:'border-box',
      }}>
        {/* Blobs */}
        <div style={{ position:'absolute', top:'-60px', right:'-60px', width:'min(240px,50vw)', height:'min(240px,50vw)', borderRadius:'50%', background:'#DDD6FE', opacity:0.5, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'-80px', left:'-60px', width:'min(280px,55vw)', height:'min(280px,55vw)', borderRadius:'50%', background:'#C4B5FD', opacity:0.3, pointerEvents:'none' }} />

        <div style={{ zIndex:1 }}>
          {/* Mascot */}
          <div style={{ marginBottom:'clamp(1.5rem,4vw,2rem)', animation:'fadeUpAnim 0.6s ease' }}>
            <div style={{
              width: 'clamp(130px,32vw,184px)',
              height: 'clamp(130px,32vw,184px)',
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#DDD6FE,#EDE9FE)',
              display: 'flex', alignItems:'center', justifyContent:'center',
              boxShadow: '0 4px 24px rgba(139,92,246,0.18)',
            }}>
              <img
                src="/psychoedu/mascots/elephant-breathe.svg"
                alt="Elephant mascot"
                style={{ width:'82%', height:'82%', objectFit:'contain' }}
              />
            </div>
          </div>

          {/* Instructions */}
          <h1 style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.5rem,5.5vw,2.4rem)', fontWeight:900, color:'#5B21B6', lineHeight:1.25, marginBottom:'clamp(1rem,3vw,1.5rem)' }}>
            {t('breathe.instruction_heading', lang)}
          </h1>
          <p style={{ fontSize:'clamp(1rem,3.5vw,1.3rem)', fontWeight:700, color:'#7C3AED', lineHeight:1.4, marginBottom:'clamp(1.25rem,3vw,1.75rem)', maxWidth:'420px' }}>
            {t('breathe.instruction_text', lang)}
          </p>
        </div>
      </div>
    )
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (isDone) {
    return (
      <div style={{ minHeight:'100svh', background:'#EDE9FE', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1.25rem', padding:'2rem', textAlign:'center' }}>
        <span style={{ fontSize:'clamp(3.5rem,12vw,5rem)', animation:'fadeUp 0.5s ease' }}>🌟</span>
        <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.6rem,6vw,2.2rem)', fontWeight:900, color:'#5B21B6' }}>
          {t('breathe.done_heading', lang)}
        </p>
        <p style={{ fontSize:'clamp(0.95rem,3vw,1.2rem)', fontWeight:700, color:'#7C3AED' }}>
          {t('breathe.done_sub', lang)}
        </p>
      </div>
    )
  }

  // Arc SVG dimensions (responsive)
  const svgSize   = 'min(240px, 60vw)'
  const arcR      = 116
  const arcCirc   = 2 * Math.PI * arcR
  const arcDash   = (1 - countdown / phase.dur) * arcCirc

  // Responsive circle size (clamp to viewport)
  const clampedSize = `clamp(${Math.round(circleSize * 0.45)}px, ${Math.round(circleSize * 0.22)}vw, ${circleSize}px)`

  return (
    <>
      <style>{`
        @keyframes rippleOut {
          0%   { transform:scale(1);   opacity:0.2; }
          100% { transform:scale(2.2); opacity:0; }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeUpAnim {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes floatMascot {
          0%,100% { transform:translateY(0); }
          50%      { transform:translateY(-8px); }
        }
        .float-m { animation: floatMascot 3s ease-in-out infinite; }
      `}</style>

      <main style={{
        minHeight: '100svh',
        background: '#EDE9FE',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'clamp(1.25rem,4vw,2rem) clamp(1rem,4vw,1.5rem)',
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
      }}>
        {/* Blobs */}
        <div style={{ position:'absolute', top:'-60px', right:'-60px', width:'min(240px,50vw)', height:'min(240px,50vw)', borderRadius:'50%', background:'#DDD6FE', opacity:0.5, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'-80px', left:'-60px', width:'min(280px,55vw)', height:'min(280px,55vw)', borderRadius:'50%', background:'#C4B5FD', opacity:0.3, pointerEvents:'none' }} />

        {/* Heading */}
        <div style={{ textAlign:'center', zIndex:1 }}>
          <h1 style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.3rem,5vw,2.2rem)', fontWeight:900, color:'#5B21B6', lineHeight:1.2 }}>
            {t('breathe.heading', lang)}
          </h1>
          <p style={{ fontSize:'clamp(0.85rem,2.5vw,1.05rem)', fontWeight:700, color:'#7C3AED', marginTop:'4px' }}>
            {t('breathe.subheading', lang)}
          </p>
        </div>

        {/* Mascot + Circle row */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          gap:'clamp(1rem,4vw,2.5rem)', width:'100%', flexWrap:'wrap', zIndex:1,
        }}>
          {/* Mascot */}
          <div className="float-m">
            <BreathingMascot scale={phase.mascotScale} lang={lang} />
          </div>

          {/* Breathing circle */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'clamp(1rem,3vw,1.75rem)' }}>
            {/* SVG arc + circle */}
            <div style={{ position:'relative', width:svgSize, height:svgSize, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="100%" height="100%" viewBox="0 0 240 240" style={{ position:'absolute', top:0, left:0, transform:'rotate(-90deg)' }}>
                <circle cx="120" cy="120" r={arcR} fill="none" stroke="#DDD6FE" strokeWidth="6" />
                <circle cx="120" cy="120" r={arcR} fill="none" stroke="#8B5CF6" strokeWidth="6"
                  strokeDasharray={`${arcDash} ${arcCirc}`}
                  strokeLinecap="round"
                  style={{ transition:'stroke-dasharray 0.9s linear' }}
                />
              </svg>

              {/* Ripple rings — only during inhale */}
              {phase.key === 'in' && [0, 0.8, 1.6].map(delay => (
                <div key={delay} style={{
                  position:'absolute', width:'min(200px,50vw)', height:'min(200px,50vw)',
                  borderRadius:'50%', border:'3px solid #8B5CF6', opacity:0.18,
                  animation:`rippleOut 3s ease-out ${delay}s infinite`,
                }} />
              ))}

              {/* Main circle */}
              <div style={{
                width: clampedSize,
                height: clampedSize,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 38% 35%, #A78BFA, #8B5CF6)',
                boxShadow: `0 0 ${circleSize * 0.3}px rgba(139,92,246,0.4)`,
                transition: `width ${phase.dur}s ease-in-out, height ${phase.dur}s ease-in-out, box-shadow ${phase.dur}s ease-in-out`,
                display: 'flex', alignItems:'center', justifyContent:'center',
              }}>
                <span style={{
                  fontFamily:"'Baloo 2',cursive",
                  fontSize: `clamp(1.5rem,${circleSize > 140 ? 7 : 5}vw,${circleSize > 140 ? 3 : 2}rem)`,
                  fontWeight: 900, color:'white', lineHeight:1,
                  transition:'font-size 0.4s ease',
                }}>
                  {countdown}
                </span>
              </div>
            </div>

            {/* Phase label */}
            <div style={{ textAlign:'center' }}>
              <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.5rem,5vw,2rem)', fontWeight:900, color:'#5B21B6', lineHeight:1.15, transition:'opacity 0.3s' }}>
                {t(phase.durationKey, lang)}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: dots + messages */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem', zIndex:1 }}>
          <CycleDots completed={cycles} total={TOTAL_CYCLES} />
          <p style={{ fontSize:'clamp(0.82rem,2.5vw,1rem)', fontWeight:700, color:'#5B21B6', opacity:0.75, textAlign:'center' }}>
            {cycles < TOTAL_CYCLES
              ? t('breathe.rounds_left', lang, TOTAL_CYCLES - cycles)
              : '✓'}
          </p>
          <p style={{ fontSize:'clamp(0.85rem,2.5vw,1rem)', fontWeight:700, color:'#7C3AED', textAlign:'center' }}>
            {t('breathe.safe', lang)}
          </p>
        </div>
      </main>
    </>
  )
}
