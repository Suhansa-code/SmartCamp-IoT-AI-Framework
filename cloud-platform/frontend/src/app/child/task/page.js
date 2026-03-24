'use client'

// app/child/task/page.jsx
// Reads ?lang= from URL on mount and syncs it into LanguageContext.
// This ensures that even if the user refreshes, the lang is preserved.

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import AnimalGame  from '@/components/psychoedu/child/AnimalGame'

function TaskInner() {
  const searchParams = useSearchParams()
  const { setLang }  = useLang()

  // Sync URL lang param → context on mount
  useEffect(() => {
    const urlLang = searchParams.get('lang')
    if (urlLang && ['si', 'ta', 'en'].includes(urlLang)) {
      setLang(urlLang)
    }
  }, [])

  return <AnimalGame />
}

export default function TaskPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100svh', background:'#F0F9FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:48, height:48, borderRadius:'50%', border:'5px solid #0D9488', borderTopColor:'transparent', animation:'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    }>
      <TaskInner />
    </Suspense>
  )
}
