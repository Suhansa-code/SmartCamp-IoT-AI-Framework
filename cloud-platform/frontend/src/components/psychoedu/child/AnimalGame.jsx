'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLang }  from '@/components/psychoedu/context/LanguageContext'
import { t }        from '@/components/psychoedu/lib/translations'

// Animals
const TARGET_DEFS = [
  { id: 'elephant',  emoji: '🐘', file: 'elephant.svg'   },
  { id: 'rabbit',    emoji: '🐰', file: 'rabbit.svg'     },
  { id: 'butterfly', emoji: '🦋', file: 'butterfly.svg'  },
  { id: 'bird',      emoji: '🐦', file: 'bird.svg'       },
  { id: 'fish',      emoji: '🐟', file: 'fish.svg'       },
  { id: 'cat',       emoji: '🐱', file: 'cat.svg'        },
  { id: 'duck',      emoji: '🦆', file: 'duck.svg'       },
]
const DISTRACTOR_DEFS = [
  { id: 'snake',  emoji: '🐍', file: 'snake.svg'  },
  { id: 'spider', emoji: '🕷️', file: 'spider.svg' },
  { id: 'crab',   emoji: '🦀', file: 'crab.svg'   },
]

// Config 
const TOTAL_TRIALS  = 45
const TARGET_RATIO  = 0.70
const SHOW_MS       = 1500  
const BLANK_MS      = 500   
const TASK_DURATION = 90
const COUNTDOWN_SECONDS = 10
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// Math helpers
const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
const variance = arr => {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length
}
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function buildTrials() {
  const nT = Math.round(TOTAL_TRIALS * TARGET_RATIO)
  const nD = TOTAL_TRIALS - nT
  const targets     = Array.from({ length: nT }, () => ({ ...TARGET_DEFS[Math.floor(Math.random() * TARGET_DEFS.length)],     type: 'target'     }))
  const distractors = Array.from({ length: nD }, () => ({ ...DISTRACTOR_DEFS[Math.floor(Math.random() * DISTRACTOR_DEFS.length)], type: 'distractor' }))
  return shuffle([...targets, ...distractors])
}

// Countdown screen
function CountdownScreen({ count, lang, total, onStart }) {
  const isEnglish = lang === 'en'

  return (
    <div style={{
      minHeight:'100svh', background:'#F0F9FF',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:'clamp(1.5rem,4vw,2.5rem)', padding:'clamp(1rem,4vw,1.5rem)',
      boxSizing:'border-box',
    }}>
      {/* Instruction card */}
      <div style={{
        background:'white', borderRadius:'clamp(1.25rem,4vw,2rem)',
        padding:'clamp(1.25rem,4vw,2rem)',
        maxWidth:'min(360px,88vw)', width:'100%',
        textAlign:'center', boxShadow:'0 6px 32px rgba(13,148,136,0.1)',
      }}>
        <div style={{ display:'flex', justifyContent:'center', gap:'1rem', fontSize:'clamp(2.2rem,8vw,3rem)', marginBottom:'0.75rem' }}>
          <span>🐘</span><span>🐍</span>
        </div>
        <p style={{ fontFamily:"'Baloo 2',cursive", fontSize: isEnglish ? 'clamp(1.2rem,4.3vw,1.65rem)' : 'clamp(1.1rem,4vw,1.5rem)', fontWeight:900, color:'#1E3A5F', lineHeight:1.3 }}>
          {t('game.countdown_instruction', lang)}
        </p>
        <p style={{ fontSize: isEnglish ? 'clamp(0.9rem,2.7vw,1.05rem)' : 'clamp(0.8rem,2.5vw,0.95rem)', fontWeight:600, color:'#64748B', marginTop:'6px', lineHeight:1.3 }}>
          {t('game.no_tap_instruction', lang)}
        </p>
      </div>

      {/* Start Game Button - child friendly */}
      <button
        onClick={onStart}
        style={{
          background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'clamp(1.25rem,4vw,2rem)',
          padding: 'clamp(1rem,3vw,1.25rem) clamp(1.5rem,6vw,2.5rem)',
          fontSize: 'clamp(1.1rem,4vw,1.6rem)',
          fontWeight: 900,
          fontFamily: "'Baloo 2', cursive",
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(13, 148, 136, 0.3)',
          transition: 'all 0.2s ease',
          minWidth: '180px',
          maxWidth: 'min(300px,85vw)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.96)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(13, 148, 136, 0.2)'
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(13, 148, 136, 0.3)'
        }}
        onTouchStart={(e) => {
          e.currentTarget.style.transform = 'scale(0.96)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(13, 148, 136, 0.2)'
        }}
        onTouchEnd={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(13, 148, 136, 0.3)'
        }}
      >
        <span>🎮</span>
        <span>{t('game.start_btn', lang)}</span>
      </button>
    </div>
  )
}

