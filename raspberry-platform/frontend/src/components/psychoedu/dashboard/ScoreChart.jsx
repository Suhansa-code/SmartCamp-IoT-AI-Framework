import { useMemo } from 'react'

const W   = 480
const H   = 160
const PAD = { top: 20, right: 20, bottom: 32, left: 44 }

export default function ScoreChart({ data = [], darkMode = false }) {
  const textColor = darkMode ? '#94A3B8' : '#1E3A5F'
  const gridColor = darkMode ? '#2D4A70'  : '#E2E8F0'

  const points = useMemo(() => {
    if (!data.length) return []
    const xStep = (W - PAD.left - PAD.right) / Math.max(data.length - 1, 1)
    return data.map((d, i) => {
      const x   = PAD.left + i * xStep
      const pct = Math.max(0, Math.min(1, (d.score ?? d) / 100))
      const y   = PAD.top + (H - PAD.top - PAD.bottom) * (1 - pct)
      return { x, y, score: d.score ?? d, date: d.date ?? `S${i + 1}` }
    })
  }, [data])

  if (!data.length) {
    return (
      <div style={{ textAlign:'center', padding:'2rem', color: '#0D9488' }}>
        <p style={{ fontWeight:600 }}>No data yet · දත්ත නොමැත</p>
      </div>
    )
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const lastP  = points[points.length - 1]
  const firstP = points[0]
  const areaD  = `${pathD} L ${lastP.x} ${H - PAD.bottom} L ${firstP.x} ${H - PAD.bottom} Z`

  return (
    <div style={{ width:'100%', overflowX:'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxHeight:160 }} xmlns="http://www.w3.org/2000/svg">
        {/* Threshold bands */}
        <rect x={PAD.left} y={PAD.top} width={W-PAD.left-PAD.right} height={(H-PAD.top-PAD.bottom)*0.3} fill="#DCFCE7" opacity="0.35" />
        <rect x={PAD.left} y={PAD.top+(H-PAD.top-PAD.bottom)*0.3} width={W-PAD.left-PAD.right} height={(H-PAD.top-PAD.bottom)*0.3} fill="#FEF3C7" opacity="0.35" />
        <rect x={PAD.left} y={PAD.top+(H-PAD.top-PAD.bottom)*0.6} width={W-PAD.left-PAD.right} height={(H-PAD.top-PAD.bottom)*0.4} fill="#FEE2E2" opacity="0.25" />

        {/* Grid */}
        {[0, 50, 100].map(v => {
          const y = PAD.top + (H-PAD.top-PAD.bottom) * (1 - v/100)
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={W-PAD.right} y2={y} stroke={gridColor} strokeWidth="1" strokeDasharray="4 4" />
              <text x={PAD.left-6} y={y+4} textAnchor="end" fontSize="10" fill={textColor} opacity="0.6">{v}</text>
            </g>
          )
        })}

        {/* Area fill */}
        <path d={areaD} fill="#0D9488" opacity="0.07" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#0D9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5"
              fill={p.score >= 70 ? '#16A34A' : p.score >= 50 ? '#D97706' : '#DC2626'}
              stroke="white" strokeWidth="2"
            />
          </g>
        ))}

        {/* X labels */}
        {points.map((p, i) =>
          i % Math.max(1, Math.floor(points.length / 6)) === 0 ? (
            <text key={i} x={p.x} y={H-4} textAnchor="middle" fontSize="9" fill={textColor} opacity="0.55">
              {p.date}
            </text>
          ) : null
        )}
      </svg>

      {/* Legend */}
      <div style={{ display:'flex', gap:'1rem', justifyContent:'flex-end', marginTop:'4px', fontSize:'0.72rem', fontWeight:600 }}>
        <span style={{ color:'#16A34A' }}>● Good ≥70</span>
        <span style={{ color:'#D97706' }}>● Watch 50–70</span>
        <span style={{ color:'#DC2626' }}>● Alert &lt;50</span>
      </div>
    </div>
  )
}
