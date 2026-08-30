'use client'

import { ArrowUpRight } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'

export default function ArrowChip({ dark }) {
  const { T } = useTheme()
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: dark ? 'rgba(255,255,255,0.16)' : T.textPrimary,
      color: dark ? '#fff' : T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <ArrowUpRight size={16} />
    </div>
  )
}