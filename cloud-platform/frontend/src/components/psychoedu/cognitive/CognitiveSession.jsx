'use client'

import { useState } from 'react'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import { SUBJECT_COLORS, TASK_TYPE_LABELS } from '@/components/psychoedu/lib/sessions'
import TaskRenderer from './TaskRenderer'

// ── Eli mascot SVG (inline, no external dep) ──────────────────────────────────
function EliSmall({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" aria-hidden="true">
      <ellipse cx="80" cy="149" rx="38" ry="6"  fill="#0D9488" opacity="0.12" />
      <ellipse cx="80" cy="108" rx="34" ry="27" fill="#0D9488" />
      <circle  cx="80" cy="74"  r="29"          fill="#0D9488" />
      <ellipse cx="46"  cy="72" rx="13" ry="18" fill="#0A7670" />
      <ellipse cx="114" cy="72" rx="13" ry="18" fill="#0A7670" />
      <circle cx="68" cy="68" r="6"    fill="white" />
      <circle cx="92" cy="68" r="6"    fill="white" />
      <circle cx="70" cy="69" r="3.5"  fill="#1E3A5F" />
      <circle cx="94" cy="69" r="3.5"  fill="#1E3A5F" />
      <path d="M68 84 Q80 93 92 84" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M80 98 Q73 114 78 124" stroke="#0A7670" strokeWidth="8" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// ── Between-task encouragement messages (Eli speaks) ─────────────────────────
const ELI_MESSAGES = [
  { si: 'ඉතා හොඳයි! 🌟 ඊළඟ ප්‍රශ්නයට ලෑස්තිද?', ta: 'மிகவும் நன்று! 🌟 அடுத்த கேள்விக்கு தயாரா?',         en: 'Great job! 🌟 Ready for the next one?' },
  { si: 'ඔබ දක්ෂයි! ⭐ ඉදිරියට යමු!',              ta: 'நீ ஒரு நட்சத்திரம்! ⭐ முன்னேறலாம்!',              en: "You're a star! ⭐ Let's keep going!" },
  { si: 'බොහොම හොඳයි! 👏 ඊළඟ ප්‍රශ්නය!',           ta: 'மிகவும் நன்றாக! 👏 அடுத்த கேள்வி!',               en: 'Well done! 👏 Next question!' },
  { si: 'ඔබ දිනනවා! 💪 ඉදිරිය බලන්න!',         ta: 'நீ வெல்கிறாய்! 💪 முன்னே பார்!',                  en: "You're winning! 💪 Look ahead!" },
]

const FINAL_MESSAGES = {
  excellent: { si: '🏆 ඔබ දක්ෂයි!',          ta: '🏆 நீ மிகவும் சிறந்தவன்!',              en: '🏆 You are absolutely amazing!' },
  good:      { si: '⭐ ඉතා හොඳ ලකුණක්!',               ta: '⭐ மிகவும் நல்ல மதிப்பெண்கள்!',         en: '⭐ Really great score!' },
  ok:        { si: '😊 ඔබ ගොඩාක් හොඳට කළා!',         ta: '😊 நீ நன்றாக செய்தாய்!',                en: '😊 You did really well!' },
}

export default function CognitiveSession({ session, onComplete }) {
  const { lang } = useLang()

  const [taskIdx,   setTaskIdx]   = useState(0)
  const [phase,     setPhase]     = useState('task')   // 'task' | 'between' | 'done'
  const [results,   setResults]   = useState([])
  const [lastCorrect, setLastCorrect] = useState(null)
  const [score,     setScore]     = useState(0)
  const [eliMsg,    setEliMsg]    = useState(0)

  const tasks = session.tasks
  const task  = tasks[taskIdx]
  const total = tasks.length

  // Called by TaskRenderer when child answers
  function handleAnswer(isCorrect) {
    const newScore = isCorrect ? score + 1 : score
    setScore(newScore)
    setLastCorrect(isCorrect)
    setResults(r => [...r, { taskId: task.id, subject: task.subject, correct: isCorrect }])

    if (taskIdx + 1 >= total) {
      // Last task — go to done
      setTimeout(() => setPhase('done'), 900)
    } else {
      // Show Eli encouragement between tasks
      setEliMsg(Math.floor(Math.random() * ELI_MESSAGES.length))
      setTimeout(() => setPhase('between'), 600)
    }
  }

  function handleNext() {
    setTaskIdx(i => i + 1)
    setPhase('task')
    setLastCorrect(null)
  }

  function handleDone() {
    onComplete?.({ score, total, results })
  }

  const subjectStyle = SUBJECT_COLORS[task?.subject] ?? SUBJECT_COLORS.mathematics
  const taskTypeLabel = task ? (TASK_TYPE_LABELS[task.type]?.[lang] ?? TASK_TYPE_LABELS[task.type]?.en) : ''

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const pct = score / total
    const finalMsg = pct >= 0.8 ? FINAL_MESSAGES.excellent : pct >= 0.6 ? FINAL_MESSAGES.good : FINAL_MESSAGES.ok

    return (
      <>
        <style>{`@keyframes popIn{0%{transform:scale(0) rotate(-15deg);opacity:0}70%{transform:scale(1.2) rotate(5deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
        <div style={{ minHeight:'100svh', background:'#F0F9FF', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'clamp(1rem,3vw,1.5rem)', padding:'2rem', textAlign:'center' }}>
          <span style={{ fontSize:'clamp(4rem,14vw,6rem)', animation:'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>🏆</span>

          <div style={{ background:'white', borderRadius:'1.5rem', padding:'clamp(1.5rem,5vw,2rem)', maxWidth:'min(380px,88vw)', width:'100%', boxShadow:'0 8px 32px rgba(13,148,136,0.1)' }}>
            <EliSmall size={64} />
            <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.4rem,5vw,1.8rem)', fontWeight:900, color:'#1E3A5F', marginTop:'0.75rem' }}>
              {finalMsg[lang]}
            </p>
            <div style={{ display:'flex', justifyContent:'center', alignItems:'baseline', gap:'0.5rem', margin:'1rem 0' }}>
              <span style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(2.5rem,9vw,3.5rem)', fontWeight:900, color:'#0D9488' }}>{score}</span>
              <span style={{ fontSize:'clamp(1rem,3vw,1.25rem)', fontWeight:700, color:'#1E3A5F', opacity:0.6 }}>/ {total}</span>
            </div>
            {/* Subject breakdown */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', justifyContent:'center', marginTop:'0.5rem' }}>
              {results.map((r, i) => (
                <div key={i} style={{ width:28, height:28, borderRadius:'50%', background: r.correct ? '#DCFCE7' : '#FEE2E2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px' }}>
                  {r.correct ? '✅' : '❌'}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleDone}
            style={{ width:'100%', maxWidth:'min(380px,88vw)', minHeight:'clamp(60px,13vw,72px)', background:'#F97316', color:'white', borderRadius:'9999px', border:'none', fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.1rem,4vw,1.4rem)', fontWeight:900, cursor:'pointer', boxShadow:'0 6px 24px rgba(249,115,22,0.25)' }}
          >
            {lang === 'si' ? 'අපි විවේකයක් ගනිමු. නැවත එන්න ... ' : lang === 'ta' ? 'சிறிது நேரம் ஓய்வெடுப்போம். திரும்பி வருவோம்...' : 'Let\'s take a break. Come back...'}
          </button>
        </div>
      </>
    )
  }

  // ── Between tasks — Eli encouragement ───────────────────────────────────────
  if (phase === 'between') {
    const msg = ELI_MESSAGES[eliMsg]
    return (
      <div style={{ minHeight:'100svh', background:'#F0F9FF', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1.5rem', padding:'2rem', textAlign:'center' }}>
        <div style={{ width:'clamp(80px,18vw,110px)', height:'clamp(80px,18vw,110px)', borderRadius:'50%', background:'linear-gradient(135deg,#CCFBF1,#BAE6FD)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 32px rgba(13,148,136,0.18)', animation:'bounce 0.6s ease' }}>
          <EliSmall size={Math.round(0.75 * 110)} />
        </div>
        <div style={{ background:'white', borderRadius:'1.5rem', padding:'1.25rem 1.5rem', maxWidth:'min(360px,86vw)', boxShadow:'0 4px 20px rgba(0,0,0,0.07)' }}>
          <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.2rem,4.5vw,1.6rem)', fontWeight:900, color:'#1E3A5F' }}>
            {msg[lang]}
          </p>
        </div>
        {/* Feedback indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <span style={{ fontSize:'1.5rem' }}>{lastCorrect ? '✅' : '💙'}</span>
          <span style={{ fontSize:'clamp(0.85rem,2.5vw,1rem)', fontWeight:600, color: lastCorrect ? '#166534' : '#0D9488' }}>
            {lastCorrect
              ? (lang === 'si' ? 'නිවැරදියි!' : lang === 'ta' ? 'சரியானது!' : 'Correct!')
              : (lang === 'si' ? 'ඊළඟ!' : lang === 'ta' ? 'அடுத்த முறை!' : 'Next time!')}
          </span>
        </div>
        {/* Progress dots */}
        <div style={{ display:'flex', gap:'6px' }}>
          {tasks.map((_, i) => (
            <div key={i} style={{ width:10, height:10, borderRadius:'50%', background: i < taskIdx + 1 ? '#0D9488' : '#E2E8F0', transition:'background 0.3s' }} />
          ))}
        </div>
        <button
          onClick={handleNext}
          style={{ minHeight:'clamp(56px,12vw,68px)', padding:'0 clamp(2rem,6vw,3rem)', background:'#0D9488', color:'white', borderRadius:'9999px', border:'none', fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1rem,3.5vw,1.25rem)', fontWeight:900, cursor:'pointer', boxShadow:'0 6px 24px rgba(13,148,136,0.25)' }}
        >
          {lang === 'si' ? '➡️ ඊළඟ ප්‍රශ්නය' : lang === 'ta' ? '➡️ அடுத்த கேள்வி' : '➡️ Next question'}
        </button>
        <style>{`@keyframes bounce{0%{transform:scale(0.8)}50%{transform:scale(1.1)}100%{transform:scale(1)}}`}</style>
      </div>
    )
  }

  // ── Task screen ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100svh', background:'#F0F9FF', display:'flex', flexDirection:'column', boxSizing:'border-box' }}>
      {/* Header bar */}
      <div style={{ background:'white', borderBottom:'2px solid #E2E8F0', padding:'clamp(0.5rem,2vw,0.75rem) clamp(1rem,3vw,1.25rem)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        {/* Subject badge */}
        <span style={{ background:subjectStyle.bg, color:subjectStyle.text, borderRadius:'9999px', padding:'4px clamp(10px,3vw,14px)', fontWeight:700, fontSize:'clamp(0.72rem,2vw,0.82rem)', whiteSpace:'nowrap' }}>
          {task.emoji} {task.subject.toUpperCase()}
        </span>
        {/* Progress */}
        <span style={{ fontFamily:"'Baloo 2',cursive", fontWeight:800, fontSize:'clamp(0.85rem,2.5vw,1rem)', color:'#1E3A5F' }}>
          {taskIdx + 1} / {total}
        </span>
        {/* Score */}
        <span style={{ background:'#CCFBF1', color:'#0D9488', borderRadius:'9999px', padding:'4px clamp(10px,3vw,14px)', fontWeight:800, fontSize:'clamp(0.72rem,2vw,0.82rem)' }}>
          ⭐ {score}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ width:'100%', height:6, background:'#E2E8F0', flexShrink:0 }}>
        <div style={{ height:'100%', width:`${((taskIdx) / total) * 100}%`, background:'#0D9488', transition:'width 0.4s' }} />
      </div>

      {/* Eli + task type strip */}
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'clamp(0.5rem,2vw,0.75rem) clamp(1rem,3vw,1.25rem)', flexShrink:0 }}>
        <EliSmall size={96} />
        <span style={{ fontSize:'clamp(0.82rem,2.5vw,0.95rem)', fontWeight:700, color:'#1E3A5F', opacity:0.75 }}>
          {taskTypeLabel}
        </span>
      </div>

      {/* Task content */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 clamp(0.75rem,3vw,1.25rem) clamp(1rem,3vw,1.5rem)' }}>
        <TaskRenderer task={task} lang={lang} onAnswer={handleAnswer} />
      </div>
    </div>
  )
}
