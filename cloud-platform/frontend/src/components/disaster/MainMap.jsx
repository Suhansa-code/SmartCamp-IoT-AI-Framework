'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Box, Layers, Mountain } from 'lucide-react'
import * as MapLibreGL from 'maplibre-gl'
import { STATUS_COLOR } from '@/data/disaster.data'
import { useTheme } from '@/components/common/ThemeProvider'
import { Map, MapControls, MapArc, useMap } from '@/components/ui/map'

export const COLOMBO_HUB = { name: 'Colombo Hub', lat: 6.9271, lng: 79.8612 }

const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const TERRAIN_SOURCE = 'disaster-terrain-dem'
const TERRAIN_EXAGGERATION = 1.5

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

function MapViewController({ is3D }) {
  const { map, isLoaded } = useMap()

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

function TerrainSetup({ is3D, onTerrainReady }) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return

    if (is3D) {
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
      setTimeout(() => onTerrainReady?.(true), 500)
    } else {
      map.setTerrain(null)
      onTerrainReady?.(false)
    }
  }, [map, isLoaded, is3D, onTerrainReady])

  return null
}

function ElevationProvider({ camps, children }) {
  const { map, isLoaded } = useMap()
  const [elevations, setElevations] = useState({})
  const cacheRef = useRef({})

  const validCamps = useMemo(() => {
    if (!camps) return []
    return camps.filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
  }, [camps])

  useEffect(() => {
    if (!map || !isLoaded || !validCamps.length) return

    let cancelled = false

    const queryElevations = async () => {
      const results = {}
      for (const camp of validCamps) {
        const key = `${camp.lng.toFixed(4)},${camp.lat.toFixed(4)}`
        if (cacheRef.current[key] !== undefined) {
          results[camp.id] = cacheRef.current[key]
          continue
        }

        try {
          const elev = map.queryTerrainElevation([camp.lng, camp.lat])
          const value = typeof elev === 'number' && !isNaN(elev) ? Math.round(elev) : null
          cacheRef.current[key] = value
          results[camp.id] = value
        } catch {
          cacheRef.current[key] = null
          results[camp.id] = null
        }
      }
      if (!cancelled) setElevations(results)
    }

    const timer = setTimeout(queryElevations, 1500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [map, isLoaded, validCamps])

  return (
    <ElevationContext.Provider value={elevations}>
      {children}
    </ElevationContext.Provider>
  )
}

function CampMarkers({ camps, selected, onSelect }) {
  const { map, isLoaded } = useMap()
  const elevations = useContext(ElevationContext)
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

    const elev = elevations[camp.id]
    const statusColor = STATUS_COLOR[camp.status] || '#64748B'

    const popup = new MapLibreGL.Popup({
      offset: 20,
      closeButton: true,
      closeOnClick: false,
      maxWidth: '280px',
    })
      .setLngLat([camp.lng, camp.lat])
      .setHTML(`
        <div style="font-family:'Inter',sans-serif;padding:4px 0;min-width:180px">
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
                ${elev !== null && elev !== undefined ? `${elev} m AMSL` : 'Elevation unavailable'}
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
  }, [map, isLoaded, selected, validCamps, elevations])

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
  const [is3D, setIs3D] = useState(false)
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

  const toggle3D = useCallback(() => setIs3D((v) => !v), [])

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
        <MapViewController is3D={is3D} />
        <TerrainSetup is3D={is3D} onTerrainReady={setTerrainReady} />

        {/* Arc layer — solid blue curved lines behind markers */}
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

        <ElevationProvider camps={camps}>
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

      {/* HUD live + 3D toggle */}
      <div className="absolute z-[13] pointer-events-auto top-[15px] right-4 flex items-center gap-2">
        <button
          onClick={toggle3D}
          title={is3D ? 'Switch to 2D flat view' : 'Switch to 3D terrain view'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999, fontSize: '0.6rem', fontWeight: 800,
            letterSpacing: '0.06em', cursor: 'pointer', border: 'none',
            background: is3D ? (dark ? 'rgba(34,211,238,0.2)' : 'rgba(8,145,178,0.18)') : hudCardBg,
            color: is3D ? (dark ? '#22d3ee' : '#0891b2') : T.muted,
            border: `1px solid ${is3D ? (dark ? 'rgba(34,211,238,0.4)' : 'rgba(8,145,178,0.4)') : hudCardBorder}`,
            transition: 'all 0.2s ease',
          }}
        >
          {is3D ? <Box size={12} /> : <Layers size={12} />}
          {is3D ? '3D' : '2D'}
        </button>
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
        {is3D && (
          <span className="flex items-center gap-[5px] text-[9px]">
            <Mountain size={10} style={{ color: '#0891b2' }} />
            <span className="tracking-[0.06em]" style={{ color: hudInk }}>
              {terrainReady ? 'Terrain 1.5x' : 'Loading terrain…'}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
