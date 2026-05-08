'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import { t } from '@/components/psychoedu/lib/translations'
import Eli from '@/components/psychoedu/child/Eli'
import SceneBackground from '@/components/psychoedu/child/SceneBackground'

export default function ActivityInstruction({ sessionId, onStartGame }) {
  const { lang } = useLang()
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    setIsAnimating(true)
  }, [])

  const handleStartClick = () => {
    setIsAnimating(false)
    setTimeout(() => {
      onStartGame()
    }, 300)
  }

  return (
    <SceneBackground largeGroundFlowers>
      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .instruction-card {
          animation: slide-up 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes bounce-animation {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .eli-instruction {
          animation: bounce-animation 3s ease-in-out infinite;
        }
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 8px 32px rgba(255, 107, 53, 0.4), 0 0 0 0 rgba(255, 107, 53, 0.3);
          }
          50% {
            box-shadow: 0 12px 40px rgba(255, 107, 53, 0.5), 0 0 0 10px rgba(255, 107, 53, 0.08);
          }
        }
        .start-btn {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>

      <div
        style={{
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(1rem, 4vw, 1.75rem)',
          boxSizing: 'border-box',
          gap: 'clamp(1.5rem, 3vw, 2rem)',
        }}
      >
        {/* Eli Character */}
        <div className="eli-instruction">
          <Eli size={160} mood="excited" animated />
        </div>

        {/* Main Instruction Card */}
        <div
          className="instruction-card"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: '2rem',
            padding: 'clamp(1.5rem, 4vw, 2rem)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
            border: '3px solid rgba(255, 255, 255, 0.9)',
            maxWidth: 'min(480px, 92vw)',
            textAlign: 'center',
          }}
        >
          {/* Main Title */}
          <h2
            style={{
              fontFamily: "'Baloo 2', cursive",
              fontSize: 'clamp(1.4rem, 5vw, 1.8rem)',
              fontWeight: 900,
              color: '#0D9488',
              margin: '0 0 1rem 0',
              letterSpacing: '0.02em',
            }}
          >
            {t('game.instruction_main', lang)}
          </h2>

          {/* Subtitle */}
          <p
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontSize: 'clamp(0.9rem, 3.5vw, 1.1rem)',
              fontWeight: 700,
              color: '#4B5563',
              margin: '0 0 1.5rem 0',
              lineHeight: 1.5,
              letterSpacing: '0.01em',
            }}
          >
            {t('game.instruction_sub', lang)}
          </p>

        </div>

        {/* Start Game Button */}
        <button
          onClick={handleStartClick}
          className="start-btn"
          style={{
            minHeight: 56,
            minWidth: 'min(300px, 85vw)',
            padding: '0.75rem 2rem',
            borderRadius: '99px',
            border: 'none',
            background: 'linear-gradient(135deg, #FF6B35 0%, #FF8A50 100%)',
            color: 'white',
            fontSize: 'clamp(1rem, 4vw, 1.2rem)',
            fontWeight: 900,
            fontFamily: "'Baloo 2', cursive",
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            boxShadow: '0 8px 24px rgba(255, 107, 53, 0.3)',
            marginTop: '1rem',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.05)'
            e.target.style.boxShadow = '0 12px 32px rgba(255, 107, 53, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)'
            e.target.style.boxShadow = '0 8px 24px rgba(255, 107, 53, 0.3)'
          }}
        >
          🎮 {t('game.start_btn', lang)}
        </button>

      </div>
    </SceneBackground>
  )
}
