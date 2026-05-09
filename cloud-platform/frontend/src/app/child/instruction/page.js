'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import ActivityInstruction from '@/components/psychoedu/child/ActivityInstruction'

function InstructionInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setLang } = useLang()
  
  const sessionId = searchParams.get('session')
  const lang = searchParams.get('lang')

  // Sync URL lang param → context on mount
  useEffect(() => {
    if (lang && ['si', 'ta', 'en'].includes(lang)) {
      setLang(lang)
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('preferredLanguage', lang)
      }
    }
  }, [lang, setLang])

  const handleStartGame = () => {
    router.push(
      `/child/task?session=${encodeURIComponent(sessionId || 'offline')}&lang=${encodeURIComponent(lang || 'en')}`
    )
  }

  return <ActivityInstruction sessionId={sessionId} onStartGame={handleStartGame} />
}

export default function InstructionPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100svh', background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '5px solid #0D9488', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
          <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
        </div>
      }
    >
      <InstructionInner />
    </Suspense>
  )
}
