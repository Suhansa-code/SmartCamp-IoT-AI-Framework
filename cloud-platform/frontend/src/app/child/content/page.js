'use client'

// app/child/content/page.jsx
// Syncs ?lang= from URL into context, then shows ContentCard.

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLang }    from '@/components/psychoedu/context/LanguageContext'
import ContentCard    from '@/components/psychoedu/child/ContentCard'

function ContentInner() {
  const searchParams = useSearchParams()
  const { setLang }  = useLang()

  useEffect(() => {
    const urlLang = searchParams.get('lang')
    if (urlLang && ['si', 'ta', 'en'].includes(urlLang)) setLang(urlLang)
  }, [])

  return <ContentCard />
}

export default function ContentPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100svh', background:'#F0F9FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', border:'5px solid #0D9488', borderTopColor:'transparent', animation:'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    }>
      <ContentInner />
    </Suspense>
  )
}
