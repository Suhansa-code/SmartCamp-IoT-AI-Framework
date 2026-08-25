'use client'

import { useEffect, useRef } from 'react'

export function Sparkline({ data, color, w = 110, h = 26 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const minValue = Math.min(...data)
    const maxValue = Math.max(...data)
    const points = data.map((value, index) => [
      (index / (data.length - 1)) * w,
      h - ((value - minValue) / (maxValue - minValue + 1)) * h * 0.82 - 2,
    ])

    const area = new Path2D()
    area.moveTo(points[0][0], h)
    points.forEach(([x, y]) => area.lineTo(x, y))
    area.lineTo(points[points.length - 1][0], h)
    area.closePath()

    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, `${color}30`)
    gradient.addColorStop(1, `${color}00`)
    ctx.fillStyle = gradient
    ctx.fill(area)

    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.strokeStyle = color
    ctx.lineWidth = 1.1
    ctx.shadowColor = color
    ctx.shadowBlur = 3
    ctx.stroke()
  }, [data, color, w, h])

  return <canvas ref={ref} style={{ width: w, height: h, display: 'block' }} />
}

export function DonutChart({ segs, theme }) {
  const cx = 68
  const cy = 68
  const outerRadius = 54
  const innerRadius = 32
  let angle = -Math.PI / 2
  const hues = [theme.cyan, theme.t2, theme.t3, theme.border, theme.mapLand, theme.bg]

  const arcs = segs.map((segment, index) => {
    const arc = (segment.pct / 100) * 2 * Math.PI
    const point = (radius, currentAngle) => [cx + radius * Math.cos(currentAngle), cy + radius * Math.sin(currentAngle)]
    const [x1, y1] = point(outerRadius, angle)
    angle += arc
    const [x2, y2] = point(outerRadius, angle)
    const [ix1, iy1] = point(innerRadius, angle - arc)
    const [ix2, iy2] = point(innerRadius, angle)
    const largeArcFlag = arc > Math.PI ? 1 : 0

    return {
      ...segment,
      color: hues[index],
      d: `M${x1} ${y1}A${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}L${ix2} ${iy2}A${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1}Z`,
      mid: angle - arc / 2,
    }
  })

  return (
    <svg viewBox="0 0 136 136" style={{ width: 136, height: 136, flexShrink: 0 }}>
      <defs>
        <filter id="dgl2"><feGaussianBlur stdDeviation="1.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {arcs.map((arc, index) => <path key={index} d={arc.d} fill={arc.color} filter="url(#dgl2)" />)}
      {arcs.map((arc, index) => <line key={index} x1={cx + 34 * Math.cos(arc.mid)} y1={cy + 34 * Math.sin(arc.mid)} x2={cx + 57 * Math.cos(arc.mid)} y2={cy + 57 * Math.sin(arc.mid)} stroke={theme.bg} strokeWidth="1.5" />)}
      <circle cx={cx} cy={cy} r={innerRadius} fill={theme.bg} />
      <circle cx={cx} cy={cy} r={innerRadius - 1} fill="none" stroke={theme.border} strokeWidth="0.8" />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={theme.t2} fontSize="7" fontFamily="Inter, sans-serif" letterSpacing="0.5">DISASTER</text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill={theme.t2} fontSize="7" fontFamily="Inter, sans-serif" letterSpacing="0.5">TYPE</text>
    </svg>
  )
}

export function Ring({ value, label, color, theme }) {
  const radius = 20
  const circumference = 2 * Math.PI * radius

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={radius} fill="none" stroke={theme.border} strokeWidth="3.5" />
        <circle cx="26" cy="26" r={radius} fill="none" stroke={color} strokeWidth="3.5" strokeDasharray={circumference} strokeDashoffset={circumference - (value / 100) * circumference} strokeLinecap="butt" transform="rotate(-90 26 26)" style={{ filter: `drop-shadow(0 0 4px ${color}70)`, transition: 'stroke-dashoffset 1s ease' }} />
        <text x="26" y="30" textAnchor="middle" fill={theme.t0} fontSize="9.5" fontWeight="700" fontFamily="Inter, sans-serif">{value}</text>
      </svg>
      <span style={{ fontSize: 8, fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em', color: theme.t2 }}>{label}</span>
    </div>
  )
}

export function TrendChart({ data, color, theme }) {
  const width = 260
  const height = 62
  const minValue = Math.min(...data)
  const maxValue = Math.max(...data)
  const y = (value) => height - ((value - minValue) / (maxValue - minValue)) * height * 0.82 - 4
  const points = data.map((value, index) => [index / (data.length - 1) * width, y(value)])
  const area = `M${points[0][0]} ${height}` + points.map((point) => `L${point[0]} ${point[1]}`).join('') + `L${points[points.length - 1][0]} ${height}Z`
  const lastPoint = points[points.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={`tg${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#tg${color.slice(1)})`} />
      <polyline points={points.map((point) => point.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="1.1" style={{ filter: `drop-shadow(0 0 2px ${color}60)` }} />
      <line x1={lastPoint[0]} y1="0" x2={lastPoint[0]} y2={height} stroke={color} strokeWidth="0.6" strokeDasharray="2,3" strokeOpacity="0.5" />
      <rect x={lastPoint[0] - 14} y={lastPoint[1] - 8} width="28" height="12" rx="1" fill={color} />
      <text x={lastPoint[0]} y={lastPoint[1] + 0.5} textAnchor="middle" fill={theme.mode === 'dark' ? '#0F172A' : '#ffffff'} fontSize="7" fontFamily="Inter, sans-serif" fontWeight="700">{data[data.length - 1]}</text>
    </svg>
  )
}

export function ThemeToggle({ mode, onToggle, theme }) {
  return (
    <button
      onClick={onToggle}
      suppressHydrationWarning
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        border: `1px solid ${theme.borderHi}`,
        borderRadius: 999,
        cursor: 'pointer',
        background: theme.surface,
        fontFamily: 'Inter, sans-serif',
        fontSize: 10,
        fontWeight: 700,
        color: theme.t1,
        letterSpacing: '0.12em',
        transition: 'all 0.2s',
        boxShadow: mode === 'dark' ? `0 0 10px ${theme.cyan}15` : 'none',
      }}
    >
      <span style={{ fontSize: 13 }}>{mode === 'dark' ? '☀' : '🌙'}</span>
      {mode === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
    </button>
  )
}
