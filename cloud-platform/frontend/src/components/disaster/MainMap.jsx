'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Crosshair } from 'lucide-react'
import * as MapLibreGL from 'maplibre-gl'
import { STATUS_COLOR } from '@/data/disaster.data'
import { useTheme } from '@/components/common/ThemeProvider'
import { Map, MapControls, useMap } from '@/components/ui/map'

export const COLOMBO_HUB = { name: 'Colombo Hub', lat: 6.9271, lng: 79.8612 }

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

function buildArcCoordinates(from, to, curvature = 0.25, samples = 64) {
  const [x0, y0] = from
  const [xTo, y2] = to
  const rawDx = xTo - x0
  const x2 = rawDx > 180 ? xTo - 360 : rawDx < -180 ? xTo + 360 : xTo
  const dx = x2 - x0
  const dy = y2 - y0
  const distance = Math.hypot(dx, dy)
  if (distance === 0 || curvature === 0) return [from, [x2, y2]]

  const mx = (x0 + x2) / 2
  const my = (y0 + y2) / 2
  const nx = -dy / distance
  const ny = dx / distance
  const offset = distance * curvature
  const cx = mx + nx * offset
  const cy = my + ny * offset

  const points = []
  const segments = Math.max(2, Math.floor(samples))
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const inv = 1 - t
    points.push([
      inv * inv * x0 + 2 * inv * t * cx + t * t * x2,
      inv * inv * y0 + 2 * inv * t * cy + t * t * y2,
    ])
  }
  return points
}

function AnimatedArcs({ camps, dark }) {
  const { map, isLoaded } = useMap()
  const animRef = useRef(null)
  const offsetRef = useRef(0)
  const layerReadyRef = useRef(false)

  const arcData = useMemo(() => {
    if (!camps?.length) return []
    return camps
      .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
      .map((camp) => ({
        id: camp.id,
        status: camp.status,
        from: [camp.lng, camp.lat],
        to: [COLOMBO_HUB.lng, COLOMBO_HUB.lat],
      }))
  }, [camps])

  const geojson = useMemo(() => ({
    type: 'FeatureCollection',
    features: arcData.map((arc) => ({
      type: 'Feature',
      properties: { id: arc.id, status: arc.status },
      geometry: {
        type: 'LineString',
        coordinates: buildArcCoordinates(arc.from, arc.to, 0.25, 64),
      },
    })),
  }), [arcData])

  useEffect(() => {
    if (!map || !isLoaded || !geojson.features.length) return

    const sourceId = 'animated-arcs-source'
    const layerId = 'animated-arcs-layer'

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: geojson })
    } else {
      map.getSource(sourceId).setData(geojson)
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': [
            'match',
            ['get', 'status'],
            'critical', STATUS_COLOR.critical,
            'high', STATUS_COLOR.high,
            'medium', STATUS_COLOR.medium,
            'stable', STATUS_COLOR.stable,
            'recovery', STATUS_COLOR.recovery,
            dark ? '#4a90d9' : '#3b82f6',
          ],
          'line-width': 2,
          'line-opacity': 0.7,
          'line-dasharray': [0, 6, 3],
        },
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
      })
      layerReadyRef.current = true
    }

    let lastTime = performance.now()
    const animate = (time) => {
      const dt = (time - lastTime) / 1000
      lastTime = time
      offsetRef.current = (offsetRef.current + dt * 12) % 100

      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'line-dashoffset', -offsetRef.current)
      }
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
      layerReadyRef.current = false
    }
  }, [map, isLoaded, geojson, dark])

  return null
}

