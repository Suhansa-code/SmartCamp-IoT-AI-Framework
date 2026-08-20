'use client'

import { ArrowUpRight } from 'lucide-react'
import { P } from '@/data/theme.data'

export default function ArrowChip({ dark }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: dark ? 'rgba(255,255,255,0.16)' : P.dark,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <ArrowUpRight size={16} />
    </div>
  )
}