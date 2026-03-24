'use client'

import { useState, useEffect } from 'react'

// ── Shared style helpers ──────────────────────────────────────────────────────
const Q_STYLE = {
  fontFamily: "'Baloo 2', cursive",
  fontSize:   'clamp(1.15rem, 4.5vw, 1.5rem)',
  fontWeight: 900,
  color:      '#1E3A5F',
  lineHeight: 1.3,
  textAlign:  'center',
  marginBottom: '1.25rem',
}
const CARD = {
  background:    'white',
  borderRadius:  'clamp(1rem, 4vw, 1.5rem)',
  padding:       'clamp(1.25rem, 4vw, 1.75rem)',
  boxShadow:     '0 4px 20px rgba(0,0,0,0.07)',
  width:         '100%',
  maxWidth:      'min(460px, 94vw)',
  margin:        '0 auto',
}
const OPTION_BASE = {
  width:           '100%',
  minHeight:       'clamp(56px, 13vw, 68px)',
  borderRadius:    'clamp(0.75rem, 3vw, 1.1rem)',
  border:          '2.5px solid #E2E8F0',
  background:      'white',
  fontFamily:      "'Baloo 2', cursive",
  fontSize:        'clamp(1rem, 3.5vw, 1.25rem)',
  fontWeight:      800,
  color:           '#1E3A5F',
  cursor:          'pointer',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  transition:      'all 0.15s',
  WebkitTapHighlightColor: 'transparent',
}

function feedbackStyle(state) {
  if (state === 'correct') return { ...OPTION_BASE, background:'#DCFCE7', borderColor:'#22C55E', color:'#166534' }
  if (state === 'wrong')   return { ...OPTION_BASE, background:'#FEE2E2', borderColor:'#EF4444', color:'#991B1B' }
  return OPTION_BASE
}

