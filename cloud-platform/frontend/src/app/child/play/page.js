'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import BubblePlayground from '@/components/psychoedu/child/BubblePlayground'

function PlayInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const { lang, setLang } = useLang()
  const completedRef = useRef(false)

  useEffect(() => {
    const urlLang = searchParams.get('lang')
    if (urlLang && ['si','ta','en'].includes(urlLang)) setLang(urlLang)
  }, [])

  async function handleComplete() {
    // Prevent double-submission
    if (completedRef.current) return
    completedRef.current = true

    const sessionId = searchParams.get('session') ?? 'offline'
    const childId   = searchParams.get('child')   ?? ''

    try {
      // Close the session cleanly — cognitive score 0, no content responses
      // This is intentional: child was not assessed on cognitive content.
      await fetch('/api/session/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id:       sessionId,
          child_id:         childId,
          cognitiveScore:   0,
          contentResponses: [],
        }),
      })
    } catch {
      // Offline fallback — session will sync later when connectivity returns
    }

    // Return to welcome screen for next child
    router.push(`/child?lang=${lang}`)
  }

  return <BubblePlayground onComplete={handleComplete} />
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100svh', background:'#E0F7FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', border:'5px solid #0D9488', borderTopColor:'transparent', animation:'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <PlayInner />
    </Suspense>
  )
}
