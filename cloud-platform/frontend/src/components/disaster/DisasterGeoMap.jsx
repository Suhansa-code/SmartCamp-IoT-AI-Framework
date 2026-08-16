'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { statusColor } from './disasterData'

const COAST = [[9.84, 80.15], [9.78, 80.27], [9.70, 80.37], [9.62, 80.44], [9.55, 80.48], [9.45, 80.56], [9.35, 80.61], [9.20, 80.68], [9.08, 80.73], [8.98, 80.79], [8.85, 80.84], [8.72, 80.87], [8.58, 80.89], [8.42, 80.92], [8.28, 80.94], [8.15, 80.90], [8.00, 80.87], [7.90, 80.80], [7.78, 80.72], [7.65, 80.66], [7.52, 80.60], [7.38, 80.52], [7.22, 80.42], [7.08, 80.35], [6.95, 80.25], [6.82, 80.12], [6.70, 79.98], [6.60, 79.88], [6.50, 79.82], [6.42, 79.78], [6.30, 79.73], [6.20, 79.77], [6.12, 79.82], [6.05, 79.88], [5.98, 79.96], [5.93, 80.05], [5.90, 80.15], [5.92, 80.25], [5.95, 80.35], [6.00, 80.45], [6.08, 80.55], [6.18, 80.65], [6.30, 80.75], [6.42, 80.83], [6.55, 80.90], [6.65, 80.95], [6.75, 81.00], [6.88, 81.05], [7.02, 81.10], [7.18, 81.12], [7.32, 81.15], [7.48, 81.17], [7.62, 81.18], [7.75, 81.20], [7.88, 81.22], [8.02, 81.24], [8.15, 81.25], [8.28, 81.22], [8.40, 81.20], [8.52, 81.15], [8.62, 81.10], [8.72, 81.05], [8.82, 81.00], [8.92, 80.95], [9.02, 80.88], [9.12, 80.82], [9.22, 80.75], [9.32, 80.70], [9.42, 80.65], [9.52, 80.60], [9.60, 80.52], [9.68, 80.44], [9.74, 80.36], [9.79, 80.28], [9.84, 80.15]]
const PROVS = [[[9.67, 80.01], [8.76, 80.50]], [[8.76, 80.50], [8.34, 80.41]], [[8.34, 80.41], [7.48, 80.37]], [[7.48, 80.37], [7.29, 80.64]], [[7.29, 80.64], [6.92, 79.86]], [[7.29, 80.64], [7.30, 81.50]], [[8.34, 80.41], [8.58, 81.22]], [[7.48, 80.37], [6.68, 80.40]], [[6.68, 80.40], [6.03, 80.22]]]

function project(lat, lng, width, height, pad = 44) {
  const x = pad + ((lng - 79.5) / 2.5) * (width - pad * 2)
  const y = (height - pad * 0.8) - ((lat - 5.7) / 4.4) * (height - pad * 1.6)
  return [x, y]
}

