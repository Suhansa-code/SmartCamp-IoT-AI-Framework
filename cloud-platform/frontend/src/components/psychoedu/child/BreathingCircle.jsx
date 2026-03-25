'use client'

import { useState, useEffect, useRef } from 'react'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import { t }       from '@/components/psychoedu/lib/translations'
import Eli          from './Eli'

const PHASES = [
  { key:'in',   labelKey:'breathe.in',   dur:4, circleSize:180, eliScale:1.18, color:'#8B5CF6', tip:'🌬️' },
  { key:'hold', labelKey:'breathe.hold', dur:2, circleSize:180, eliScale:1.18, color:'#6D28D9', tip:'⏸️' },
  { key:'out',  labelKey:'breathe.out',  dur:4, circleSize:110, eliScale:1.0,  color:'#A78BFA', tip:'💨'},
]
const TOTAL_CYCLES = 3

// ── Floating bubble ───────────────────────────────────────────────────────────
function Bubble({ style, size = 20, color = 'rgba(167,139,250,0.3)' }) {
  return (
    <div style={{
      position:'absolute', width:size, height:size, borderRadius:'50%',
      background:color, border:'1.5px solid rgba(167,139,250,0.5)',
      animationName:'bubble-rise',
      animationDuration:`${3 + Math.random() * 3}s`,
      animationTimingFunction:'ease-in-out',
      animationIterationCount:'infinite',
      ...style,
    }} />
  )
}

// ── Firefly dot ───────────────────────────────────────────────────────────────
function Firefly({ style }) {
  return (
    <div style={{
      position:'absolute', width:6, height:6, borderRadius:'50%',
      background:'#FFD93D', boxShadow:'0 0 8px 3px rgba(255,217,61,0.6)',
      animationName:'firefly-drift',
      animationDuration:`${4 + Math.random() * 4}s`,
      animationTimingFunction:'ease-in-out',
      animationIterationCount:'infinite',
      ...style,
    }} />
  )
}

