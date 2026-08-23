'use client'

import { Crosshair } from 'lucide-react'
import { STATUS_COLOR } from '@/data/disaster.data'
import { useTheme } from '@/components/common/ThemeProvider'
import { Map, MapControls } from '@/components/ui/map'

function Chip({ children, color = '#64748B', style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 999, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em',
      background: `${color}1a`, border: `1px solid ${color}44`, color, whiteSpace: 'nowrap', ...style,
    }}>
      {children}
    </span>
  )
}

export default function MainMap({ camps, selected, onSelect, statusCounts, error, mapNodes }) {
  const { mode, T } = useTheme()
  const dark = mode === 'dark'

  const hudInk = dark ? '#f0f7ff' : '#0f2336'
  const hudMuted = dark ? 'rgba(214,235,250,0.72)' : 'rgba(47,84,112,0.75)'
  const hudCardBg = dark ? 'rgba(4,10,17,0.72)' : 'rgba(255,255,255,0.85)'
  const hudCardBorder = dark ? 'rgba(255,255,255,0.1)' : 'rgba(60,110,150,0.18)'

  const selectedCamp = camps?.find((c) => c.id === selected)

  return (
    <div
      className="relative overflow-hidden rounded-[1.75rem] min-h-[640px] max-xl:min-h-[460px] max-sm:min-h-[400px]"
      style={{
        background: dark ? '#030c18' : '#ddeaf5',
        border: dark ? '1px solid rgba(80,140,190,0.22)' : `1px solid ${T.border}`,
      }}
    >
      <Map
        center={[81.5, 7.8]}
        zoom={6}
        className="absolute inset-0"
      >
        <MapControls showZoom showLocate />
      </Map>

      {/* HUD title */}
      <div className="absolute z-[13] pointer-events-none top-[25px] left-[58px] max-w-[420px]">
        <div className="flex items-center gap-[6px] text-[12px] font-extrabold uppercase tracking-[0.16em] mb-1" style={{ color: dark ? '#22d3ee' : '#0891b2' }}>
          <Crosshair size={14} /> Relief Operations Grid
        </div>
        <div className="text-[0.68rem] font-semibold mt-[2px]" style={{ color: hudMuted, textShadow: dark ? '0 1px 8px rgba(0,0,0,0.5)' : 'none' }}>
          Terrain reference aligned with live camp nodes · drag to pan · scroll to zoom
        </div>
      </div>

      {/* HUD live */}
      <div className="absolute z-[13] pointer-events-none top-[30px] right-4 flex items-center gap-2">
        <Chip color={dark ? '#22d3ee' : '#0891b2'} style={{ background: dark ? 'rgba(34,211,238,0.12)' : 'rgba(8,145,178,0.12)', border: `1px solid ${dark ? 'rgba(34,211,238,0.4)' : 'rgba(8,145,178,0.4)'}` }}>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: dark ? '#22d3ee' : '#0891b2', boxShadow: `0 0 8px ${dark ? '#22d3ee' : '#0891b2'}` }} />
          LIVE MAP
        </Chip>
        <Chip color={error ? T.red : dark ? '#4ade80' : '#16a34a'} style={{ background: hudCardBg, border: `1px solid ${hudCardBorder}` }}>
          {error ? 'DEGRADED' : `${mapNodes.length} NODES`}
        </Chip>
      </div>

      {/* HUD legend */}
      <div className="absolute z-[13] pointer-events-none bottom-[10px] right-4 flex items-center gap-[9px] flex-wrap rounded-xl px-[10px] py-[7px] backdrop-blur-[10px]" style={{ background: hudCardBg, border: `1px solid ${hudCardBorder}` }}>
        {['critical', 'high', 'medium', 'stable', 'recovery'].map((status) => (
          <span key={status} className="flex items-center gap-[5px] text-[9px]">
            <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: STATUS_COLOR[status], boxShadow: `0 0 6px ${STATUS_COLOR[status]}` }} />
            <span className="capitalize tracking-[0.06em]" style={{ color: hudInk }}>{status}</span>
            <span className="text-[8px] font-mono" style={{ color: 'rgba(60,100,130,0.6)' }}>{statusCounts[status] || 0}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