export function DisasterGeoMap({ camps, selected, onSelect, theme }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(0)
  const frameRef = useRef(0)
  const bgImageRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)

  const proj = useCallback((lat, lng, width, height) => project(lat, lng, width, height, 44), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      const { width, height } = canvas.parentElement.getBoundingClientRect()
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas.parentElement)

    // Load background image (switch between light/dark variants)
    const bgImage = new Image()
    bgImage.src = theme.mode === 'light' ? '/disaster/central_img-light.png' : '/disaster/central_img.png'
    bgImage.onload = () => {
      bgImageRef.current = bgImage
    }

    const draw = () => {
      frameRef.current += 1
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      const centerX = width / 2
      const centerY = height / 2

      ctx.translate(centerX + panX, centerY + panY)
      ctx.scale(zoom, zoom)
      ctx.translate(-centerX, -centerY)

      // Draw background image or fallback color
      if (bgImageRef.current) {
        ctx.drawImage(bgImageRef.current, 0, 0, width, height)
      } else {
        ctx.fillStyle = theme.mapBg
        ctx.fillRect(0, 0, width, height)
      }

      if (theme.mode === 'dark') {
        ctx.fillStyle = '#07182a'
        for (let gx = 0; gx <= width; gx += 20) {
          for (let gy = 0; gy <= height; gy += 20) {
            ctx.fillRect(gx, gy, 1, 1)
          }
        }
      }

      ctx.strokeStyle = theme.mapGrid
      ctx.lineWidth = 0.5
      for (let lat = 6; lat <= 10; lat++) {
        const [ax, ay] = proj(lat, 79.5, width, height)
        const [bx, by] = proj(lat, 82, width, height)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
      }
      for (let lng = 80; lng <= 82; lng++) {
        const [ax, ay] = proj(5.7, lng, width, height)
        const [bx, by] = proj(10, lng, width, height)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
      }

      ctx.fillStyle = theme.t3
      ctx.font = '9px Inter, sans-serif'
      ctx.textAlign = 'right'
      for (let lat = 6; lat <= 10; lat += 2) {
        const [ax, ay] = proj(lat, 79.5, width, height)
        ctx.fillText(`${lat}°N`, ax - 4, ay + 3)
      }
      ctx.textAlign = 'center'
      for (let lng = 80; lng <= 82; lng++) {
        const [ax, ay] = proj(5.7, lng, width, height)
        ctx.fillText(`${lng}°E`, ax, ay + 11)
      }

      ctx.setLineDash([3, 5])
      ctx.lineWidth = 0.6
      ctx.strokeStyle = theme.mode === 'dark' ? '#0b2030' : '#90b8d0'
      PROVS.forEach(([start, end]) => {
        const [ax, ay] = proj(start[0], start[1], width, height)
        const [bx, by] = proj(end[0], end[1], width, height)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
      })
      ctx.setLineDash([])

      if (selected) {
        const selectedCamp = camps.find((camp) => camp.id === selected)
        if (selectedCamp) {
          const [sx, sy] = proj(selectedCamp.lat, selectedCamp.lng, width, height)
          camps.filter((camp) => camp.id !== selected).forEach((camp) => {
            const [tx, ty] = proj(camp.lat, camp.lng, width, height)
            const gradient = ctx.createLinearGradient(sx, sy, tx, ty)
            gradient.addColorStop(0, `${theme.cyan}30`)
            gradient.addColorStop(1, `${theme.cyan}06`)
            ctx.strokeStyle = gradient
            ctx.lineWidth = 0.5
            ctx.setLineDash([3, 6])
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke()
          })
          ctx.setLineDash([])
        }
      }

      camps.forEach((camp) => {
        const [cx, cy] = proj(camp.lat, camp.lng, width, height)
        const color = statusColor(camp.status, theme)
        const isSelected = camp.id === selected
        const radius = 4
        
        // Border circle with 1px gap
        ctx.beginPath(); ctx.arc(cx, cy, radius + 1.5, 0, Math.PI * 2)
        ctx.strokeStyle = color
        ctx.lineWidth = 1.2
        ctx.stroke()
        
        // Center filled circle
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        
        // White center dot
        ctx.beginPath(); ctx.arc(cx, cy, 1, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fill()
        
        // Status label above point in rectangle
        const statusText = { critical: 'C', high: 'H', medium: 'M', stable: 'S', recovery: 'R' }[camp.status]
        ctx.font = '8px Inter, sans-serif'
        ctx.fillStyle = theme.t0
        ctx.textAlign = 'center'
        const labelY = cy - radius - 12
        ctx.fillStyle = color
        ctx.fillRect(cx - 8, labelY - 6, 16, 10)
        ctx.fillStyle = theme.bg
        ctx.fillRect(cx - 8, labelY - 6, 16, 10)
        ctx.strokeStyle = color
        ctx.lineWidth = 0.8
        ctx.lineJoin = 'round'
        ctx.strokeRect(cx - 8, labelY - 6, 16, 10)
        ctx.fillStyle = color
        ctx.fillText(statusText, cx, labelY + 2)
        
        // Camp code below point
        ctx.font = `${isSelected ? 8.5 : 8}px Inter, sans-serif`
        ctx.fillStyle = isSelected ? color : theme.t2
        ctx.textAlign = 'center'
        ctx.fillText(camp.code, cx, cy + radius + 10)
      })

      ctx.fillStyle = theme.t3
      ctx.font = '8px Inter, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('5.87°N–9.98°N  ·  79.65°E–81.95°E', 10, 14)
      const start = 10
      const end = start + 56
      const y2 = height - 14
      ctx.strokeStyle = theme.t2
      ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.moveTo(start, y2); ctx.lineTo(end, y2); ctx.stroke()
      ;[[start, y2], [end, y2]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke() })
      ctx.fillStyle = theme.t2
      ctx.textAlign = 'center'
      ctx.fillText('≈ 50 km', (start + end) / 2, y2 - 5)

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animationRef.current)
      observer.disconnect()
    }
  }, [camps, selected, proj, theme, zoom, panX, panY])

  const handleClick = useCallback((event) => {
    const canvas = canvasRef.current
    if (!canvas || isDragging) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    const width = canvas.width / dpr
    const height = canvas.height / dpr
    const centerX = width / 2
    const centerY = height / 2
    let hit = null

    camps.forEach((camp) => {
      const [cx, cy] = proj(camp.lat, camp.lng, width, height)
      const viewX = (cx - centerX) * zoom + centerX + panX
      const viewY = (cy - centerY) * zoom + centerY + panY
      if (Math.hypot(mouseX - viewX, mouseY - viewY) < 14 * zoom) hit = camp.id
    })

    onSelect(hit === selected ? null : hit)
  }, [camps, selected, onSelect, proj, isDragging, zoom, panX, panY])

    const handleMouseDown = useCallback((event) => {
      setIsDragging(true)
      setDragStart({ x: event.clientX, y: event.clientY })
    }, [])

    const handleMouseMove = useCallback((event) => {
      if (!isDragging || !dragStart) return
      const dx = event.clientX - dragStart.x
      const dy = event.clientY - dragStart.y
      setPanX((px) => px + dx)
      setPanY((py) => py + dy)
      setDragStart({ x: event.clientX, y: event.clientY })
    }, [isDragging, dragStart])

    const handleMouseUp = useCallback(() => {
      setIsDragging(false)
      setDragStart(null)
    }, [])

    const handleCenterMap = useCallback(() => {
      setZoom(1)
      setPanX(0)
      setPanY(0)
    }, [])

    return (
      <>
        <canvas 
          ref={canvasRef} 
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ display: 'block', width: '100%', height: '100%', cursor: isDragging ? 'grabbing' : 'crosshair' }} 
        />
        <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 10 }}>
          <button onClick={() => setZoom((z) => Math.min(3, z * 1.2))} style={{ width: 30, height: 30, background: `${theme.bg}e0`, border: `1px solid ${theme.border}`, color: theme.t1, fontSize: 14, fontFamily: 'Inter, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>+</button>
          <button onClick={() => setZoom((z) => Math.max(0.5, z * 0.85))} style={{ width: 30, height: 30, background: `${theme.bg}e0`, border: `1px solid ${theme.border}`, color: theme.t1, fontSize: 14, fontFamily: 'Inter, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>−</button>
          <button onClick={handleCenterMap} style={{ width: 30, height: 30, background: `${theme.bg}e0`, border: `1px solid ${theme.border}`, color: theme.t1, fontSize: 14, fontFamily: 'Inter, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>⊙</button>
        </div>
      </>
    )
}