// ── Cycle dots ────────────────────────────────────────────────────────────────
function CycleDots({ completed, total }) {
  return (
    <div style={{ display:'flex', gap:'0.6rem', justifyContent:'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width:16, height:16, borderRadius:'50%',
          background: i < completed
            ? 'linear-gradient(135deg,#8B5CF6,#A78BFA)'
            : 'rgba(255,255,255,0.3)',
          border:'2px solid rgba(139,92,246,0.4)',
          boxShadow: i < completed ? '0 0 10px rgba(139,92,246,0.5)' : 'none',
          transition:'all 0.4s',
        }} />
      ))}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function BreathingCircle({ onComplete }) {
  const { lang }    = useLang()
  const [phaseIdx,  setPhaseIdx]  = useState(0)
  const [cycles,    setCycles]    = useState(0)
  const [countdown, setCountdown] = useState(PHASES[0].dur)
  const [circleSize,setCircleSize]= useState(110)
  const [isDone,    setIsDone]    = useState(false)
  const tickRef = useRef(null)
  const phase   = PHASES[phaseIdx]

  // Animate circle size
  useEffect(() => {
    const timer = setTimeout(() => setCircleSize(phase.circleSize), 60)
    return () => clearTimeout(timer)
  }, [phaseIdx])

  useEffect(() => {
    if (isDone) return
    tickRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(tickRef.current); advance(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(tickRef.current)
  }, [phaseIdx, isDone])

  function advance() {
    const next = (phaseIdx + 1) % PHASES.length
    const endOfCycle = next === 0
    if (endOfCycle) {
      const nCycles = cycles + 1
      setCycles(nCycles)
      if (nCycles >= TOTAL_CYCLES) {
        setIsDone(true)
        setTimeout(() => onComplete?.(), 800)
        return
      }
    }
    setPhaseIdx(next)
    setCountdown(PHASES[next].dur)
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (isDone) {
    return (
      <div style={{
        minHeight:'100svh',
        background:'linear-gradient(160deg,#F3E8FF 0%,#EDE9FE 40%,#DDD6FE 100%)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:'1.5rem', padding:'2rem', textAlign:'center',
      }}>
        <div className="eli-wiggle"><Eli size={140} mood="star" /></div>
        <div style={{
          background:'rgba(255,255,255,0.8)', backdropFilter:'blur(12px)',
          borderRadius:'2rem', padding:'1.5rem 2rem',
          boxShadow:'0 8px 32px rgba(139,92,246,0.15)',
        }}>
          <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.6rem,6vw,2.2rem)', fontWeight:900, color:'#5B21B6' }}>
            🌟 {t('breathe.done_heading', lang)}
          </p>
          <p style={{ fontSize:'clamp(1rem,3vw,1.2rem)', fontWeight:700, color:'#7C3AED', marginTop:8 }}>
            {t('breathe.done_sub', lang)}
          </p>
        </div>
      </div>
    )
  }

  // Responsive sizes
  const maxCircle = Math.min(circleSize, typeof window !== 'undefined' ? window.innerWidth * 0.42 : circleSize)

  return (
    <>
      <style>{`
        @keyframes bubble-rise{0%,100%{transform:translateY(0) scale(1);opacity:0.6}50%{transform:translateY(-30px) scale(1.1);opacity:0.9}}
        @keyframes firefly-drift{0%,100%{transform:translate(0,0);opacity:0.4}25%{transform:translate(15px,-20px);opacity:1}75%{transform:translate(-12px,-10px);opacity:0.7}}
        @keyframes phase-pulse{0%,100%{opacity:0.8}50%{opacity:1}}
      `}</style>

      <div style={{
        minHeight:'100svh', position:'relative', overflow:'hidden',
        background:`linear-gradient(160deg,#F5F3FF 0%,#EDE9FE 45%,${
          phase.key==='in' ? '#DDD6FE' : phase.key==='hold' ? '#C4B5FD' : '#E8E4FE'} 100%)`,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between',
        padding:'clamp(1.25rem,4vw,2rem) clamp(1rem,4vw,1.5rem)',
        boxSizing:'border-box', transition:'background 2s ease',
      }}>

        {/* Floating bubbles */}
        {[
          { bottom:'8%', left:'5%',   size:24, delay:0   },
          { bottom:'20%',right:'4%',  size:16, delay:0.8 },
          { bottom:'35%',left:'8%',   size:12, delay:1.6 },
          { bottom:'50%',right:'10%', size:20, delay:0.4 },
          { bottom:'65%',left:'3%',   size:14, delay:1.2 },
          { bottom:'80%',right:'6%',  size:10, delay:2.0 },
        ].map((b,i) => <Bubble key={i} style={{ bottom:b.bottom, left:b.left, right:b.right, animationDelay:`${b.delay}s` }} size={b.size} />)}

        {/* Fireflies */}
        {[
          { top:'15%', left:'10%' }, { top:'25%', right:'12%' },
          { top:'60%', left:'6%'  }, { top:'70%', right:'8%'  },
          { top:'40%', left:'85%' },
        ].map((f,i) => <Firefly key={i} style={{ top:f.top, left:f.left, right:f.right, animationDelay:`${i*0.7}s` }} />)}

        {/* ── Heading ── */}
        <div style={{ textAlign:'center', zIndex:1 }}>
          <h1 style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.3rem,5vw,2rem)', fontWeight:900, color:'#5B21B6', lineHeight:1.2 }}>
            {t('breathe.heading', lang)}
          </h1>
          <p style={{ fontSize:'clamp(0.85rem,2.5vw,1rem)', fontWeight:700, color:'#7C3AED', marginTop:4, opacity:0.85 }}>
            {t('breathe.subheading', lang)}
          </p>
        </div>

        {/* ── Centre: Eli + breathing circle ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'clamp(0.75rem,3vw,2rem)', flexWrap:'wrap', zIndex:1, width:'100%' }}>

          {/* Eli breathing */}
          <div style={{
            transition:`transform ${phase.dur}s ease-in-out`,
            transform: `scale(${phase.eliScale})`,
            flexShrink:0,
          }}>
            <Eli size={Math.min(110, typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.25) : 100)} mood="breathe" animated={false} />
          </div>

          {/* Breathing circle stack */}
          <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width:'clamp(180px,46vw,220px)', height:'clamp(180px,46vw,220px)', flexShrink:0 }}>

            {/* Ripple rings */}
            {phase.key === 'in' && ['ripple-1','ripple-2','ripple-3'].map(cls => (
              <div key={cls} className={cls} style={{
                position:'absolute',
                width:`${Math.min(circleSize,180)}px`, height:`${Math.min(circleSize,180)}px`,
                borderRadius:'50%',
                border:`3px solid ${phase.color}`,
                opacity:0.4,
              }} />
            ))}

            {/* Main circle */}
            <div style={{
              width: maxCircle, height: maxCircle,
              borderRadius:'50%',
              background:`radial-gradient(circle at 35% 35%, ${phase.key==='hold'?'#7C3AED':'#A78BFA'}, ${phase.color})`,
              boxShadow:`0 0 ${maxCircle*0.3}px rgba(139,92,246,0.4)`,
              transition:`width ${phase.dur}s ease-in-out, height ${phase.dur}s ease-in-out`,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              position:'relative', zIndex:2,
            }}>
              <span style={{ fontSize:'clamp(1.5rem,8vw,2.5rem)', lineHeight:1 }}>
                {phase.tip}
              </span>
              <span style={{
                marginTop:6,
                fontSize:'clamp(0.72rem,2.2vw,0.88rem)',
                fontWeight:800,
                letterSpacing:'0.04em',
                textTransform:'uppercase',
                color:'rgba(255,255,255,0.95)',
              }}>
                {phase.cue}
              </span>
              <span style={{
                fontFamily:"'Baloo 2',cursive",
                fontSize:'clamp(2rem,10vw,3rem)', fontWeight:900,
                color:'white', lineHeight:1, marginTop:4,
                textShadow:'0 2px 8px rgba(0,0,0,0.2)',
              }}>
                {countdown}
              </span>
            </div>
          </div>
        </div>

        {/* ── Phase label ── */}
        <div style={{ textAlign:'center', zIndex:1 }}>
          <p style={{
            fontFamily:"'Baloo 2',cursive",
            fontSize:'clamp(1.6rem,6vw,2.2rem)', fontWeight:900,
            color:'#5B21B6', transition:'color 0.5s',
            animation:'phase-pulse 2s ease-in-out infinite',
          }}>
            {t(phase.labelKey, lang)}
          </p>
        </div>

        {/* ── Bottom: dots + messages ── */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem', zIndex:1 }}>
          <CycleDots completed={cycles} total={TOTAL_CYCLES} />
          <p style={{ fontSize:'clamp(0.82rem,2.5vw,0.95rem)', fontWeight:700, color:'#5B21B6', opacity:0.8, textAlign:'center' }}>
            {cycles < TOTAL_CYCLES
              ? t('breathe.rounds_left', lang, TOTAL_CYCLES - cycles)
              : '✓ Almost done!'}
          </p>
          <p style={{
            fontSize:'clamp(0.9rem,2.8vw,1.05rem)', fontWeight:800, color:'#6D28D9',
            background:'rgba(255,255,255,0.6)', backdropFilter:'blur(8px)',
            borderRadius:'99px', padding:'6px 18px',
          }}>
          </p>
        </div>

      </div>
    </>
  )
}
