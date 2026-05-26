'use client'

import { useState, useEffect, useRef } from 'react'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import Eli from './Eli'

// 🌈 Simple calming colors only
const COLORS = [
  { id: 'red',    color: '#FF6B6B' },
  { id: 'blue',   color: '#60A5FA' },
  { id: 'yellow', color: '#FFD93D' },
  { id: 'green',  color: '#4ADE80' },
  { id: 'purple', color: '#A855F7' },
]


const GAME_DURATION_SECONDS = 90

export default function CalmBubblePlayground({ onComplete }) {
  useLang()

  const [bubbles, setBubbles] = useState([])
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS)

  const nextId = useRef(0)
  const spawnTimer = useRef(null)
  const countdownTimer = useRef(null)

  // 🌊 Spawn slow calm bubbles
  useEffect(() => {
    spawnTimer.current = setInterval(() => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]

      const bubble = {
        id: nextId.current++,
        x: 5 + Math.random() * 90,
        size: 70 + Math.random() * 60,
        duration: 10 + Math.random() * 10,
        color: color.color,
      }

      setBubbles(prev => [...prev.slice(-10), bubble])
    }, 2000)

    return () => clearInterval(spawnTimer.current)
  }, [])

  useEffect(() => {
    countdownTimer.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer.current)
          clearInterval(spawnTimer.current)
          onComplete?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(countdownTimer.current)
  }, [onComplete])

  // 🫧 Pop bubble
  function popBubble(id) {
    setBubbles(prev => prev.filter(b => b.id !== id))
  }

  // 🧘 Hold interaction
  function growBubble(e, id) {
    e.preventDefault()

    const start = Date.now()

    const interval = setInterval(() => {
      const elapsed = Date.now() - start

      setBubbles(prev =>
        prev.map(b =>
          b.id === id
            ? { ...b, size: Math.min(b.size + 2, 180) }
            : b
        )
      )

      if (elapsed > 800) {
        clearInterval(interval)
        popBubble(id)
      }
    }, 50)
  }

  return (
    <>
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 0.8; }
          100% { transform: translateY(-120vh); opacity: 0; }
        }
      `}</style>

      <div style={{
        minHeight: '100svh',
        background: 'linear-gradient(180deg,#E0F7FF,#F8F0FF)',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'none'
      }}>

        {/* 🧸 Eli always visible */}
        <div style={{
          position: 'absolute',
          bottom: '5%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20
        }}>
          <Eli size={100} mood="happy" />
        </div>

        {/* 🫧 Bubbles */}
        {bubbles.map(b => (
          <div
            key={b.id}
            onPointerDown={(e) => growBubble(e, b.id)}
            onPointerUp={() => popBubble(b.id)}
            style={{
              position: 'absolute',
              left: `${b.x}%`,
              bottom: '-100px',
              width: b.size,
              height: b.size,
              borderRadius: '50%',
              background: b.color,
              opacity: 0.7,
              animation: `floatUp ${b.duration}s linear`,
              boxShadow: `0 0 20px ${b.color}`
            }}
          />
        ))}

        {/* 🔚 Exit button (child-controlled) */}
        <button
          onClick={onComplete}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            padding: '10px 16px',
            borderRadius: '20px',
            border: 'none',
            background: '#14B8A6',
            color: 'white',
            fontWeight: 'bold'
          }}
        >
          ✓
        </button>
      </div>
    </>
  )
}