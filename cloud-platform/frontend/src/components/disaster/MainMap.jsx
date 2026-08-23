'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Box, Layers, Mountain, Triangle } from 'lucide-react'
import * as MapLibreGL from 'maplibre-gl'
import { STATUS_COLOR } from '@/data/disaster.data'
import { useTheme } from '@/components/common/ThemeProvider'
import { Map, MapControls, MapArc, useMap } from '@/components/ui/map'

export const COLOMBO_HUB = { name: 'Colombo Hub', lat: 6.9271, lng: 79.8612 }

const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const TERRAIN_SOURCE = 'disaster-terrain-dem'
const TERRAIN_EXAGGERATION = 1.5
const HILLSHADE_LAYER = 'disaster-hillshade'

const VIEW_MODES = ['2d', '3d', 'terrain', 'slope']

const ElevationContext = createContext({})

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

function MapViewController({ viewMode }) {
  const { map, isLoaded } = useMap()
  const is3D = viewMode !== '2d'

  useEffect(() => {
    if (!map || !isLoaded) return
    map.easeTo({
      pitch: is3D ? 55 : 0,
      bearing: is3D ? 25 : 0,
      duration: 800,
      easing: (t) => t * (2 - t),
    })
  }, [map, isLoaded, is3D])

  return null
}

function TerrainSetup({ viewMode, onTerrainReady }) {
  const { map, isLoaded } = useMap()
  const enableTerrain = viewMode !== '2d'
  const enableHillshade = viewMode === 'terrain' || viewMode === 'slope'

  useEffect(() => {
    if (!map || !isLoaded) return

    if (enableTerrain) {
      if (!map.getSource(TERRAIN_SOURCE)) {
        map.addSource(TERRAIN_SOURCE, {
          type: 'raster-dem',
          url: TERRAIN_TILES,
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 12,
        })
      }

      map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION })

      if (enableHillshade && !map.getLayer(HILLSHADE_LAYER)) {
        const isSlope = viewMode === 'slope'
        map.addLayer({
          id: HILLSHADE_LAYER,
          type: 'hillshade',
          source: TERRAIN_SOURCE,
          paint: {
            'hillshade-exaggeration': isSlope ? 2.0 : 1.2,
            'hillshade-shadow-color': isSlope ? '#1e293b' : '#334155',
            'hillshade-highlight-color': isSlope ? '#fef3c7' : '#e2e8f0',
            'hillshade-accent-color': isSlope ? '#f59e0b' : '#94a3b8',
            'hillshade-z-offset': 0,
          },
        }, 'waterway')
      } else if (!enableHillshade && map.getLayer(HILLSHADE_LAYER)) {
        map.removeLayer(HILLSHADE_LAYER)
      }

      setTimeout(() => onTerrainReady?.(true), 500)
    } else {
      map.setTerrain(null)
      if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER)
      onTerrainReady?.(false)
    }
  }, [map, isLoaded, enableTerrain, enableHillshade, viewMode, onTerrainReady])

  return null
}

