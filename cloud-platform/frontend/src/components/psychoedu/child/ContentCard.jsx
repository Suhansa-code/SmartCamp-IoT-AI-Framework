'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/child/ContentCard.jsx — PAGES Psychoeducational Content
// Language-aware via useLang() · All text from translations.js
// 4 swipeable cards · responsive · works on all phones + tablets
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import { t }       from '@/components/psychoedu/lib/translations'

const CARDS = [
  { emoji:'💙', titleKey:'content.card_1.title', bodyKey:'content.card_1.body', color:'#CCFBF1' },
  { emoji:'🌟', titleKey:'content.card_2.title', bodyKey:'content.card_2.body', color:'#FEF3C7' },
  { emoji:'🤝', titleKey:'content.card_3.title', bodyKey:'content.card_3.body', color:'#FED7AA' },
  { emoji:'🌈', titleKey:'content.card_4.title', bodyKey:'content.card_4.body', color:'#BAE6FD' },
]

export default function ContentCard() {
  const router     = useRouter()
  const { lang }   = useLang()
  const [idx, setIdx]   = useState(0)
  const [done, setDone] = useState(false)
  const [dir, setDir]   = useState(1)  // 1 forward, -1 back (for animation hint)

  const card = CARDS[idx]

  function next() {
    if (idx + 1 >= CARDS.length) {
      setDone(true)
      setTimeout(() => router.push(`/child?lang=${lang}`), 2000)
    } else {
      setDir(1)
      setIdx(i => i + 1)
    }
  }

  if (done) {
    return (
      <div style={{
        minHeight:'100svh', background:'#F0F9FF',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:'clamp(0.75rem,3vw,1.25rem)', padding:'2rem', textAlign:'center',
      }}>
        <span style={{ fontSize:'clamp(4rem,14vw,6rem)', animation:'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
          {t('content.complete_emoji', lang)}
        </span>
        <h2 style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.6rem,6vw,2.2rem)', fontWeight:900, color:'#1E3A5F' }}>
          {t('content.complete_heading', lang)}
        </h2>
        <style>{`@keyframes popIn { 0%{transform:scale(0) rotate(-20deg);opacity:0} 70%{transform:scale(1.2) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity:0; transform:translateX(24px); }
          to   { opacity:1; transform:translateX(0); }
        }
      `}</style>

      <main style={{
        minHeight: '100svh',
        background: '#F0F9FF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(1.25rem,4vw,2rem) clamp(1rem,4vw,1.5rem)',
        boxSizing: 'border-box',
        gap: 'clamp(1rem,3vw,1.5rem)',
      }}>

        {/* Progress dots at top */}
        <div style={{ display:'flex', gap:'0.5rem' }}>
          {CARDS.map((_, i) => (
            <div key={i} style={{
              width: 'clamp(8px,2.5vw,12px)',
              height: 'clamp(8px,2.5vw,12px)',
              borderRadius: '50%',
              background: i === idx ? '#0D9488' : i < idx ? '#CCFBF1' : '#CBD5E1',
              border: i === idx ? 'none' : `2px solid ${i < idx ? '#0D9488' : '#CBD5E1'}`,
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Card */}
        <div
          key={idx}
          style={{
            width: '100%',
            maxWidth: 'min(440px, 92vw)',
            borderRadius: 'clamp(1.25rem,5vw,2rem)',
            padding: 'clamp(1.5rem,5vw,2.5rem)',
            background: card.color,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'clamp(0.75rem,2.5vw,1.25rem)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
            animation: 'slideIn 0.35s ease',
          }}
        >
          {/* Emoji */}
          <span style={{ fontSize:'clamp(3.5rem,12vw,5rem)', lineHeight:1 }}>
            {card.emoji}
          </span>

          {/* Title */}
          <h2 style={{
            fontFamily:"'Baloo 2',cursive",
            fontSize: 'clamp(1.3rem,5vw,1.9rem)',
            fontWeight: 900,
            color: '#1E3A5F',
            textAlign: 'center',
            lineHeight: 1.2,
          }}>
            {t(card.titleKey, lang)}
          </h2>

          {/* Body */}
          <p style={{
            fontSize: 'clamp(0.95rem,3vw,1.15rem)',
            fontWeight: 600,
            color: '#1E3A5F',
            textAlign: 'center',
            lineHeight: 1.6,
            opacity: 0.85,
          }}>
            {t(card.bodyKey, lang)}
          </p>
        </div>

        {/* Card counter */}
        <p style={{ fontSize:'clamp(0.78rem,2.5vw,0.9rem)', fontWeight:600, color:'#64748B' }}>
          {idx + 1} / {CARDS.length}
        </p>

        {/* Next / Done button */}
        <button
          onClick={next}
          style={{
            width: '100%',
            maxWidth: 'min(440px, 92vw)',
            minHeight: 'clamp(60px,13vw,72px)',
            background: '#F97316',
            color: 'white',
            borderRadius: '9999px',
            border: 'none',
            fontFamily: "'Baloo 2',cursive",
            fontSize: 'clamp(1.1rem,4vw,1.4rem)',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: '0 6px 24px rgba(249,115,22,0.25)',
            cursor: 'pointer',
            transition: 'transform 0.1s',
            WebkitTapHighlightColor: 'transparent',
          }}
          onPointerDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
          onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {idx + 1 < CARDS.length ? t('content.next', lang) : t('content.done', lang)}
        </button>
      </main>
    </>
  )
}
