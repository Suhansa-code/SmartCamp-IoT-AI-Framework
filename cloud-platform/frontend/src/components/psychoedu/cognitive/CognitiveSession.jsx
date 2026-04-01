'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import { SUBJECT_COLORS, TASK_TYPE_LABELS } from '@/components/psychoedu/lib/sessions'
import TaskRenderer  from './TaskRenderer'
import Eli           from '@/components/psychoedu/child/Eli'

//  Confetti burst 
const CONFETTI_COLORS = ['#FF6B35','#FFD93D','#FF6B9D','#A855F7','#0D9488','#4ADE80','#60A5FA']
function ConfettiSystem({ active }) {
  if (!active) return null
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:100, overflow:'hidden' }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position:'absolute',
          top:'-20px',
          left:`${(i / 20) * 100 + (Math.random() * 8 - 4)}%`,
          width: 8 + Math.random() * 8,
          height: 8 + Math.random() * 6,
          borderRadius: i % 3 === 0 ? '50%' : '2px',
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animation:`confetti-fall ${1.0 + Math.random() * 0.8}s ease-out ${Math.random() * 0.3}s forwards`,
        }} />
      ))}
      <style>{`@keyframes confetti-fall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  )
}

// Star earned animation 
function StarEarned({ count }) {
  return (
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{
          fontSize:22, animation:`star-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i*0.1}s both`,
          display:'inline-block',
        }}>⭐</span>
      ))}
      <style>{`@keyframes star-pop{0%{transform:scale(0) rotate(-30deg);opacity:0}70%{transform:scale(1.3) rotate(10deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
    </div>
  )
}

// Progress trail (adventure map dots) 
function ProgressTrail({ current, total, results }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center', flexWrap:'nowrap', overflow:'hidden' }}>
      {Array.from({ length: total }).map((_, i) => {
        const done    = i < current
        const active  = i === current
        const correct = results[i]?.correct
        return (
          <div key={i} style={{ display:'flex', alignItems:'center' }}>
            <div style={{
              width:  active ? 'clamp(28px,7vw,34px)' : 'clamp(18px,4.5vw,22px)',
              height: active ? 'clamp(28px,7vw,34px)' : 'clamp(18px,4.5vw,22px)',
              borderRadius:'50%',
              background: done
                ? correct ? 'linear-gradient(135deg,#4ADE80,#22C55E)' : 'linear-gradient(135deg,#F87171,#EF4444)'
                : active
                  ? 'linear-gradient(135deg,#FFD93D,#FF6B35)'
                  : 'rgba(255,255,255,0.3)',
              border:`2px solid ${active ? '#FF6B35' : done ? (correct?'#22C55E':'#EF4444') : 'rgba(255,255,255,0.4)'}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize: active ? 14 : 10,
              transition:'all 0.3s cubic-bezier(0.34,1.4,0.64,1)',
              boxShadow: active ? '0 0 12px rgba(255,107,53,0.5)' : 'none',
              flexShrink:0,
            }}>
              {done ? (correct ? '✓' : '✕') : active ? '▶' : ''}
            </div>
            {i < total - 1 && (
              <div style={{
                width:'clamp(6px,1.5vw,10px)', height:2,
                background: done ? (correct?'#22C55E':'#EF4444') : 'rgba(255,255,255,0.25)',
                transition:'background 0.3s',
                flexShrink:0,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Eli cheer bubble
const CHEER_MSGS = [
  { si:'ඉතා හොඳයි! 🎉',     ta:'மிகவும் நன்று! 🎉',       en:'Amazing! 🎉' },
  { si:'ඔයා ගොඩක් දක්ෂයි! ⭐',         ta:'நட்சத்திரம்! ⭐',          en:"You're a star! ⭐" },
  { si:'දිගටම යමු! 💪',       ta:'தொடர்வோம்! 💪',            en:'Keep going! 💪' },
  { si:'ඔයා දිනනවා! 🏆',      ta:'நீ வெல்கிறாய்! 🏆',       en:"You're winning! 🏆" },
  { si:'එලී ට ගොඩාක් සතුටුයි!', ta:'Eli மகிழ்ச்சியாக உள்ளன்!', en:'Eli is so proud!' },
]
const TRY_AGAIN_MSGS = [
  { si:'එලී ළඟ ඉන්නවා! 🐘',  ta:'Eli உடன் இருக்கிறேன்! 🐘',  en:'Eli is with you! 🐘' },
]

function EliCheerBubble({ correct, lang }) {
  const msgs = correct ? CHEER_MSGS : TRY_AGAIN_MSGS
  const msg  = msgs[Math.floor(Math.random() * msgs.length)]
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'0.75rem',
      background:'rgba(255,255,255,0.9)', backdropFilter:'blur(12px)',
      borderRadius:'1.25rem 1.25rem 1.25rem 0.5rem',
      padding:'0.85rem 1.25rem',
      boxShadow:`0 6px 24px rgba(${correct?'13,148,136':'168,85,247'},0.2)`,
      border:`3px solid ${correct?'rgba(74,222,128,0.4)':'rgba(167,139,250,0.4)'}`,
      animation:'fade-up 0.4s ease both',
      maxWidth:'min(340px,88vw)',
    }}>
      <Eli size={52} mood={correct?'excited':'wave'} animated={false} />
      <div>
        <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.05rem,3.5vw,1.3rem)', fontWeight:900, color:'#1E3A5F', lineHeight:1.2 }}>
          {msg[lang] ?? msg['en']}
        </p>
        <div style={{ display:'flex', gap:4, marginTop:4 }}>
          {Array.from({ length: correct?3:1 }).map((_,i)=><span key={i} style={{fontSize:14}}>{'⭐'}</span>)}
        </div>
      </div>
      <style>{`@keyframes fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

// Subject header colours 
const SUBJECT_GRADIENTS = {
  mathematics: 'linear-gradient(135deg,#0D9488,#14B8A6)',
  sinhala:     'linear-gradient(135deg,#FF6B35,#FFB347)',
  english:     'linear-gradient(135deg,#3B82F6,#60A5FA)',
  tamil:       'linear-gradient(135deg,#A855F7,#C084FC)',
  evs:         'linear-gradient(135deg,#22C55E,#4ADE80)',
}

//Done screen 
function DoneScreen({ score, total, results, lang, onDone }) {
  const pct = score / total
  const grade = pct >= 0.8 ? { label:{ si:'🏆 ඔයා අද ගොඩක් හොඳයි!', ta:'🏆 சிறந்த வெற்றியாளர்!', en:'🏆 Outstanding champion!' }, color:'#FFD93D' }
    : pct >= 0.6 ? { label:{ si:'⭐ ඉතා හොඳයි!', ta:'⭐ மிகவும் நல்லது!', en:'⭐ Really great!' }, color:'#0D9488' }
    : { label:{ si:'💙 හොඳ උත්සාහයක්!', ta:'💙 நல்ல முயற்சி!', en:'💙 Good effort!' }, color:'#A855F7' }

  return (
    <div style={{
      minHeight:'100svh', position:'relative', overflow:'hidden',
      background:'linear-gradient(160deg,#FFF9E6 0%,#FEF3C7 40%,#FDE68A 100%)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:'clamp(1rem,3vw,1.5rem)', padding:'2rem', textAlign:'center',
    }}>
      {/* Star background decoration */}
      {['10%','30%','60%','80%','50%'].map((l,i) => (
        <span key={i} style={{ position:'absolute', top:`${10+i*15}%`, left:l, fontSize:`${20+i*6}px`, animation:`twinkle-${(i%3)+1} ${2+i*0.4}s ease-in-out infinite`, opacity:0.6, pointerEvents:'none' }}>⭐</span>
      ))}

      <div className="eli-wiggle"><Eli size={150} mood="star" /></div>

      <div style={{
        background:'rgba(255,255,255,0.9)', backdropFilter:'blur(12px)',
        borderRadius:'2rem', padding:'1.5rem clamp(1.5rem,5vw,2.5rem)',
        maxWidth:'min(380px,90vw)', width:'100%',
        boxShadow:'0 12px 48px rgba(255,107,53,0.15)',
        border:'3px solid rgba(255,255,255,0.9)',
      }}>
        <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.3rem,5vw,1.75rem)', fontWeight:900, color:grade.color }}>
          {grade.label[lang] ?? grade.label['en']}
        </p>
        {/* Big score */}
        <div style={{ display:'flex', justifyContent:'center', alignItems:'baseline', gap:8, margin:'1rem 0' }}>
          <span style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(3rem,12vw,4.5rem)', fontWeight:900, color:'#1E3A5F', lineHeight:1 }}>{score}</span>
          <span style={{ fontSize:'clamp(1rem,3vw,1.3rem)', fontWeight:700, color:'#0D9488' }}>/ {total}</span>
        </div>
        {/* Task result bubbles */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center' }}>
          {results.map((r,i) => (
            <div key={i} style={{
              width:30, height:30, borderRadius:'50%',
              background: r.correct ? 'linear-gradient(135deg,#4ADE80,#22C55E)' : 'linear-gradient(135deg,#F87171,#EF4444)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:14, fontWeight:900, color:'white',
              boxShadow: r.correct ? '0 2px 8px rgba(74,222,128,0.4)' : '0 2px 8px rgba(248,113,113,0.3)',
              animation:`star-pop 0.3s cubic-bezier(0.34,1.56,0.64,1) ${i*0.05}s both`,
            }}>
              {r.correct ? '✓' : '✕'}
            </div>
          ))}
        </div>
      </div>

      <button onClick={onDone} className="btn-press" style={{
        width:'100%', maxWidth:'min(380px,90vw)', minHeight:'clamp(64px,14vw,76px)',
        background:'linear-gradient(135deg,#FF6B35,#FF8C42)',
        color:'white', borderRadius:'99px', border:'none',
        fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.1rem,4vw,1.4rem)', fontWeight:900,
        cursor:'pointer', boxShadow:'0 8px 32px rgba(255,107,53,0.3)',
      }}>
        🐘 {lang==='si'?'ස්තුතියි නැවත එන්න!':lang==='ta'?'நன்றி, மீண்டும் வாருங்கள்.!':'Thank you, come back.!'}
      </button>
    </div>
  )
}

// Main component
export default function CognitiveSession({ session, onComplete }) {
  const { lang } = useLang()
  const [taskIdx,     setTaskIdx]     = useState(0)
  const [phase,       setPhase]       = useState('task')  // task|cheer|done
  const [results,     setResults]     = useState([])
  const [score,       setScore]       = useState(0)
  const [lastCorrect, setLastCorrect] = useState(null)
  const [confetti,    setConfetti]    = useState(false)
  const [eliCheer,    setEliCheer]    = useState(false)

  const tasks = session.tasks
  const task  = tasks[taskIdx]
  const total = tasks.length

  function handleAnswer(answerPayload) {
    const isCorrect = typeof answerPayload === 'object'
      ? !!answerPayload.isCorrect
      : !!answerPayload
    const selectedAnswer = typeof answerPayload === 'object'
      ? answerPayload.selectedAnswer ?? null
      : null

    const newScore = isCorrect ? score + 1 : score
    setScore(newScore)
    setLastCorrect(isCorrect)
    setResults(r => [...r, { taskId: task.id, subject: task.subject, correct: isCorrect, selectedAnswer }])

    if (isCorrect) {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 1500)
    }
    setEliCheer(true)
    setTimeout(() => {
      setEliCheer(false)
      if (taskIdx + 1 >= total) setPhase('done')
      else { setPhase('cheer') }
    }, 1200)
  }

  function goNext() {
    setTaskIdx(i => i + 1)
    setPhase('task')
    setLastCorrect(null)
  }

  if (phase === 'done') {
    return <DoneScreen score={score} total={total} results={results} lang={lang} onDone={() => onComplete?.({ score, total, results })} />
  }

  const subjStyle  = SUBJECT_COLORS[task?.subject] ?? SUBJECT_COLORS.mathematics
  const subjGrad   = SUBJECT_GRADIENTS[task?.subject] ?? SUBJECT_GRADIENTS.mathematics
  const typeLabel  = task ? (TASK_TYPE_LABELS[task.type]?.[lang] ?? TASK_TYPE_LABELS[task.type]?.en) : ''

  // Cheer screen
  if (phase === 'cheer') {
    return (
      <div style={{
        minHeight:'100svh',
        background: lastCorrect
          ? 'linear-gradient(160deg,#ECFDF5 0%,#D1FAE5 100%)'
          : 'linear-gradient(160deg,#F5F3FF 0%,#EDE9FE 100%)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:'1.5rem', padding:'2rem', textAlign:'center',
      }}>
        {lastCorrect && <ConfettiSystem active />}
        <div className={lastCorrect ? 'eli-wiggle' : 'eli-float'}>
          <Eli size={140} mood={lastCorrect ? 'excited' : 'happy'} animated={false} />
        </div>
        <EliCheerBubble correct={lastCorrect} lang={lang} />
        <ProgressTrail current={taskIdx + 1} total={total} results={results} />
        {lastCorrect && <StarEarned count={1} />}
        <button onClick={goNext} className="btn-press" style={{
          minHeight:'clamp(62px,13vw,74px)', padding:'0 clamp(2rem,6vw,3rem)',
          background:'linear-gradient(135deg,#0D9488,#14B8A6)',
          color:'white', borderRadius:'99px', border:'none',
          fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.05rem,4vw,1.3rem)', fontWeight:900,
          cursor:'pointer', boxShadow:'0 6px 24px rgba(13,148,136,0.3)',
        }}>
          {lang==='si'?'➡️ ඊළඟ ප්‍රශ්නය':lang==='ta'?'➡️ அடுத்த கேள்வி':'➡️ Next question'}
        </button>
      </div>
    )
  }

  // Task screen 
  return (
    <div style={{
      minHeight:'100svh', background:'linear-gradient(160deg,#F0F9FF 0%,#E0F7FF 100%)',
      display:'flex', flexDirection:'column', boxSizing:'border-box',
      position:'relative', overflow:'hidden',
    }}>
      <ConfettiSystem active={confetti} />

      {/* ── Gradient header bar ── */}
      <div style={{
        background: subjGrad,
        padding:'clamp(0.6rem,2vw,0.85rem) clamp(0.85rem,3vw,1.25rem)',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0,
        boxShadow:'0 4px 20px rgba(0,0,0,0.1)',
      }}>
        {/* Subject + emoji */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'clamp(1.2rem,4vw,1.5rem)' }}>{task.emoji}</span>
          <span style={{ fontFamily:"'Baloo 2',cursive", fontWeight:900, fontSize:'clamp(0.82rem,2.5vw,1rem)', color:'white', textTransform:'uppercase', letterSpacing:'0.08em' }}>
            {task.subject}
          </span>
        </div>
        {/* Score badge */}
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.25)', borderRadius:'99px', padding:'4px 12px' }}>
          <span style={{ fontSize:14 }}>⭐</span>
          <span style={{ fontFamily:"'Baloo 2',cursive", fontWeight:900, color:'white', fontSize:'clamp(0.9rem,3vw,1.1rem)' }}>{score}</span>
        </div>
        {/* Counter */}
        <span style={{ fontFamily:"'Baloo 2',cursive", fontWeight:800, color:'rgba(255,255,255,0.9)', fontSize:'clamp(0.82rem,2.5vw,1rem)' }}>
          {taskIdx+1}/{total}
        </span>
      </div>

      {/* Progress trail */}
      <div style={{ padding:'0.5rem 1rem', flexShrink:0 }}>
        <ProgressTrail current={taskIdx} total={total} results={results} />
      </div>

      {/* Eli mini + task type label */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 clamp(0.85rem,3vw,1.25rem) 0.25rem', flexShrink:0 }}>
        <Eli size={32} mood="happy" animated={false} />
        <span style={{ fontSize:'clamp(0.78rem,2.5vw,0.9rem)', fontWeight:700, color:'#1E3A5F', opacity:0.7, fontFamily:"'Nunito',sans-serif" }}>
          {typeLabel}
        </span>
        {eliCheer && <span style={{ fontSize:18, animation:'star-pop 0.3s ease both' }}>✨</span>}
      </div>

      {/* Task content */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 clamp(0.75rem,3vw,1.25rem) clamp(0.75rem,2vw,1rem)' }}>
        <TaskRenderer task={task} lang={lang} onAnswer={handleAnswer} />
      </div>
    </div>
  )
}