function ElevationProvider({ camps, viewMode, children }) {
  const { map, isLoaded } = useMap()
  const [elevData, setElevData] = useState({})
  const cacheRef = useRef({})
  const enableTerrain = viewMode !== '2d'

  const validCamps = useMemo(() => {
    if (!camps) return []
    return camps.filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
  }, [camps])

  useEffect(() => {
    if (!map || !isLoaded || !enableTerrain || !validCamps.length) return

    let cancelled = false

    const queryData = async () => {
      const results = {}
      for (const camp of validCamps) {
        const key = `${camp.lng.toFixed(4)},${camp.lat.toFixed(4)}`
        if (cacheRef.current[key] !== undefined) {
          results[camp.id] = cacheRef.current[key]
          continue
        }

        try {
          const elev = map.queryTerrainElevation([camp.lng, camp.lat])
          const elevValue = typeof elev === 'number' && !isNaN(elev) ? Math.round(elev) : null

          let slopeValue = null
          if (elevValue !== null) {
            const offset = 0.0005
            const n = map.queryTerrainElevation([camp.lng, camp.lat + offset])
            const s = map.queryTerrainElevation([camp.lng, camp.lat - offset])
            const e = map.queryTerrainElevation([camp.lng + offset, camp.lat])
            const w = map.queryTerrainElevation([camp.lng - offset, camp.lat])
            if ([n, s, e, w].every((v) => typeof v === 'number' && !isNaN(v))) {
              const dist = 111320 * offset
              const dx = (e - w) / (2 * dist)
              const dy = (n - s) / (2 * dist)
              slopeValue = Math.round(Math.atan(Math.sqrt(dx * dx + dy * dy)) * (180 / Math.PI))
            }
          }

          const data = { elevation: elevValue, slope: slopeValue }
          cacheRef.current[key] = data
          results[camp.id] = data
        } catch {
          cacheRef.current[key] = { elevation: null, slope: null }
          results[camp.id] = { elevation: null, slope: null }
        }
      }
      if (!cancelled) setElevData(results)
    }

    const timer = setTimeout(queryData, 1500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [map, isLoaded, enableTerrain, validCamps])

  return (
    <ElevationContext.Provider value={elevData}>
      {children}
    </ElevationContext.Provider>
  )
}

function CampMarkers({ camps, selected, onSelect }) {
  const { map, isLoaded } = useMap()
  const elevData = useContext(ElevationContext)
  const popupsRef = useRef({})

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

  useEffect(() => {
    if (!map || !isLoaded) return

    Object.values(popupsRef.current).forEach((p) => p.remove())
    popupsRef.current = {}

    if (!selected) return

    const camp = validCamps.find((c) => c.id === selected)
    if (!camp) return

    const data = elevData[camp.id] || {}
    const elev = data.elevation
    const slope = data.slope
    const statusColor = STATUS_COLOR[camp.status] || '#64748B'

    const slopeLabel = slope !== null && slope !== undefined
      ? `${slope}° — ${slope < 5 ? 'Flat' : slope < 15 ? 'Gentle' : slope < 25 ? 'Moderate' : slope < 35 ? 'Steep' : 'Very steep'}`
      : 'Unavailable'

    const popup = new MapLibreGL.Popup({
      offset: 20,
      closeButton: true,
      closeOnClick: false,
      maxWidth: '300px',
    })
      .setLngLat([camp.lng, camp.lat])
      .setHTML(`
        <div style="font-family:'Inter',sans-serif;padding:4px 0;min-width:200px">
          <div style="font-size:0.82rem;font-weight:800;color:#0f2336;margin-bottom:6px;display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};box-shadow:0 0 6px ${statusColor};flex-shrink:0"></span>
            ${camp.name}
          </div>
          <div style="font-size:0.68rem;color:#64748b;line-height:1.6">
            <div style="display:flex;justify-content:space-between;gap:12px">
              <span style="font-weight:600">Code</span>
              <span style="font-weight:700;color:#0f2336">${camp.code}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px">
              <span style="font-weight:600">Type</span>
              <span style="font-weight:700;color:#0f2336">${camp.type}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px">
              <span style="font-weight:600">Latitude</span>
              <span style="font-weight:700;color:#0f2336;font-family:monospace">${camp.lat.toFixed(4)}°</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px">
              <span style="font-weight:600">Longitude</span>
              <span style="font-weight:700;color:#0f2336;font-family:monospace">${camp.lng.toFixed(4)}°</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e5e7eb;padding-top:4px;margin-top:4px">
              <span style="font-weight:600">Elevation</span>
              <span style="font-weight:700;color:${elev !== null && elev !== undefined ? '#0891b2' : '#9ca3af'};font-family:monospace">
                ${elev !== null && elev !== undefined ? `${elev} m AMSL` : 'Unavailable'}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px">
              <span style="font-weight:600">Slope</span>
              <span style="font-weight:700;color:${slope !== null && slope !== undefined ? '#0891b2' : '#9ca3af'};font-family:monospace">
                ${slopeLabel}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px">
              <span style="font-weight:600">Status</span>
              <span style="font-weight:700;color:${statusColor}">${camp.status.toUpperCase()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px">
              <span style="font-weight:600">Displaced</span>
              <span style="font-weight:700;color:#0f2336">${camp.displaced.toLocaleString()}</span>
            </div>
          </div>
        </div>
      `)
      .addTo(map)

    popupsRef.current = { [camp.id]: popup }

    return () => {
      Object.values(popupsRef.current).forEach((p) => p.remove())
      popupsRef.current = {}
    }
  }, [map, isLoaded, selected, validCamps, elevData])

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

    const popup = new MapLibreGL.Popup({ offset: 16, closeButton: false, closeOnClick: false })
      .setLngLat([COLOMBO_HUB.lng, COLOMBO_HUB.lat])
      .setHTML(`
        <div style="font-family:'Inter',sans-serif;padding:2px 0;text-align:center">
          <div style="font-size:0.78rem;font-weight:800;color:#0891b2">Colombo Hub</div>
          <div style="font-size:0.62rem;color:#64748b;font-weight:600">Central Operations Center</div>
        </div>
      `)

    const marker = new MapLibreGL.Marker({ element: el })
      .setLngLat([COLOMBO_HUB.lng, COLOMBO_HUB.lat])
      .setPopup(popup)
      .addTo(map)

    return () => {
      marker.remove()
      popup.remove()
      style.remove()
    }
  }, [map, isLoaded])

  return null
}

