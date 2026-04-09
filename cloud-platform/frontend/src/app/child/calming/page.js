'use client'

// app/child/calming/page.jsx
// Mounts BreathingCircle and routes to content when done.
// Language carried via context — no extra props needed.

import { useRouter, useSearchParams } from 'next/navigation'
import { useLang }   from '@/components/psychoedu/context/LanguageContext'
import BreathingCircle from '@/components/psychoedu/child/BreathingCircle'

export default function CalmingPage() {
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