function CampMarkers({ camps, selected, onSelect, dark }) {
  const { map, isLoaded } = useMap()

  const validCamps = useMemo(() => {
    if (!camps) return []
    return camps.filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
  }, [camps])

  useEffect(() => {
    if (!map || !isLoaded) return

    const markers = validCamps.map((camp) => {
      const el = document.createElement('div')
      const color = STATUS_COLOR[camp.status] || '#64748B'
      const isSelected = selected === camp.id
      const size = isSelected ? 16 : 12
      el.style.cssText = `
        width:${size}px; height:${size}px; border-radius:50%;
        background:${color}; border:2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.6)'};
        box-shadow: 0 0 ${isSelected ? 16 : 8}px ${color}${isSelected ? 'cc' : '66'};
        cursor:pointer; transition: all 0.2s ease;
      `
      el.title = `${camp.name} (${camp.code})`
      el.addEventListener('click', () => onSelect(camp.id === selected ? null : camp.id))

      const marker = new MapLibreGL.Marker({ element: el })
      marker.setLngLat([camp.lng, camp.lat]).addTo(map)

      return { marker, id: camp.id }
    })

    return () => {
      markers.forEach(({ marker }) => marker.remove())
    }
  }, [map, isLoaded, validCamps, selected, onSelect])

  return null
}

function ColomboHubMarker() {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return

    const el = document.createElement('div')
    el.style.cssText = `
      width:24px; height:24px; border-radius:50%;
      background: radial-gradient(circle, #0891b2 30%, rgba(8,145,178,0.3) 70%, transparent 100%);
      border:3px solid #fff; box-shadow: 0 0 20px rgba(8,145,178,0.6), 0 0 40px rgba(8,145,178,0.3);
      cursor:default; position:relative;
    `
    const pulse = document.createElement('div')
    pulse.style.cssText = `
      position:absolute; inset:-8px; border-radius:50%;
      border:2px solid rgba(8,145,178,0.4);
      animation: hubPulse 2s ease-in-out infinite;
    `
    el.appendChild(pulse)

    const style = document.createElement('style')
    style.textContent = `@keyframes hubPulse { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.5);opacity:0} }`
    document.head.appendChild(style)

    const marker = new MapLibreGL.Marker({ element: el })
      .setLngLat([COLOMBO_HUB.lng, COLOMBO_HUB.lat])
      .addTo(map)

    return () => {
      marker.remove()
      style.remove()
    }
  }, [map, isLoaded])

  return null
}

export default function MainMap({ camps, selected, onSelect, statusCounts, error, mapNodes }) {
  const { mode, T } = useTheme()
  const dark = mode === 'dark'

  const hudInk = dark ? '#f0f7ff' : '#0f2336'
  const hudMuted = dark ? 'rgba(214,235,250,0.72)' : 'rgba(47,84,112,0.75)'
  const hudCardBg = dark ? 'rgba(4,10,17,0.72)' : 'rgba(255,255,255,0.85)'
  const hudCardBorder = dark ? 'rgba(255,255,255,0.1)' : 'rgba(60,110,150,0.18)'

  return (
    <div
      className="relative overflow-hidden rounded-[1.75rem] min-h-[640px] max-xl:min-h-[460px] max-sm:min-h-[400px]"
      style={{
        background: dark ? '#030c18' : '#ddeaf5',
        border: dark ? '1px solid rgba(80,140,190,0.22)' : `1px solid ${T.border}`,
      }}
    >
      <Map
        center={[80.5, 7.5]}
        zoom={6.5}
        className="absolute inset-0"
      >
        <MapControls showZoom showLocate />
        <AnimatedArcs camps={camps} dark={dark} />
        <CampMarkers camps={camps} selected={selected} onSelect={onSelect} dark={dark} />
        <ColomboHubMarker />
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
        <span className="flex items-center gap-[5px] text-[9px]">
          <span className="w-[8px] h-[8px] rounded-full shrink-0" style={{ background: '#0891b2', boxShadow: '0 0 8px #0891b2', border: '1.5px solid #fff' }} />
          <span className="tracking-[0.06em]" style={{ color: hudInk }}>Hub</span>
        </span>
      </div>
    </div>
  )
}
