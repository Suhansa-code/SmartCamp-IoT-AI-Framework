'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLang }          from '@/components/psychoedu/context/LanguageContext'
import { getRandomSession, getRandomSessionExcluding } from '@/components/psychoedu/lib/sessions'
import CognitiveSession     from '@/components/psychoedu/cognitive/CognitiveSession'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function CognitiveInner() {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const { lang, setLang } = useLang()
  const [session, setSession] = useState(null)
  const [childId, setChildId] = useState('')

  useEffect(() => {
    // Sync ?lang= param
    const urlLang = searchParams.get('lang')
    if (urlLang && ['si','ta','en'].includes(urlLang)) setLang(urlLang)
    const storedChildId = typeof window !== 'undefined'
      ? (sessionStorage.getItem('selectedChildId') ?? '')
      : ''
    setChildId(storedChildId)
    // Pick a random session
    setSession(getRandomSession())

    
    // Pick a random session, avoiding recently used ones
    async function selectSession() {
      const childId = searchParams.get('child') ?? 'offline'
      
      // If offline, just pick random
      if (childId === 'offline') {
        setSession(getRandomSession())
        return
      }
      
      try {
        // Fetch last 3 sessions for this child
        const res = await fetch(`${API_BASE}/api/session/recent/${encodeURIComponent(childId)}`)
        if (!res.ok) {
          setSession(getRandomSession())
          return
        }
        
        const data = await res.json()
        const recentLabels = data.recent_labels ?? []
        
        // Pick session avoiding those in recent list
        const chosen = getRandomSessionExcluding(recentLabels)
        setSession(chosen)
      } catch {
        // Fallback if fetch fails
        setSession(getRandomSession())
      }
    }
    
    selectSession()
  }, [searchParams])

  function handleComplete({ score, total, results = [] }) {
    // Save result to backend
    const sessionId = searchParams.get('session') ?? 'offline'
    const contentResponses = results.map((r) => ({
      taskId: r.taskId,
      answer: String(r.selectedAnswer ?? ''),
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
