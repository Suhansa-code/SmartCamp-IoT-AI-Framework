'use client'

// src/app/child/cognitive/page.js
// ─────────────────────────────────────────────────────────────────────────────
// Cognitive activity page — picks a random session and runs it.
// Child arrives here from the high-score path after the Go/No-Go game.
// On completion routes back to /child (welcome screen).
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLang }          from '@/components/psychoedu/context/LanguageContext'
import { getRandomSession } from '@/components/psychoedu/lib/sessions'
import CognitiveSession     from '@/components/psychoedu/cognitive/CognitiveSession'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function CognitiveInner() {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const { lang, setLang } = useLang()
  const [session, setSession] = useState(null)

  useEffect(() => {
    // Sync ?lang= param
    const urlLang = searchParams.get('lang')
    if (urlLang && ['si','ta','en'].includes(urlLang)) setLang(urlLang)
    // Pick a random session
    setSession(getRandomSession())
  }, [])

  function handleComplete({ score, total, results = [] }) {
    // Save result to backend
    const sessionId = searchParams.get('session') ?? 'offline'
    const childId = searchParams.get('child') ?? ''
    const contentResponses = results.map((r) => ({
      taskId: r.taskId,
      answer: 'a',
      isCorrect: !!r.correct,
      timeTakenMs: 0,
    }))

    fetch(`${API_BASE}/api/session/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        child_id: childId,
        cognitiveScore: score,
        contentResponses,
      }),
    }).catch(() => {})

    // Navigate back to welcome
    router.push(`/child?lang=${lang}`)
  }

  if (!session) {
    return (
      <div style={{ minHeight:'100svh', background:'#F0F9FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', border:'5px solid #0D9488', borderTopColor:'transparent', animation:'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    )
  }

  return <CognitiveSession session={session} onComplete={handleComplete} />
}

export default function CognitivePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100svh', background:'#F0F9FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', border:'5px solid #0D9488', borderTopColor:'transparent', animation:'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    }>
      <CognitiveInner />
    </Suspense>
  )
}
