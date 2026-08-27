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

/**
 * GaugingChart — Line chart with area fill showing water level history
 * from the nearest gauging station. Includes alert threshold lines.
 *
 * Props:
 *   points  - Array of { water_level, timestamp } objects
 *   alertL  - Alert water level threshold
 *   minorL  - Minor flood threshold
 *   majorL  - Major flood threshold
 *   theme   - Current theme object
 *   station - Station name (displayed in header)
 */
export function GaugingChart({ points = [], alertL, minorL, majorL, theme, station }) {
  const width = 520
  const height = 200
  const padding = { top: 20, right: 16, bottom: 32, left: 42 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  if (points.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: theme.muted, fontSize: 12, fontWeight: 600 }}>
        No gauging data available
      </div>
    )
  }

  const values = points.map((p) => p.water_level)
  const allThresholds = [alertL, minorL, majorL].filter((v) => v != null)
  const minVal = Math.min(...values, ...allThresholds, 0)
  const maxVal = Math.max(...values, ...allThresholds)
  const range = maxVal - minVal || 1

  const x = (i) => padding.left + (i / (points.length - 1)) * chartW
  const y = (v) => padding.top + chartH - ((v - minVal) / range) * chartH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.water_level)}`).join(' ')
  const areaPath = `${linePath} L${x(points.length - 1)},${padding.top + chartH} L${x(0)},${padding.top + chartH} Z`

  const thresholdLines = [
    { val: majorL, color: theme.red, label: 'Major', dash: '6,3' },
    { val: minorL, color: theme.amber, label: 'Minor', dash: '4,3' },
    { val: alertL, color: '#D97706', label: 'Alert', dash: '3,3' },
  ].filter((t) => t.val != null)

  return (
    <div style={{ width: '100%' }}>
      {station && (
        <div style={{ fontSize: 10, fontWeight: 700, color: theme.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          {station} Station — Water Level History
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 200 }}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.teal} stopOpacity="0.25" />
            <stop offset="100%" stopColor={theme.teal} stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="gaugeClip">
            <rect x={padding.left} y={padding.top} width={chartW} height={chartH} />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const val = minVal + range * pct
          const yPos = y(val)
          return (
            <g key={pct}>
              <line x1={padding.left} y1={yPos} x2={padding.left + chartW} y2={yPos} stroke={theme.border} strokeWidth="0.5" />
              <text x={padding.left - 6} y={yPos + 3} textAnchor="end" fontSize="8" fill={theme.muted} fontFamily="Inter, sans-serif">{val.toFixed(1)}</text>
            </g>
          )
        })}

        {/* Vertical column lines at each data point */}
        {points.map((p, i) => (
          <line key={`col-${i}`} x1={x(i)} y1={padding.top} x2={x(i)} y2={padding.top + chartH} stroke={theme.border} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
        ))}

        {/* Threshold lines */}
        {thresholdLines.map((t) => (
          <g key={t.label}>
            <line x1={padding.left} y1={y(t.val)} x2={padding.left + chartW} y2={y(t.val)} stroke={t.color} strokeWidth="1" strokeDasharray={t.dash} opacity="0.7" />
            <rect x={padding.left + chartW - 38} y={y(t.val) - 8} width={36} height={14} rx={3} fill={t.color} opacity="0.85" />
            <text x={padding.left + chartW - 20} y={y(t.val) + 2} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700" fontFamily="Inter, sans-serif">{t.label}</text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#gaugeGrad)" clipPath="url(#gaugeClip)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={theme.teal} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${theme.teal}50)` }} clipPath="url(#gaugeClip)" />

        {/* Data points with value labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.water_level)} r="2.5" fill={theme.teal} stroke={theme.card} strokeWidth="1" />
            <text x={x(i)} y={y(p.water_level) - 6} textAnchor="middle" fontSize="6.5" fill={theme.teal} fontWeight="700" fontFamily="Inter, sans-serif">
              {p.water_level.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Last point highlight */}
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].water_level)} r="4" fill={theme.teal} stroke="#fff" strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 4px ${theme.teal}80)` }} />

        {/* Time labels */}
        {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 5)) === 0 || i === points.length - 1).map((p, idx) => (
          <text key={idx} x={x(points.indexOf(p))} y={height - 8} textAnchor="middle" fontSize="7" fill={theme.muted} fontFamily="Inter, sans-serif">
            {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </text>
        ))}
      </svg>
    </div>
  )
}

/**
 * WaterLevelBarChart — Modern bar chart with line overlay showing
 * current water level relative to alert thresholds.
 *
 * Props:
 *   currentWl - Current water level value
 *   alertL    - Alert threshold
 *   minorL    - Minor flood threshold
 *   majorL    - Major flood threshold
 *   station   - Station name
 *   theme     - Current theme object
 */
export function WaterLevelBarChart({ currentWl, alertL, minorL, majorL, station, theme }) {
  const width = 520
  const height = 200
  const padding = { top: 24, right: 20, bottom: 32, left: 48 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  if (currentWl == null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: height, color: theme.muted, fontSize: 12, fontWeight: 600 }}>
        No water level data
      </div>
    )
  }

  const wl = Number(currentWl)
  const thresholds = [alertL, minorL, majorL].filter((v) => v != null).map(Number)
  const maxVal = Math.max(wl, ...thresholds, 1) * 1.15
  const minVal = Math.min(0, wl, ...thresholds) - 0.5
  const range = maxVal - minVal || 1

  const y = (v) => padding.top + chartH - ((v - minVal) / range) * chartH
  const barWidth = 48
  const barX = padding.left + chartW / 2 - barWidth / 2
  const barTop = y(wl)
  const barBottom = y(0)
  const barH = barBottom - barTop

  const wlColor = wl >= (majorL || 999) ? theme.red : wl >= (minorL || 999) ? theme.amber : wl >= (alertL || 999) ? '#D97706' : theme.teal

  const thresholdLines = [
    { val: majorL, color: theme.red, label: 'Major', dash: '6,3' },
    { val: minorL, color: theme.amber, label: 'Minor', dash: '4,3' },
    { val: alertL, color: '#D97706', label: 'Alert', dash: '3,3' },
  ].filter((t) => t.val != null)

  return (
    <div style={{ width: '100%' }}>
      {station && (
        <div style={{ fontSize: 10, fontWeight: 700, color: theme.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          {station} — Current Water Level
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }}>
        <defs>
          <linearGradient id="wlBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={wlColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={wlColor} stopOpacity="0.5" />
          </linearGradient>
          <filter id="wlGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const val = minVal + range * pct
          const yPos = y(val)
          return (
            <g key={pct}>
              <line x1={padding.left} y1={yPos} x2={padding.left + chartW} y2={yPos} stroke={theme.border} strokeWidth="0.5" />
              <text x={padding.left - 6} y={yPos + 3} textAnchor="end" fontSize="8" fill={theme.muted} fontFamily="Inter, sans-serif">{val.toFixed(1)}m</text>
            </g>
          )
        })}

        {/* Zero line */}
        <line x1={padding.left} y1={y(0)} x2={padding.left + chartW} y2={y(0)} stroke={theme.muted} strokeWidth="1" opacity="0.4" />

        {/* Threshold lines */}
        {thresholdLines.map((t) => (
          <g key={t.label}>
            <line x1={padding.left} y1={y(t.val)} x2={padding.left + chartW} y2={y(t.val)} stroke={t.color} strokeWidth="1.2" strokeDasharray={t.dash} opacity="0.7" />
            <rect x={padding.left + chartW - 40} y={y(t.val) - 8} width={38} height={14} rx={3} fill={t.color} opacity="0.9" />
            <text x={padding.left + chartW - 21} y={y(t.val) + 2} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700" fontFamily="Inter, sans-serif">{t.label} {t.val}m</text>
          </g>
        ))}

        {/* Bar background track */}
        <rect x={barX} y={padding.top} width={barWidth} height={chartH} rx={6} fill={theme.cardSoft} stroke={theme.border} strokeWidth="0.5" />

        {/* Water level bar */}
        <rect x={barX} y={barTop} width={barWidth} height={Math.max(barH, 2)} rx={6} fill="url(#wlBarGrad)" filter="url(#wlGlow)" />

        {/* Water level line overlay */}
        <line x1={barX - 16} y1={barTop} x2={barX + barWidth + 16} y2={barTop} stroke={wlColor} strokeWidth="2" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${wlColor}80)` }} />

        {/* Current value label */}
        <rect x={barX + barWidth + 8} y={barTop - 10} width={44} height={20} rx={6} fill={wlColor} />
        <text x={barX + barWidth + 30} y={barTop + 4} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="800" fontFamily="Inter, sans-serif">{wl.toFixed(2)}m</text>

        {/* Side indicator dots for thresholds */}
        {thresholdLines.map((t) => (
          <circle key={t.label} cx={barX - 10} cy={y(t.val)} r="3" fill={t.color} stroke={theme.card} strokeWidth="1" />
        ))}
      </svg>
    </div>
  )
}