// ═══════════════════════════════════════════════════════════════════════════════
// MCQ — 4 options, tap correct
// ═══════════════════════════════════════════════════════════════════════════════
function MCQTask({ task, lang, onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [locked,   setLocked]   = useState(false)

  function pick(idx) {
    if (locked) return
    setLocked(true)
    setSelected(idx)
    const correct = idx === task.answer
    setTimeout(() => onAnswer(correct), 900)
  }

  const options = task.options[lang] ?? task.options['en']
  return (
    <div style={CARD}>
      <p style={Q_STYLE}>{task.question[lang] ?? task.question['en']}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:'clamp(0.6rem,2vw,0.85rem)' }}>
        {options.map((opt, i) => {
          const state = selected === null ? 'idle' : i === task.answer ? 'correct' : i === selected ? 'wrong' : 'idle'
          return (
            <button key={i} onClick={() => pick(i)} style={feedbackStyle(state)}
              onPointerDown={e => { if (!locked) e.currentTarget.style.transform = 'scale(0.97)' }}
              onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ marginRight:'0.5rem', fontSize:'clamp(1rem,3vw,1.15rem)', opacity:0.6 }}>
                {['①','②','③','④'][i]}
              </span>
              {opt}
              {state === 'correct' && <span style={{ marginLeft:'auto', fontSize:'1.2rem' }}>✅</span>}
              {state === 'wrong'   && <span style={{ marginLeft:'auto', fontSize:'1.2rem' }}>❌</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILL_BLANK — sentence with gap, 3 word choices
// ═══════════════════════════════════════════════════════════════════════════════
function FillBlankTask({ task, lang, onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [locked,   setLocked]   = useState(false)

  const choices = task.blank_choices[lang] ?? task.blank_choices['en']
  const question = task.question[lang] ?? task.question['en']

  function pick(idx) {
    if (locked) return
    setLocked(true)
    setSelected(idx)
    setTimeout(() => onAnswer(idx === task.answer), 900)
  }

  // Replace ___ with selected word or highlighted blank
  const displayQ = question.replace('___',
    selected !== null
      ? `[${choices[selected]}]`
      : '[ _____ ]'
  )

  return (
    <div style={CARD}>
      <p style={Q_STYLE}>{displayQ}</p>
      <div style={{ display:'flex', gap:'clamp(0.5rem,2vw,0.75rem)', justifyContent:'center', flexWrap:'wrap' }}>
        {choices.map((ch, i) => {
          const state = selected === null ? 'idle' : i === task.answer ? 'correct' : i === selected ? 'wrong' : 'idle'
          return (
            <button key={i} onClick={() => pick(i)} style={{ ...feedbackStyle(state), flex:'1 1 auto', minWidth:'clamp(80px,22vw,110px)', maxWidth:'140px' }}>
              {ch}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRUE_FALSE — tap True or False button
// ═══════════════════════════════════════════════════════════════════════════════
function TrueFalseTask({ task, lang, onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [locked,   setLocked]   = useState(false)

  const question = task.question[lang] ?? task.question['en']
  const trueLabel  = lang === 'si' ? '✅ හරි'   : lang === 'ta' ? '✅ சரி'  : '✅ True'
  const falseLabel = lang === 'si' ? '❌ වැරදි' : lang === 'ta' ? '❌ தவறு' : '❌ False'

  function pick(val) {
    if (locked) return
    setLocked(true)
    setSelected(val)
    setTimeout(() => onAnswer(val === task.answer), 900)
  }

  function btnStyle(val) {
    if (selected === null) return { ...OPTION_BASE, flex:1, background: val ? '#F0FDF4' : '#FFF1F2', borderColor: val ? '#86EFAC' : '#FCA5A5', color: val ? '#166534' : '#9F1239', fontSize:'clamp(1rem,3.5vw,1.3rem)' }
    const correct = val === task.answer
    const chosen  = selected === val
    if (correct)       return { ...OPTION_BASE, flex:1, background:'#DCFCE7', borderColor:'#22C55E', color:'#166534', fontSize:'clamp(1rem,3.5vw,1.3rem)' }
    if (chosen)        return { ...OPTION_BASE, flex:1, background:'#FEE2E2', borderColor:'#EF4444', color:'#991B1B', fontSize:'clamp(1rem,3.5vw,1.3rem)' }
    return { ...OPTION_BASE, flex:1, opacity:0.4, fontSize:'clamp(1rem,3.5vw,1.3rem)' }
  }

  return (
    <div style={CARD}>
      <p style={Q_STYLE}>{question}</p>
      <div style={{ display:'flex', gap:'clamp(0.75rem,3vw,1rem)', marginTop:'0.5rem' }}>
        <button onClick={() => pick(true)}  style={btnStyle(true)}>  {trueLabel}  </button>
        <button onClick={() => pick(false)} style={btnStyle(false)}> {falseLabel} </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT — show N emoji, pick the number
// ═══════════════════════════════════════════════════════════════════════════════
function CountTask({ task, lang, onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [locked,   setLocked]   = useState(false)

  function pick(idx) {
    if (locked) return
    setLocked(true)
    setSelected(idx)
    setTimeout(() => onAnswer(idx === task.answer), 900)
  }

  const options = task.options[lang] ?? task.options['en']

  return (
    <div style={CARD}>
      <p style={Q_STYLE}>{task.question[lang] ?? task.question['en']}</p>
      {/* Emoji display grid */}
      <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'clamp(4px,1.5vw,8px)', margin:'0.75rem 0 1.25rem', padding:'1rem', background:'#F0F9FF', borderRadius:'1rem' }}>
        {Array.from({ length: task.count }).map((_, i) => (
          <span key={i} style={{ fontSize:'clamp(1.75rem,6vw,2.25rem)', lineHeight:1 }}>
            {task.display_emoji}
          </span>
        ))}
      </div>
      {/* Options */}
      <div style={{ display:'flex', gap:'clamp(0.5rem,2vw,0.75rem)', justifyContent:'center' }}>
        {options.map((opt, i) => {
          const state = selected === null ? 'idle' : i === task.answer ? 'correct' : i === selected ? 'wrong' : 'idle'
          return (
            <button key={i} onClick={() => pick(i)} style={{ ...feedbackStyle(state), flex:1, minWidth:'clamp(56px,14vw,70px)', maxWidth:'80px', fontSize:'clamp(1.2rem,4vw,1.5rem)' }}>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATTERN — show sequence with ?, pick next item
// ═══════════════════════════════════════════════════════════════════════════════
function PatternTask({ task, lang, onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [locked,   setLocked]   = useState(false)

  function pick(idx) {
    if (locked) return
    setLocked(true)
    setSelected(idx)
    setTimeout(() => onAnswer(idx === task.answer), 900)
  }

  const options = task.options[lang] ?? task.options['en']

  return (
    <div style={CARD}>
      <p style={Q_STYLE}>{task.question[lang] ?? task.question['en']}</p>
      {/* Sequence display */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap', gap:'clamp(4px,1.5vw,8px)', margin:'0.5rem 0 1.25rem', padding:'0.75rem', background:'#F0F9FF', borderRadius:'1rem' }}>
        {task.sequence.map((item, i) => (
          <div key={i} style={{ width:'clamp(36px,9vw,46px)', height:'clamp(36px,9vw,46px)', borderRadius:'clamp(0.5rem,2vw,0.75rem)', background: item === '?' ? '#1E3A5F' : 'white', border:'2px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'clamp(1rem,3.5vw,1.25rem)', color: item === '?' ? 'white' : '#1E3A5F', fontWeight:800, fontFamily:"'Baloo 2',cursive" }}>
            {item}
          </div>
        ))}
      </div>
      {/* Options */}
      <div style={{ display:'flex', gap:'clamp(0.5rem,2vw,0.75rem)', justifyContent:'center', flexWrap:'wrap' }}>
        {options.map((opt, i) => {
          const state = selected === null ? 'idle' : i === task.answer ? 'correct' : i === selected ? 'wrong' : 'idle'
          return (
            <button key={i} onClick={() => pick(i)} style={{ ...feedbackStyle(state), flex:'1 1 auto', minWidth:'clamp(56px,14vw,70px)', maxWidth:'90px', fontSize:'clamp(1rem,3.5vw,1.3rem)' }}>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SORT_ORDER — tap items in correct order
// ═══════════════════════════════════════════════════════════════════════════════
function SortOrderTask({ task, lang, onAnswer }) {
  const words          = task.words[lang] ?? task.words['en']
  const correctOrder   = task.correct_order[lang] ?? task.correct_order['en']
  const [order, setOrder] = useState(() => [...words].sort(() => Math.random() - 0.5))
  const [tapped, setTapped]   = useState([])
  const [locked, setLocked]   = useState(false)
  const [showResult, setShowResult] = useState(null)

  function tapWord(word) {
    if (locked || tapped.includes(word)) return
    const newTapped = [...tapped, word]
    setTapped(newTapped)
    if (newTapped.length === words.length) {
      setLocked(true)
      const correct = newTapped.every((w, i) => w === correctOrder[i])
      setShowResult(correct)
      setTimeout(() => onAnswer(correct), 1000)
    }
  }

  return (
    <div style={CARD}>
      <p style={Q_STYLE}>{task.question[lang] ?? task.question['en']}</p>
      {/* Answer slots */}
      <div style={{ display:'flex', gap:'clamp(0.4rem,1.5vw,0.6rem)', justifyContent:'center', flexWrap:'wrap', marginBottom:'1.25rem', minHeight:'clamp(44px,11vw,56px)' }}>
        {tapped.map((w, i) => (
          <div key={i} style={{ background: showResult === null ? '#0D9488' : showResult ? '#22C55E' : '#EF4444', color:'white', borderRadius:'clamp(0.5rem,2vw,0.75rem)', padding:'clamp(6px,2vw,8px) clamp(12px,3vw,16px)', fontFamily:"'Baloo 2',cursive", fontWeight:800, fontSize:'clamp(0.9rem,3vw,1.1rem)' }}>
            {w}
          </div>
        ))}
        {Array.from({ length: words.length - tapped.length }).map((_, i) => (
          <div key={i} style={{ background:'#F0F9FF', borderRadius:'clamp(0.5rem,2vw,0.75rem)', padding:'clamp(6px,2vw,8px) clamp(12px,3vw,16px)', border:'2px dashed #CBD5E1', minWidth:'clamp(48px,12vw,60px)' }} />
        ))}
      </div>
      {/* Word pool */}
      <div style={{ display:'flex', gap:'clamp(0.5rem,2vw,0.75rem)', justifyContent:'center', flexWrap:'wrap' }}>
        {order.map((w, i) => {
          const used = tapped.includes(w)
          return (
            <button key={i} onClick={() => tapWord(w)} disabled={used || locked}
              style={{ background: used ? '#F1F5F9' : 'white', color: used ? '#94A3B8' : '#1E3A5F', borderRadius:'clamp(0.5rem,2vw,0.75rem)', padding:'clamp(8px,2.5vw,10px) clamp(14px,4vw,18px)', border:`2px solid ${used ? '#E2E8F0' : '#0D9488'}`, fontFamily:"'Baloo 2',cursive", fontWeight:800, fontSize:'clamp(0.9rem,3vw,1.1rem)', cursor: used ? 'not-allowed' : 'pointer', opacity: used ? 0.5 : 1, transition:'all 0.15s' }}>
              {w}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATCH — tap a left item then tap its right pair
// ═══════════════════════════════════════════════════════════════════════════════
function MatchTask({ task, lang, onAnswer }) {
  const pairs = task.pairs
  const [shuffledEmoji] = useState(() => [...pairs].sort(() => Math.random() - 0.5))
  const [selectedWord,  setSelectedWord]  = useState(null)
  const [matched,       setMatched]       = useState([])  // array of correct pair indices
  const [wrongPair,     setWrongPair]     = useState(null)
  const [locked,        setLocked]        = useState(false)

  function pickWord(idx) {
    if (locked || matched.some(m => m.word === idx)) return
    setSelectedWord(idx)
    setWrongPair(null)
  }

  function pickEmoji(shuffledIdx) {
    if (selectedWord === null || locked) return
    // Find the original pair index of this emoji
    const originalIdx = pairs.findIndex(p => p.emoji === shuffledEmoji[shuffledIdx].emoji)
    if (originalIdx === selectedWord) {
      // Correct match
      const newMatched = [...matched, { word: selectedWord, emoji: shuffledIdx }]
      setMatched(newMatched)
      setSelectedWord(null)
      if (newMatched.length === pairs.length) {
        setLocked(true)
        setTimeout(() => onAnswer(true), 800)
      }
    } else {
      setWrongPair({ word: selectedWord, emoji: shuffledIdx })
      setTimeout(() => setWrongPair(null), 600)
    }
  }

  const isWordMatched  = (idx) => matched.some(m => m.word === idx)
  const isEmojiMatched = (idx) => matched.some(m => m.emoji === idx)

  return (
    <div style={CARD}>
      <p style={Q_STYLE}>{task.question[lang] ?? task.question['en']}</p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'clamp(0.5rem,2vw,0.85rem)' }}>
        {/* Left: words */}
        <div style={{ display:'flex', flexDirection:'column', gap:'clamp(0.5rem,2vw,0.75rem)' }}>
          {pairs.map((p, i) => {
            const matched_  = isWordMatched(i)
            const selected_ = selectedWord === i
            const wrong_    = wrongPair?.word === i
            return (
              <button key={i} onClick={() => pickWord(i)} style={{ minHeight:'clamp(48px,11vw,58px)', borderRadius:'clamp(0.5rem,2vw,0.75rem)', border:`2.5px solid ${matched_ ? '#22C55E' : selected_ ? '#0D9488' : wrong_ ? '#EF4444' : '#E2E8F0'}`, background: matched_ ? '#DCFCE7' : selected_ ? '#CCFBF1' : wrong_ ? '#FEE2E2' : 'white', fontFamily:"'Baloo 2',cursive", fontWeight:800, fontSize:'clamp(0.85rem,2.8vw,1rem)', color: matched_ ? '#166534' : '#1E3A5F', cursor: matched_ ? 'default' : 'pointer', transition:'all 0.15s' }}>
                {p.word[lang] ?? p.word['en']}
                {matched_ && ' ✓'}
              </button>
            )
          })}
        </div>
        {/* Right: emojis (shuffled) */}
        <div style={{ display:'flex', flexDirection:'column', gap:'clamp(0.5rem,2vw,0.75rem)' }}>
          {shuffledEmoji.map((p, i) => {
            const matched_  = isEmojiMatched(i)
            const wrong_    = wrongPair?.emoji === i
            return (
              <button key={i} onClick={() => pickEmoji(i)} style={{ minHeight:'clamp(48px,11vw,58px)', borderRadius:'clamp(0.5rem,2vw,0.75rem)', border:`2.5px solid ${matched_ ? '#22C55E' : wrong_ ? '#EF4444' : selectedWord !== null ? '#0D9488' : '#E2E8F0'}`, background: matched_ ? '#DCFCE7' : wrong_ ? '#FEE2E2' : selectedWord !== null ? '#F0FDFA' : 'white', fontSize:'clamp(1.5rem,5vw,2rem)', cursor: matched_ ? 'default' : 'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {p.emoji}
                {matched_ && <span style={{ fontSize:'0.75rem', marginLeft:'4px' }}>✓</span>}
              </button>
            )
          })}
        </div>
      </div>
      {/* Instruction */}
      <p style={{ textAlign:'center', fontSize:'clamp(0.75rem,2vw,0.82rem)', color:'#0D9488', fontWeight:600, marginTop:'0.75rem' }}>
        {lang === 'si' ? 'වචනය තෝරා, රූපය තෝරන්න' : lang === 'ta' ? 'சொல்லை தேர்ந்தெடுத்து படத்தை தேர்ந்தெடுங்கள்' : 'Tap a word, then tap its picture'}
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main dispatcher
// ═══════════════════════════════════════════════════════════════════════════════
export default function TaskRenderer({ task, lang, onAnswer }) {
  // Reset state when task changes
  const [key, setKey] = useState(task.id)
  useEffect(() => { setKey(task.id) }, [task.id])

  const props = { task, lang, onAnswer }

  switch (task.type) {
    case 'mcq':        return <MCQTask key={key}       {...props} />
    case 'fill_blank': return <FillBlankTask key={key} {...props} />
    case 'true_false': return <TrueFalseTask key={key} {...props} />
    case 'count':      return <CountTask key={key}     {...props} />
    case 'pattern':    return <PatternTask key={key}   {...props} />
    case 'sort_order': return <SortOrderTask key={key} {...props} />
    case 'match':      return <MatchTask key={key}     {...props} />
    default:           return <MCQTask key={key}       {...props} />
  }
}