export default function MainMap({ camps, selected, onSelect, statusCounts, error, mapNodes }) {
  const { mode, T } = useTheme()
  const dark = mode === 'dark'
  const [viewMode, setViewMode] = useState('2d')
  const [terrainReady, setTerrainReady] = useState(false)

  const hudInk = dark ? '#f0f7ff' : '#0f2336'
  const hudCardBg = dark ? 'rgba(4,10,17,0.72)' : 'rgba(255,255,255,0.85)'
  const hudCardBorder = dark ? 'rgba(255,255,255,0.1)' : 'rgba(60,110,150,0.18)'

  const arcData = useMemo(() => {
    if (!camps?.length) return []
    return camps
      .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
      .map((camp) => ({
        id: `camp-${camp.id}-colombo`,
        from: [camp.lng, camp.lat],
        to: [COLOMBO_HUB.lng, COLOMBO_HUB.lat],
      }))
  }, [camps])

  const cycleMode = useCallback(() => {
    setViewMode((prev) => {
      const idx = VIEW_MODES.indexOf(prev)
      return VIEW_MODES[(idx + 1) % VIEW_MODES.length]
    })
  }, [])

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
        <MapControls showZoom showLocate showCompass />
        <MapViewController viewMode={viewMode} />
        <TerrainSetup viewMode={viewMode} onTerrainReady={setTerrainReady} />

        {arcData.length > 0 && (
          <MapArc
            data={arcData}
            curvature={0.25}
            interactive={false}
            paint={{
              'line-color': dark ? 'rgba(56,189,248,0.55)' : 'rgba(14,116,144,0.5)',
              'line-width': 1.8,
              'line-opacity': 0.8,
            }}
          />
        )}

        <ElevationProvider camps={camps} viewMode={viewMode}>
          <CampMarkers camps={camps} selected={selected} onSelect={onSelect} />
        </ElevationProvider>
        <ColomboHubMarker />
      </Map>

      {/* HUD title */}
      <div className="absolute z-[13] pointer-events-none top-[15px] left-[20px] max-w-[420px]">
        <div className="flex items-center gap-[6px] text-[12px] font-extrabold uppercase tracking-[0.16em] mb-1" style={{ color: dark ? '#22d3ee' : '#0891b2' }}>
          <Crosshair size={14} /> Relief Operations Grid
        </div>
      </div>

      {/* HUD top-right: mode toggle + chips */}
      <div className="absolute z-[13] pointer-events-auto top-[15px] right-4 flex items-center gap-2">
        {/* View mode segmented control */}
        <div
          className="flex items-center rounded-full overflow-hidden"
          style={{ background: hudCardBg, border: `1px solid ${hudCardBorder}`, backdropFilter: 'blur(10px)' }}
        >
          {VIEW_MODES.map((m) => {
            const active = viewMode === m
            const icon = m === '2d' ? <Layers size={10} /> : m === '3d' ? <Box size={10} /> : m === 'terrain' ? <Mountain size={10} /> : <Triangle size={10} />
            return (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                title={m === '2d' ? '2D flat view' : m === '3d' ? '3D perspective' : m === 'terrain' ? '3D terrain shading' : '3D slope analysis'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  padding: '4px 8px', fontSize: '0.55rem', fontWeight: 800,
                  letterSpacing: '0.06em', cursor: 'pointer', border: 'none',
                  background: active ? (dark ? 'rgba(34,211,238,0.2)' : 'rgba(8,145,178,0.18)') : 'transparent',
                  color: active ? (dark ? '#22d3ee' : '#0891b2') : T.muted,
                  transition: 'all 0.2s ease',
                  borderRadius: 999,
                  margin: active ? 1 : 0,
                }}
                suppressHydrationWarning
              >
                {icon}
                {m.toUpperCase()}
              </button>
            )
          })}
        </div>

        <Chip color={dark ? '#22d3ee' : '#0891b2'} style={{ background: dark ? 'rgba(34,211,238,0.12)' : 'rgba(8,145,178,0.12)', border: `1px solid ${dark ? 'rgba(34,211,238,0.4)' : 'rgba(8,145,178,0.4)'}` }}>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: dark ? '#22d3ee' : '#0891b2', boxShadow: `0 0 8px ${dark ? '#22d3ee' : '#0891b2'}` }} />
          LIVE MAP
        </Chip>
        <Chip color={error ? T.red : dark ? '#4ade80' : '#16a34a'} style={{ background: hudCardBg, border: `1px solid ${hudCardBorder}` }}>
          {error ? 'DEGRADED' : `${mapNodes.length} NODES`}
        </Chip>
      </div>

      {/* HUD legend */}
      <div className="absolute z-[13] pointer-events-none bottom-[10px] left-4 flex items-center gap-[9px] flex-wrap rounded-xl px-[10px] py-[7px] backdrop-blur-[10px]" style={{ background: hudCardBg, border: `1px solid ${hudCardBorder}` }}>
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
        {viewMode !== '2d' && (
          <span className="flex items-center gap-[5px] text-[9px]">
            <Mountain size={10} style={{ color: '#0891b2' }} />
            <span className="tracking-[0.06em]" style={{ color: hudInk }}>
              {terrainReady
                ? (viewMode === 'slope' ? 'Slope 2x' : 'Terrain 1.5x')
                : 'Loading…'}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
