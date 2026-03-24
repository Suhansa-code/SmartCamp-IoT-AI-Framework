'use client'

import { useState } from 'react'
import { LANGUAGES } from '@/components/psychoedu/lib/translations'

function WavingMascot() {
  return (
    <img
      src="/psychoedu/mascots/elephant-welcome.svg"
      alt="Elephant mascot"
      style={{ width:'72px', height:'72px', objectFit:'contain' }}
    />
  )
}

export default function LanguagePicker({ sessionId, onSelect }) {
  const [selected, setSelected] = useState(null)
  const [pressing, setPressing] = useState(null)

  function handlePick(code) {
    setSelected(code)
    setTimeout(() => onSelect(code), 320)
  }

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounceMascot { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
        .lang-card  { animation: fadeSlideUp 0.4s ease forwards; opacity:0; }
        .mascot-bob { animation: bounceMascot 2.8s ease-in-out infinite; }
      `}</style>

      <div style={{
        minHeight:'100svh',
        background:'linear-gradient(160deg,#F0F9FF 0%,#EEF2FF 100%)',
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'space-between',
        padding:'clamp(1.25rem,4vw,2.5rem) clamp(1rem,4vw,2rem)',
        position:'relative', overflow:'hidden', boxSizing:'border-box',
      }}>
        {/* Background blobs */}
        <div style={{ position:'absolute', top:'-80px', right:'-80px', width:'240px', height:'240px', borderRadius:'50%', background:'#0D9488', opacity:0.06, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'-100px', left:'-60px', width:'280px', height:'280px', borderRadius:'50%', background:'#8B5CF6', opacity:0.05, pointerEvents:'none' }} />

        {/* Mascot + headings */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'clamp(0.75rem,2vw,1.25rem)', width:'100%', maxWidth:'480px' }}>
          <div className="mascot-bob">
            <div style={{ width:'clamp(72px,15vw,100px)', height:'clamp(72px,15vw,100px)', borderRadius:'50%', background:'linear-gradient(135deg,#CCFBF1,#BAE6FD)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 32px rgba(13,148,136,0.18)' }}>
              <WavingMascot />
            </div>
          </div>
          <div style={{ textAlign:'center' }}>
            <h1 style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.4rem,5vw,2.2rem)', fontWeight:900, color:'#1E3A5F', lineHeight:1.2, marginBottom:'0.25rem' }}>
              ඔබේ භාෂාව තෝරන්න
            </h1>
            <p style={{ fontSize:'clamp(1rem,3vw,1.2rem)', fontWeight:700, color:'#1E3A5F', opacity:0.7, lineHeight:1.3 }}>
              உங்கள் மொழியை தேர்ந்தெடுக்கவும்
            </p>
            <p style={{ fontSize:'clamp(0.85rem,2.5vw,1rem)', fontWeight:600, color:'#0D9488', letterSpacing:'0.06em', textTransform:'uppercase', marginTop:'4px' }}>
              Choose Your Language
            </p>
          </div>
        </div>

        {/* Language cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:'clamp(0.75rem,2.5vw,1.1rem)', width:'100%', maxWidth:'480px' }}>
          {LANGUAGES.map((lang, i) => {
            const isSel  = selected === lang.code
            const isPress= pressing === lang.code
            return (
              <button
                key={lang.code}
                className="lang-card"
                style={{ animationDelay:`${i * 0.1}s`, animationFillMode:'forwards' }}
                onPointerDown={() => setPressing(lang.code)}
                onPointerUp={() => { setPressing(null); handlePick(lang.code) }}
                onPointerLeave={() => setPressing(null)}
                aria-label={`Select ${lang.labelEn}`}
              >
                <span style={{
                  width:'100%', minHeight:'clamp(76px,14vw,96px)',
                  borderRadius:'clamp(1rem,3vw,1.5rem)',
                  background: isSel ? lang.color : isPress ? `${lang.color}22` : 'white',
                  border:`3px solid ${isSel ? lang.color : isPress ? lang.color : '#E2E8F0'}`,
                  boxShadow: isSel ? `0 8px 32px ${lang.color}55` : isPress ? `0 4px 20px ${lang.color}33` : '0 2px 12px rgba(0,0,0,0.06)',
                  display:'flex', alignItems:'center', gap:'clamp(1rem,4vw,1.75rem)',
                  padding:'0 clamp(1.25rem,4vw,2rem)',
                  transform: isPress ? 'scale(0.97)' : isSel ? 'scale(1.02)' : 'scale(1)',
                  transition:'transform 0.12s, box-shadow 0.15s, background 0.15s, border-color 0.15s',
                  textAlign:'left', cursor:'pointer',
                  boxSizing:'border-box',
                }}>
                  <span style={{ fontSize:'clamp(2rem,7vw,2.8rem)', lineHeight:1, flexShrink:0 }}>{lang.flag}</span>
                  <span style={{ display:'block', flex:1, minWidth:0 }}>
                    <span style={{ display:'block', fontFamily:"'Noto Sans Sinhala','Noto Sans Tamil','Baloo 2',sans-serif", fontSize:'clamp(1.3rem,4.5vw,1.9rem)', fontWeight:900, color: isSel ? 'white' : '#1E3A5F', lineHeight:1.3, paddingTop:'2px', transition:'color 0.15s', whiteSpace:'normal', overflow:'visible' }}>
                      {lang.label}
                    </span>
                    <span style={{ display:'block', fontSize:'clamp(0.75rem,2.5vw,0.95rem)', fontWeight:600, color: isSel ? 'rgba(255,255,255,0.85)' : '#64748B', letterSpacing:'0.06em', textTransform:'uppercase', marginTop:'2px', transition:'color 0.15s' }}>
                      {lang.labelEn}
                    </span>
                  </span>
                  <span style={{ width:'clamp(28px,6vw,36px)', height:'clamp(28px,6vw,36px)', borderRadius:'50%', background: isSel ? 'rgba(255,255,255,0.3)' : '#F0F9FF', border:`2px solid ${isSel ? 'rgba(255,255,255,0.6)' : '#E2E8F0'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                    {isSel && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8 L6.5 11.5 L13 4.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <p style={{ fontSize:'clamp(0.72rem,2vw,0.82rem)', fontWeight:600, color:'#0D9488', opacity:0.6, textAlign:'center' }}>
          PAGES · Session: {sessionId?.slice(0, 8) ?? '—'}
        </p>
      </div>
    </>
  )
}