// Done screen 
function DoneScreen({ lang }) {
  return (
    <div style={{ minHeight:'100svh', background:'#F0F9FF', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1.25rem', padding:'2rem', textAlign:'center' }}>
      <span style={{ fontSize:'clamp(4rem,15vw,6rem)', animation:'starPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>⭐</span>
      <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.8rem,7vw,2.5rem)', fontWeight:900, color:'#1E3A5F' }}>
        {t('game.done_heading', lang)}
      </p>
      <p style={{ fontSize:'clamp(1rem,4vw,1.4rem)', fontWeight:700, color:'#0D9488' }}>
        {t('game.done_sub', lang)}
      </p>
      <div style={{ width:44, height:44, borderRadius:'50%', border:'5px solid #0D9488', borderTopColor:'transparent', animation:'spin 0.75s linear infinite' }} />
    </div>
  )
}

// Main component
export default function AnimalGame({ onComplete }) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const { lang }     = useLang()
  const isEnglish = lang === 'en'

  const sessionId = searchParams?.get('session') ?? 'offline'
  const childId = searchParams?.get('child') ?? ''
  const attempt = Number(searchParams?.get('attempt') ?? '1')

  const trialsRef = useRef(null)
  if (!trialsRef.current) trialsRef.current = buildTrials()
  const trials = trialsRef.current

  const [phase,    setPhase]    = useState('countdown')
  const [cdCount,  setCdCount]  = useState(COUNTDOWN_SECONDS)
  const [trialIdx, setTrialIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TASK_DURATION)
  const [feedback, setFeedback] = useState(null)
  const [imgError, setImgError] = useState(false)

  const correctTaps   = useRef(0)
  const falseTaps     = useRef(0)
  const missedTargets = useRef(0)
  const reactionTimes = useRef([])
  const shownAt       = useRef(0)
  const tapped        = useRef(false)
  const timerRef      = useRef(null)
  const timerEndRef   = useRef(null)
  const trialTimer    = useRef(null)
  const missingImageFiles = useRef(new Set())

  const trial = trials[trialIdx]

  // Start game handler
  function startGame() {
    setPhase('show')
    shownAt.current = Date.now()
    tapped.current = false
  }

  // 90-s timer (wall-clock based to avoid interval drift)
  useEffect(() => {
    if (phase === 'countdown' || phase === 'done') return

    if (!timerEndRef.current) {
      timerEndRef.current = Date.now() + TASK_DURATION * 1000
    }

    const tick = () => {
      const remainingMs = timerEndRef.current - Date.now()
      const next = Math.max(0, Math.ceil(remainingMs / 1000))
      setTimeLeft(prev => (prev === next ? prev : next))
      if (next === 0) clearInterval(timerRef.current)
    }

    tick()
    timerRef.current = setInterval(tick, 200)
    return () => clearInterval(timerRef.current)
  }, [phase])

  useEffect(() => { if (timeLeft === 0 && phase !== 'done' && phase !== 'countdown') endGame() }, [timeLeft])

  // Show phase
  useEffect(() => {
    if (phase !== 'show') return
    setImgError(trial ? missingImageFiles.current.has(trial.file) : false)
    tapped.current  = false
    shownAt.current = Date.now()
    trialTimer.current = setTimeout(() => {
      if (!tapped.current && trial.type === 'target') { missedTargets.current += 1; flash('miss') }
      setPhase('blank')
    }, SHOW_MS)
    return () => clearTimeout(trialTimer.current)
  }, [phase, trialIdx])

  // Blank phase
  useEffect(() => {
    if (phase !== 'blank') return
    trialTimer.current = setTimeout(() => {
      setFeedback(null)
      if (trialIdx + 1 >= trials.length || timeLeft === 0) endGame()
      else { setTrialIdx(i => i + 1); setPhase('show') }
    }, BLANK_MS)
    return () => clearTimeout(trialTimer.current)
  }, [phase, trialIdx, timeLeft])

  function handleTap() {
    if (phase !== 'show' || tapped.current) return
    tapped.current = true
    clearTimeout(trialTimer.current)
    const rt = Date.now() - shownAt.current
    if (trial.type === 'target') { correctTaps.current += 1; reactionTimes.current.push(rt); flash('correct') }
    else { falseTaps.current += 1; flash('false') }
    setPhase('blank')
  }

  function flash(type) { setFeedback(type); setTimeout(() => setFeedback(null), 380) }

  async function endGame() {
    clearInterval(timerRef.current); clearTimeout(trialTimer.current)
    setPhase('done')
    const totalTargets     = trials.filter(tr => tr.type === 'target').length
    const totalDistractors = trials.filter(tr => tr.type === 'distractor').length
    const rts              = reactionTimes.current
    const metrics = {
      correctTaps: correctTaps.current,
      falseTaps: falseTaps.current,
      missedTargets: missedTargets.current,
      reactionTimes: [...rts],
      accuracyRate:           totalTargets     > 0 ? correctTaps.current / totalTargets     : 0,
      falseTapRate:           totalDistractors > 0 ? falseTaps.current   / totalDistractors : 0,
      avgReactionTime:        Math.round(mean(rts)),
      reactionTimeVariance:   Math.round(variance(rts)),
    }
    const payload = {
      session_id: sessionId,
      child_id: childId,
      lang,
      taskMetrics: {
        accuracyRate: metrics.accuracyRate,
        falseTapRate: metrics.falseTapRate,
        avgReactionTime: metrics.avgReactionTime,
        reactionVariance: metrics.reactionTimeVariance,
      },
      passiveSignals: {
        idleTimeRatio: 0,
        rapidClickCount: 0,
        timeToFirstMs: rts[0] || 0,
        completionRatio: metrics.accuracyRate,
      }
    }
    const gatePath = attempt >= 2 ? '/api/session/second-gate' : '/api/session/task-complete'
    let gateDecision = null

    try {
      const res = await fetch(`${API_BASE}${gatePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.gate_decision) gateDecision = data.gate_decision
    } catch (_) {}

    if (onComplete) {
      onComplete(metrics)
    } else {
      const langParam = `lang=${encodeURIComponent(lang)}`
      const baseParams = `session=${encodeURIComponent(sessionId)}&child=${encodeURIComponent(childId)}&attempt=${attempt}&${langParam}`

      if (gateDecision === 'PASS' || gateDecision === 'PASS_RECOVERED') {
        setTimeout(() =>
          router.push(`/child/cognitive?${baseParams}`),
        1600)
      } else if (gateDecision === 'FAIL_CONFIRMED') {
        setTimeout(() =>
          router.push(`/child/play?${baseParams}`),
        1600)
      } else if (gateDecision === 'FAIL_FIRST') {
        setTimeout(() =>
          router.push(`/child/calming?${baseParams}`),
        1600)
      } else {
        // Fallback if backend is unavailable: preserve previous UX behavior.
        const isGate1Pass = metrics.accuracyRate >= 0.5 && metrics.falseTapRate <= 0.6
        if (isGate1Pass) {
          setTimeout(() =>
            router.push(`/child/cognitive?${baseParams}`),
          1600)
          return
        }
        if (attempt >= 2) {
          setTimeout(() =>
            router.push(`/child/play?${baseParams}`),
          1600)
          return
        }
        setTimeout(() =>
          router.push(`/child/calming?${baseParams}`),
        1600)
      }
    }
  }

  const progressPct = ((TASK_DURATION - timeLeft) / TASK_DURATION) * 100
  const FB = {
    correct: { border:'#22C55E', bg:'rgba(34,197,94,0.09)',  shadow:'0 0 40px rgba(34,197,94,0.35)',  icon:'✅' },
    false:   { border:'#EF4444', bg:'rgba(239,68,68,0.09)',  shadow:'0 0 40px rgba(239,68,68,0.35)',  icon:'🛑' },
    miss:    { border:'#F97316', bg:'rgba(249,115,22,0.09)', shadow:'0 0 40px rgba(249,115,22,0.3)',  icon:'⏭️' },
  }
  const fb = feedback ? FB[feedback] : null

  if (phase === 'countdown') return <CountdownScreen count={cdCount} lang={lang} total={COUNTDOWN_SECONDS} onStart={startGame} />
  if (phase === 'done')      return <DoneScreen lang={lang} />

  // Animal name in chosen language
  const animalName = trial ? t(`animal.${trial.id}`, lang) : ''

  return (
    <>
      <style>{`
        @keyframes starPop { 0%{transform:scale(0) rotate(-20deg);opacity:0} 70%{transform:scale(1.25) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      <main
        onPointerDown={handleTap}
        style={{
          minHeight:'100svh', background:'#F0F9FF',
          display:'flex', flexDirection:'column', alignItems:'center',
          userSelect:'none', WebkitUserSelect:'none',
          cursor: phase === 'show' ? 'pointer' : 'default',
          overflow:'hidden', boxSizing:'border-box',
        }}
      >
        {/* Progress bar */}
        <div style={{ width:'100%', height:10, background:'#E2E8F0', flexShrink:0 }}>
          <div style={{ height:'100%', width:`${progressPct}%`, background:'#0D9488', borderRadius:'0 4px 4px 0', transition:'width 1s linear' }} />
        </div>

        {/* Timer + counter */}
        <div style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'clamp(0.5rem,2vw,0.75rem) clamp(1rem,3vw,1.25rem)', flexShrink:0 }}>
          <span style={{ background: timeLeft <= 10 ? '#FEE2E2' : '#CCFBF1', color: timeLeft <= 10 ? '#DC2626' : '#0D9488', borderRadius:'9999px', padding:'4px 14px', fontFamily:"'Baloo 2',cursive", fontWeight:800, fontSize:'clamp(0.85rem,3vw,1.05rem)' }}>
            ⏱ {timeLeft}s
          </span>
          <span style={{ background:'white', border:'2px solid #E2E8F0', borderRadius:'9999px', padding:'4px 14px', fontWeight:700, fontSize:'clamp(0.78rem,2.5vw,0.9rem)', color:'#1E3A5F' }}>
            {trialIdx + 1} / {trials.length}
          </span>
        </div>

        {/* Instruction strip */}
        <div style={{ padding:'0 clamp(0.75rem,3vw,1rem) 0.5rem', width:'100%', maxWidth:'min(400px,94vw)', margin:'0 auto', flexShrink:0 }}>
          <div style={{ background:'white', borderRadius:'clamp(0.75rem,3vw,1.25rem)', padding:'clamp(0.5rem,2vw,0.6rem) clamp(0.75rem,3vw,1.25rem)', textAlign:'center', border:'2px solid #E2E8F0' }}>
            <p style={{ fontFamily:"'Baloo 2',cursive", fontSize: isEnglish ? 'clamp(1.2rem,4.2vw,1.55rem)' : 'clamp(0.9rem,3vw,1.1rem)', fontWeight:800, color:'#1E3A5F', lineHeight:1.3 }}>
              {t('game.instruction_main', lang)}
            </p>
            <p style={{ fontSize: isEnglish ? 'clamp(0.95rem,2.9vw,1.15rem)' : 'clamp(0.72rem,2vw,0.82rem)', fontWeight:600, color:'#0D9488', marginTop:2, lineHeight:1.3 }}>
              {t('game.instruction_sub', lang)}
            </p>
          </div>
        </div>

        {/* Animal tap card */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', padding:'0 clamp(0.75rem,3vw,1.5rem)', gap:'clamp(0.75rem,2.5vw,1.25rem)' }}>
          <div style={{
            width: 'min(300px, 72vw)',
            height: 'min(300px, 72vw)',
            borderRadius: 'clamp(1.5rem,5vw,2.5rem)',
            background: fb ? fb.bg : 'white',
            border: `6px solid ${fb ? fb.border : phase === 'blank' ? '#E2E8F0' : '#0D9488'}`,
            boxShadow: fb ? fb.shadow : '0 8px 40px rgba(13,148,136,0.1)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            position:'relative',
            transition:'border-color 0.12s, box-shadow 0.12s, transform 0.1s',
            transform: feedback === 'correct' ? 'scale(0.97)' : 'scale(1)',
            overflow:'hidden',
            touchAction: 'none',
          }}>
            {phase === 'show' && trial && !feedback && (
              <>
                {imgError ? (
                  <span style={{ fontSize:'clamp(5rem,18vw,9rem)', lineHeight:1 }}>{trial.emoji}</span>
                ) : (
                  <img
                    src={`/animals/${trial.file}`}
                    alt={animalName}
                    style={{ width:'min(260px,65vw)', height:'min(260px,65vw)', objectFit:'contain', display:'block', userSelect:'none', pointerEvents:'none' }}
                    onError={() => {
                      missingImageFiles.current.add(trial.file)
                      setImgError(true)
                    }}
                    draggable={false}
                  />
                )}
                {/* Animal name pill */}
                <div style={{ position:'absolute', bottom:10, background:'rgba(255,255,255,0.92)', borderRadius:'9999px', padding:'3px clamp(10px,3vw,14px)', backdropFilter:'blur(4px)' }}>
                  <span style={{ fontFamily:"'Baloo 2',cursive", fontWeight:800, fontSize:'clamp(0.85rem,3vw,1rem)', color:'#1E3A5F' }}>
                    {animalName}
                  </span>
                </div>
                {/* STOP badge */}
                {trial.type === 'distractor' && (
                  <div style={{ position:'absolute', top:10, right:10, background:'#DC2626', color:'white', borderRadius:'9999px', padding:'2px clamp(8px,2.5vw,12px)', fontWeight:800, fontSize:'clamp(0.7rem,2vw,0.78rem)' }}>
                    🛑 {t('game.stop_label', lang)}
                  </div>
                )}
              </>
            )}

            {/* Feedback overlay */}
            {feedback && (
              <span style={{ fontSize:'clamp(3rem,12vw,5.5rem)', animation:'starPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                {FB[feedback].icon}
              </span>
            )}

            {/* Blank */}
            {phase === 'blank' && !feedback && (
              <div style={{ width:60, height:60, borderRadius:'50%', background:'#E2E8F0' }} />
            )}
          </div>

          {/* Tap hint */}
          <div style={{
            background:'#0D9488', borderRadius:'9999px',
            padding:'clamp(0.65rem,2.5vw,0.85rem) clamp(1.5rem,5vw,2.5rem)',
            textAlign:'center',
            opacity: phase === 'blank' ? 0.3 : 1,
            transition:'opacity 0.2s',
          }}>
            <p style={{ fontWeight:800, fontSize: isEnglish ? 'clamp(1.24rem,4.6vw,1.65rem)' : 'clamp(1rem,3.5vw,1.2rem)', color:'white', fontFamily:"'Baloo 2',cursive", lineHeight:1.25 }}>
              {phase === 'show' && trial?.type === 'target'
                ? `👆 ${t('game.tap_now', lang)}`
                : `⏸ ${t('game.wait', lang)}`}
            </p>
          </div>
        </div>

        <div style={{ height:'clamp(12px,3vw,24px)' }} />
      </main>
    </>
  )
}
