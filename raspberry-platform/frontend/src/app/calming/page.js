'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLang }   from '@/components/psychoedu/context/LanguageContext'
import BreathingCircle from '@/components/psychoedu/child/BreathingCircle'

function CalmingInner() {
  const router   = useRouter()
  const searchParams = useSearchParams()
  const { lang } = useLang()

  function handleComplete() {
    const sessionId = searchParams.get('session') ?? 'offline'
    const childId = searchParams.get('child') ?? ''
    const attempt = Number(searchParams.get('attempt') ?? '1')
    router.push(`/child/content?session=${encodeURIComponent(sessionId)}&child=${encodeURIComponent(childId)}&attempt=${attempt}&lang=${encodeURIComponent(lang)}`)
  }

  return <BreathingCircle onComplete={handleComplete} />
}

export default function CalmingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100svh', background:'#F0F9FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', border:'5px solid #0D9488', borderTopColor:'transparent', animation:'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    }>
      <CalmingInner />
    </Suspense>
  )
}