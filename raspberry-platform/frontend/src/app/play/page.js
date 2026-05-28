'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import BubblePlayground from '@/components/psychoedu/child/BubblePlayground'

function PlayInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const { lang, setLang } = useLang()
  const completedRef = useRef(false)
  const [navigateHome, setNavigateHome] = useState(false)

  // Initialize language from query
  useEffect(() => {
    const urlLang = searchParams.get('lang')
    if (urlLang && ['si','ta','en'].includes(urlLang)) {
      setLang(urlLang)
    }
  }, [searchParams, setLang])

  function handleComplete() {
    // Prevent double-submission
    if (completedRef.current) return
    completedRef.current = true

    const sessionId = searchParams.get('session') ?? 'offline'
    const childId   = searchParams.get('child')   ?? ''

    // Defer state change to next tick so it’s not inside child render
    setTimeout(() => {
      setNavigateHome(true)
    }, 0)
  }

  // Perform navigation after render cycle
  useEffect(() => {
    if (navigateHome) {
      router.push(`/child?lang=${lang}`) // language selection page
    }
  }, [navigateHome, router, lang])

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
