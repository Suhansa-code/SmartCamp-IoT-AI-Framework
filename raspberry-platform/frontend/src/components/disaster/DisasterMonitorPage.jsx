import { useState, useEffect } from 'react'
import {
  Droplets, Wind, MapPin, RefreshCw, Radar, Navigation, Satellite,
  CloudRain, Bell, Download, Cpu, Waves, Gauge as GaugeIcon, ArrowRight,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { COLORS, SHADOW_CARD } from '../../lib/tokens'

const RISK = {
  safe:     { label: 'Stable',   color: COLORS.brand },
  caution:  { label: 'Caution',  color: '#D97706' },
  warning:  { label: 'Warning',  color: '#EA580C' },
  critical: { label: 'Critical', color: '#DC2626' },
}

/* ------------------------------------------------------------------ */
/*  MOCK DATA — swap for real API responses                            */
/* ------------------------------------------------------------------ */


const GAUGING = {
  water_level: 2.35, alert_level: 2.0, minor_flood_level: 3.0, major_flood_level: 4.2,
  rainfall: 18.4,
  river: { name: 'Kalu Ganga', distance_km: 1.2 },
  station: { name: 'Ellagawa Gauge', distance_m: 640 },
}

function getRisk(wl) {
  if (wl >= GAUGING.major_flood_level) return RISK.critical
  if (wl >= GAUGING.minor_flood_level) return RISK.warning
  if (wl >= GAUGING.alert_level) return RISK.caution
  return RISK.safe
}
const CURRENT_RISK = getRisk(GAUGING.water_level)

const HISTORY = [
  { t: '-6h', level: 1.62 }, { t: '-5h', level: 1.74 }, { t: '-4h', level: 1.88 },
  { t: '-3h', level: 2.02 }, { t: '-2h', level: 2.15 }, { t: '-1h', level: 2.28 },
  { t: 'Now', level: 2.35 },
].map((d, i, arr) => {
  const win = arr.slice(Math.max(0, i - 2), i + 1)
  const trend = win.reduce((s, x) => s + x.level, 0) / win.length
  return { ...d, trend: Number(trend.toFixed(2)) }
})

const BEST_MODEL = { name: 'XGBoost', roc_auc: 0.927 }

const READINGS = [
  {
    icon: GaugeIcon, title: 'Ellagawa Gauge Station', meta: `${GAUGING.station.distance_m} m away · ${GAUGING.river.name}`,
    value: `${GAUGING.water_level.toFixed(2)} m`, note: 'water level',
  },
  {
    icon: CloudRain, title: 'Rain Intensity Sensor', meta: 'Last 24 hours · On-site sensor',
    value: `${GAUGING.rainfall} mm`, note: 'accumulated',
  },
  {
    icon: Waves, title: GAUGING.river.name, meta: `${GAUGING.river.distance_km} km from camp · Nearest waterway`,
    value: 'Normal', note: 'flow status',
  },
]

/* ------------------------------------------------------------------ */
/*  SEMI-CIRCLE GAUGE — fill colour follows live risk level             */
/* ------------------------------------------------------------------ */

function polar(cx, cy, r, deg) {
  const rad = ((deg - 180) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = polar(cx, cy, r, startDeg)
  const e = polar(cx, cy, r, endDeg)
  const large = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

function LevelGauge() {
  const max = GAUGING.major_flood_level * 1.1
  const valueDeg = Math.min(180, (GAUGING.water_level / max) * 180)
  const cx = 110, cy = 110, r = 90

  return (
    <div className="flex flex-col items-center w-full">
      <svg viewBox="0 0 220 128" className="w-full max-w-60">
        <path d={arcPath(cx, cy, r, 0, 180)} fill="none" stroke={COLORS.track} strokeWidth="15" strokeLinecap="round" />
        <path d={arcPath(cx, cy, r, 0, valueDeg)} fill="none" stroke={CURRENT_RISK.color} strokeWidth="15" strokeLinecap="round" />
        {[GAUGING.alert_level, GAUGING.minor_flood_level, GAUGING.major_flood_level].map((lvl, i) => {
          const deg = Math.min(180, (lvl / max) * 180)
          const p1 = polar(cx, cy, r - 10, deg)
          const p2 = polar(cx, cy, r + 10, deg)
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={COLORS.noise} strokeWidth="1.5" />
        })}
      </svg>
      <div className="-mt-12 text-center">
        <p className="font-serif text-[38px] leading-none tabular-nums tracking-tight" style={{ color: CURRENT_RISK.color }}>
          {GAUGING.water_level.toFixed(2)}<span className="text-lg" style={{ color: COLORS.muted }}>m</span>
        </p>
        <p className="text-[11px] mt-2 tracking-[0.08em] uppercase font-semibold" style={{ color: CURRENT_RISK.color }}>{CURRENT_RISK.label}</p>
      </div>
      <div className="flex items-center justify-between w-full max-w-60 mt-4 text-[10.5px] font-mono" style={{ color: COLORS.muted }}>
        <span>0m</span>
        <span>Alert {GAUGING.alert_level}</span>
        <span>Major {GAUGING.major_flood_level}</span>
      </div>
    </div>
  )
}

function LevelHistoryChart() {
  return (
    <div className="h-50 sm:h-55 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={HISTORY} margin={{ top: 10, right: 6, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.trend} stopOpacity={0.16} />
              <stop offset="100%" stopColor={COLORS.trend} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.brand} stopOpacity={0.95} />
              <stop offset="100%" stopColor={COLORS.brand} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={COLORS.grid} />
          <XAxis dataKey="t" tick={{ fontSize: 11, fill: COLORS.muted, fontFamily: 'Inter' }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: COLORS.muted, fontFamily: 'Inter' }} axisLine={false} tickLine={false} width={34} />
          <ReferenceLine y={GAUGING.alert_level} stroke={COLORS.noise} strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: `1px solid ${COLORS.line}`, fontSize: 12, boxShadow: SHADOW_CARD, fontFamily: 'Inter' }}
            labelStyle={{ color: COLORS.ink, fontWeight: 600 }}
            cursor={{ fill: 'rgba(5,150,105,0.05)' }}
          />
          <Area type="monotone" dataKey="trend" stroke="none" fill="url(#trendFill)" />
          <Bar dataKey="level" fill="url(#barFill)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Line
            type="monotone"
            dataKey="trend"
            stroke={COLORS.trend}
            strokeWidth={2.25}
            dot={{ r: 3, fill: COLORS.trend, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: COLORS.trend, stroke: '#fff', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  SMALL PRIMITIVES — icons stay neutral; colour is reserved for state */
/* ------------------------------------------------------------------ */

function IconTile({ icon: Icon }) {
  return (
    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center shrink-0" style={{ borderColor: COLORS.line }}>
      <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" style={{ color: COLORS.body }} strokeWidth={1.6} />
    </div>
  )
}

function FieldBox({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border px-3.5 py-3 flex items-center justify-between" style={{ borderColor: COLORS.line }}>
      <div>
        <p className="text-[10.5px]" style={{ color: COLORS.muted }}>{label}</p>
        <p className="text-sm font-medium font-mono mt-0.5" style={{ color: COLORS.ink }}>{value}</p>
      </div>
      {Icon && <Icon className="w-4 h-4" style={{ color: COLORS.chip }} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                                */
/* ------------------------------------------------------------------ */

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function DisasterMonitorPage() {
  const [now, setNow] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [latestGps, setLatestGps] = useState(null)
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetch(`${API}/api/disaster/latest-gps`)
      .then((r) => r.json())
      .then((data) => setLatestGps(data))
      .catch(() => {})
    fetch(`${API}/api/disaster/weather/latest`)
      .then((r) => r.json())
      .then((data) => {
        if (data.available) setWeather(data)
      })
      .catch(() => {})
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 700)
  }

  return (
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>


      <div className="sm:px-5 lg:px-6">

        {/* ================= TITLE ROW ================= */}
        <div className="py-2 sm:py-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.12em]" style={{ color: COLORS.muted }}>{CAMP.type} monitoring</p>
            <h1 className="font-serif font-medium text-[26px] sm:text-[32px] lg:text-[36px] leading-[1.1] tracking-tight mt-1.5">
              Smart Camp — {latestGps?.location_name ?? CAMP.name.split(' — ')[1] ?? 'Unknown Location'}
            </h1>
            <p className="flex items-center gap-1.5 text-[12.5px] mt-2" style={{ color: COLORS.muted }}>
              <MapPin className="w-3.5 h-3.5" />
              {latestGps?.latitude?.toFixed(4) ?? "—"}, {latestGps?.longitude?.toFixed(4) ?? "—"}
              {latestGps?.location_district && <span className="ml-1.5">· {latestGps.location_district}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CURRENT_RISK.color }} />
            <span className="font-semibold" style={{ color: CURRENT_RISK.color }}>{CURRENT_RISK.label}</span>
          </div>
        </div>

        {/* ================= OVERVIEW + WEATHER ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 pb-4 sm:pb-6">
          <div className="lg:col-span-5 rounded-xl border p-4 sm:p-6 flex flex-col" style={{ borderColor: COLORS.line }}>
            <p className="text-[11px] uppercase tracking-widest font-mono" style={{ color: COLORS.muted }}>Flood risk overview</p>
            <p className="font-serif font-medium text-[28px] sm:text-[30px] mt-2 tracking-tight" style={{ color: CURRENT_RISK.color }}>{CURRENT_RISK.label}</p>
            <p className="text-[13.5px] leading-relaxed mt-3" style={{ color: COLORS.body }}>
              Readings from the {GAUGING.station.name} are within the safe range. Prediction engine: {BEST_MODEL.name}, {(BEST_MODEL.roc_auc * 100).toFixed(1)}% confidence.
            </p>
            <div className="flex items-center gap-2 mt-5 pt-5 border-t" style={{ borderColor: COLORS.hairline }}>
              <button className="flex-1 rounded-lg border text-[12.5px] font-semibold py-2.5 flex items-center justify-center gap-1.5 transition-colors" style={{ borderColor: COLORS.line, color: COLORS.body }}>
                <Download className="w-3.5 h-3.5" strokeWidth={1.7} /> Export
              </button>
              <button
                className="flex-1 rounded-lg text-[12.5px] font-semibold py-2.5 text-white flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: COLORS.brand }}
              >
                View report <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.7} />
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-xl border p-4 sm:p-6" style={{ borderColor: COLORS.line }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <IconTile icon={CloudRain} />
                <div>
                  <p className="text-[11px] uppercase tracking-widest font-mono" style={{ color: COLORS.muted }}>Weather prediction</p>
                  <p className="text-[13.5px] sm:text-[14px] font-semibold mt-0.5">{weather?.condition || 'Weather data unavailable'}</p>
                </div>
              </div>
              <p className="font-serif font-medium text-[28px] sm:text-[30px] leading-none tracking-tight">
                {weather?.temperature != null ? `${Math.round(weather.temperature)}°` : '—'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mt-5">
              <div className="rounded-lg border py-2.5 text-center" style={{ borderColor: COLORS.hairline }}>
                <p className="text-[14px] sm:text-[15px] font-bold font-mono">{weather?.rainfall != null ? `${weather.rainfall.toFixed(1)} mm` : '—'}</p>
                <p className="text-[10px] sm:text-[10.5px] mt-0.5" style={{ color: COLORS.muted }}>Rainfall</p>
              </div>
              <div className="rounded-lg border py-2.5 text-center" style={{ borderColor: COLORS.hairline }}>
                <p className="text-[14px] sm:text-[15px] font-bold font-mono">{weather?.wind_speed != null ? `${Math.round(weather.wind_speed)} km/h` : '—'}</p>
                <p className="text-[10px] sm:text-[10.5px] mt-0.5" style={{ color: COLORS.muted }}>Wind</p>
              </div>
              <div className="rounded-lg border py-2.5 text-center" style={{ borderColor: COLORS.hairline }}>
                <p className="text-[14px] sm:text-[15px] font-bold font-mono">{weather?.precipitation != null ? `${weather.precipitation.toFixed(1)} mm` : '—'}</p>
                <p className="text-[10px] sm:text-[10.5px] mt-0.5" style={{ color: COLORS.muted }}>Precipitation</p>
              </div>
            </div>

            {weather?.fetched_at && (
              <p className="text-[10px] font-mono mt-4 pt-3 border-t" style={{ borderColor: COLORS.hairline, color: COLORS.muted }}>
                Last updated: {new Date(weather.fetched_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* ================= WATER LEVEL: GAUGE + HISTORY ================= */}
        <div className="rounded-xl border p-4 sm:p-6 mb-4 sm:mb-6" style={{ borderColor: COLORS.line }}>
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="flex items-center gap-3">
              <IconTile icon={GaugeIcon} />
              <h2 className="text-[13.5px] sm:text-[14px] font-semibold">Water level</h2>
            </div>
            <span className="text-[11px] sm:text-[11.5px] font-mono" style={{ color: COLORS.muted }}>Last 6 hours</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
            <div className="lg:col-span-4 flex justify-center">
              <LevelGauge />
            </div>
            <div className="lg:col-span-8">
              <LevelHistoryChart />
              <div className="flex items-center gap-4 mt-3 text-[11px] font-mono" style={{ color: COLORS.muted }}>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS.brand }} /> Level</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.trend }} /> Trend</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= LIVE READINGS ================= */}
        <div className="pb-4 sm:pb-6">
          <h2 className="text-[13.5px] sm:text-[14px] font-semibold mb-3">Live readings</h2>
          <div className="rounded-xl border divide-y" style={{ borderColor: COLORS.line }}>
            {READINGS.map((r) => (
              <div key={r.title} className="flex items-center gap-3 sm:gap-3.5 px-3.5 sm:px-5 py-3.5 sm:py-4" style={{ borderColor: COLORS.hairline }}>
                <IconTile icon={r.icon} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] sm:text-[13.5px] font-semibold truncate">{r.title}</p>
                  <p className="text-[11.5px] sm:text-[12px] truncate mt-0.5" style={{ color: COLORS.muted }}>{r.meta}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13.5px] sm:text-[14px] font-bold font-mono">{r.value}</p>
                  <p className="text-[10px] sm:text-[10.5px]" style={{ color: COLORS.muted }}>{r.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ================= LOCATION + DEVICE STATUS ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 pb-6 sm:pb-8">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3 mb-3">
              <IconTile icon={Navigation} />
              <h2 className="text-[13.5px] sm:text-[14px] font-semibold">Location</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              <FieldBox label="Latitude" value={latestGps?.latitude?.toFixed(6) ?? "—"} />
              <FieldBox label="Longitude" value={latestGps?.longitude?.toFixed(6) ?? "—"} />
              <FieldBox label="Altitude" value={latestGps?.altitude != null ? `${latestGps.altitude} m` : "—"} />
              <FieldBox label="Source" value={latestGps?.source ?? "—"} />
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="flex items-center gap-3 mb-3">
              <IconTile icon={Cpu} />
              <h2 className="text-[13.5px] sm:text-[14px] font-semibold">Device status</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              {[
                { label: 'Edge Gateway', desc: 'Intel NUC' },
                { label: 'Prediction Engine', desc: `${BEST_MODEL.name} · ${(BEST_MODEL.roc_auc * 100).toFixed(1)}%` },
                { label: 'Sensor Station', desc: GAUGING.station.name },
                { label: 'MQTT Bridge', desc: 'EMQX broker' },
              ].map((d) => (
                <div key={d.label} className="rounded-lg border p-3 sm:p-3.5" style={{ borderColor: COLORS.line }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full mb-2" style={{ backgroundColor: COLORS.brand }} />
                  <p className="text-[12px] sm:text-[12.5px] font-semibold leading-tight">{d.label}</p>
                  <p className="text-[10.5px] sm:text-[11px] mt-0.5 truncate" style={{ color: COLORS.muted }}>{d.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}