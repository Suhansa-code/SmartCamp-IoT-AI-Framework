'use client'

// app/child/calming/page.jsx
// Mounts BreathingCircle and routes to content when done.
// Language carried via context — no extra props needed.

import { useRouter } from 'next/navigation'
import { useLang }   from '@/components/psychoedu/context/LanguageContext'
import BreathingCircle from '@/components/psychoedu/child/BreathingCircle'

export default function CalmingPage() {
  const router   = useRouter()
  const { lang } = useLang()

  function handleComplete() {
    router.push(`/child/content?lang=${lang}`)
  }

  return <BreathingCircle onComplete={handleComplete} />
}
