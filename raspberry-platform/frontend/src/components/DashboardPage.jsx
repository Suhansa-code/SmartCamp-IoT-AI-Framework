import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, UserPlus, ClipboardCheck, Heart, Baby, Activity, TrendingUp, Wifi,
  CalendarDays, ArrowUpRight,
} from 'lucide-react'
import LoadingState from './ui/feedback/LoadingState'
import ErrorState from './ui/feedback/ErrorState'
import { COLORS, SHADOW_CARD } from '../lib/tokens'

const API = import.meta.env.VITE_API_URL || "http://localhost:5000"

/* ------------------------------------------------------------------ */
/*  SEMANTIC COLOUR MAP                                                 */
/* ------------------------------------------------------------------ */

const TONE = {
  brand:   { color: COLORS.brand, bg: `${COLORS.brand}14`, border: `${COLORS.brand}33` },
  warning: { color: '#D97706',    bg: '#FFFBEB',           border: '#FDE68A' },
  danger:  { color: '#DC2626',    bg: '#FEF2F2',           border: '#FECACA' },
  info:    { color: '#0284C7',    bg: '#F0F9FF',           border: '#BAE6FD' },
  violet:  { color: '#7C3AED',    bg: '#F5F3FF',           border: '#DDD6FE' },
  neutral: { color: COLORS.body,  bg: '#F5F6F5',            border: COLORS.line },
}

const NETWORK_TONE = { STABLE: 'brand', DEGRADED: 'warning', CRITICAL: 'danger' }

/* ------------------------------------------------------------------ */
/*  LOCAL PRIMITIVES — mirror the FloodWatch / ReliefOps design system  */
/* ------------------------------------------------------------------ */

function Card({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={`rounded-xl border bg-white p-4 sm:p-5 ${className}`}
      style={{ borderColor: COLORS.line }}
    >
      {children}
    </motion.div>
  )
}

function IconTile({ icon: Icon, tone = "brand", size = "md" }) {
  const t = TONE[tone] || TONE.brand
  const dims = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-8 h-8" : "w-9 h-9"
  return (
    <div className={`${dims} rounded-lg flex items-center justify-center shrink-0 border`} style={{ backgroundColor: t.bg, borderColor: t.border }}>
      <Icon className={size === "lg" ? "w-5 h-5" : "w-4 h-4"} style={{ color: t.color }} strokeWidth={1.7} />
    </div>
  )
}

function Chip({ children, tone = "neutral" }) {
  const t = TONE[tone] || TONE.neutral
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide border"
      style={{ color: t.color, backgroundColor: t.bg, borderColor: t.border }}
    >
      {children}
    </span>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.08em] mb-3 sm:mb-4" style={{ color: COLORS.muted }}>
      {children}
    </p>
  )
}

function StatCard({ label, value, icon: Icon, tone = "brand", delay = 0 }) {
  const t = TONE[tone] || TONE.brand
  return (
    <Card delay={delay} className="relative overflow-hidden group">
      <div
        className="absolute -right-6 -top-6 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500"
        style={{ backgroundColor: t.bg }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />}
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</span>
        </div>
        <span className="text-[22px] sm:text-[24px] font-semibold font-mono tracking-tight" style={{ color: COLORS.ink }}>{value ?? '—'}</span>
      </div>
    </Card>
  )
}

function DistributionRow({ label, data }) {
  if (!data) return null
  const pct = data.percent ?? 0
  const tone = pct >= 85 ? TONE.brand : pct >= 60 ? TONE.info : TONE.warning
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: COLORS.hairline }}>
      <span className="text-[13px] font-semibold w-20" style={{ color: COLORS.ink }}>{label}</span>
      <div className="flex-1 mx-3">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F0F1EF' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: tone.color }}
          />
        </div>
      </div>
      <span className="text-[12px] font-mono w-20 text-right" style={{ color: COLORS.muted }}>
        {data.served}/{data.served + data.pending}
      </span>
      <span className="text-[13px] font-semibold font-mono w-12 text-right" style={{ color: tone.color }}>
        {pct}%
      </span>
    </div>
  )
}

function VulnerableRow({ icon: Icon, tone, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile icon={Icon} tone={tone} />
      <div>
        <p className="text-[11.5px]" style={{ color: COLORS.muted }}>{label}</p>
        <p className="text-[16px] font-semibold font-mono" style={{ color: COLORS.ink }}>{value ?? 0}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [campId, setCampId] = useState('')

  const fetchStats = () => {
    fetch(`${API}/api/stats/overview`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchStats()
    fetch(`${API}/api/disaster/camp-identity`)
      .then(r => r.json())
      .then(data => { if (data.camp_id) setCampId(data.camp_id) })
      .catch(() => {})
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [])

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  if (loading) return <LoadingState message="Loading dashboard..." fullPage />
  if (error) return <ErrorState title="Could not load dashboard" message={error} onRetry={fetchStats} />

  const pop = stats?.population ?? {}
  const vuln = stats?.vulnerable ?? {}
  const dist = stats?.distribution_today ?? {}
  const pred = stats?.prediction_tomorrow ?? {}
  const mqtt = stats?.mqtt ?? {}
  const recent = stats?.recent_registrations ?? []

  const netTone = NETWORK_TONE[mqtt.network_state] ?? 'neutral'

  return (
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>
      <div className="sm:px-5 lg:px-6 py-2 sm:py-7 space-y-4 sm:space-y-6">

        {/* ================= TITLE ROW ================= */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
        >
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.12em]" style={{ color: COLORS.muted }}>{campId || 'Camp'}</p>
            <h1 className="font-serif font-medium text-[26px] sm:text-[32px] leading-[1.1] tracking-tight mt-1.5">Camp Dashboard</h1>
            <p className="text-[12.5px] mt-2" style={{ color: COLORS.muted }}>Live overview of population, distribution &amp; readiness</p>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-mono" style={{ color: COLORS.muted }}>
            <CalendarDays className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
            <span className="font-medium">{today}</span>
          </div>
        </motion.div>

        {/* ================= STAT ROW ================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Population" value={pop.total?.toLocaleString()} icon={Users} tone="brand" delay={0} />
          <StatCard label="Today Registered" value={pop.today_registered} icon={UserPlus} tone="info" delay={0.05} />
          <StatCard label="Today Check-ins" value={pop.today_checkins} icon={ClipboardCheck} tone="violet" delay={0.1} />
          <StatCard label="Families" value={pop.families} icon={Heart} tone="warning" delay={0.15} />
        </div>

        {/* ================= DISTRIBUTION + SIDE CARDS ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <Card delay={0.1} className="lg:col-span-2">
            <SectionLabel>Today's Distribution</SectionLabel>
            <DistributionRow label="Breakfast" data={dist.breakfast} />
            <DistributionRow label="Lunch" data={dist.lunch} />
            <DistributionRow label="Dinner" data={dist.dinner} />
            <DistributionRow label="Water" data={dist.water} />
          </Card>

          <div className="space-y-3 sm:space-y-4">
            <Card delay={0.15}>
              <SectionLabel>Vulnerable</SectionLabel>
              <div className="space-y-3">
                <VulnerableRow icon={Baby} tone="violet" label="Pregnant" value={vuln.pregnant} />
                <VulnerableRow icon={Activity} tone="warning" label="Chronic Illness" value={vuln.chronic_illness} />
                <VulnerableRow icon={Heart} tone="brand" label="Total Flagged" value={vuln.total_flagged} />
              </div>
            </Card>

            <Card delay={0.2}>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Network</SectionLabel>
                <Chip tone={netTone}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />
                  {mqtt.network_state ?? 'UNKNOWN'}
                </Chip>
              </div>
              <div className="flex items-center gap-2 text-[12.5px]" style={{ color: COLORS.muted }}>
                <Wifi className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                <span>Buffered: <strong className="font-mono font-semibold" style={{ color: COLORS.ink }}>{mqtt.buffered_messages ?? 0}</strong> messages</span>
              </div>
            </Card>

            <Card delay={0.25}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                <SectionLabel>Tomorrow</SectionLabel>
              </div>
              <div className="text-[12.5px] space-y-1.5" style={{ color: COLORS.body }}>
                <p className="flex justify-between"><span>Expected</span><strong className="font-mono font-semibold" style={{ color: COLORS.ink }}>{pred.expected_persons?.toLocaleString() ?? '—'} persons</strong></p>
                <p className="flex justify-between"><span>Food</span><strong className="font-mono font-semibold" style={{ color: COLORS.ink }}>{pred.breakfast_kg ?? '—'} kg</strong></p>
                <p className="flex justify-between"><span>Water</span><strong className="font-mono font-semibold" style={{ color: COLORS.ink }}>{pred.water_litres?.toLocaleString() ?? '—'} L</strong></p>
              </div>
            </Card>
          </div>
        </div>

        {/* ================= RECENT REGISTRATIONS ================= */}
        {recent.length > 0 && (
          <Card delay={0.3}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <SectionLabel>Recent Registrations</SectionLabel>
              <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: COLORS.muted }}>
                Live <ArrowUpRight className="w-3 h-3" style={{ color: COLORS.brand }} />
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: COLORS.line }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: COLORS.hairline, backgroundColor: "#FAFAF9" }}>
                    {["Name", "Age", "Gender", "Wristband", "Status", "Time"].map((h) => (
                      <th key={h} className="py-3 px-4 font-mono font-semibold text-[10.5px] uppercase tracking-[0.06em]" style={{ color: COLORS.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(0, 10).map((p) => (
                    <tr key={p.id} className="border-t transition-colors" style={{ borderColor: COLORS.hairline }}>
                      <td className="py-3 px-4 font-semibold" style={{ color: COLORS.ink }}>{p.full_name}</td>
                      <td className="py-3 px-4" style={{ color: COLORS.body }}>{p.age}</td>
                      <td className="py-3 px-4" style={{ color: COLORS.body }}>{p.gender}</td>
                      <td className="py-3 px-4 font-mono text-[12px]" style={{ color: COLORS.body }}>{p.wristband_barcode ?? '—'}</td>
                      <td className="py-3 px-4">
                        <Chip tone={p.pre_registered ? "brand" : "info"}>{p.pre_registered ? 'Pre-registered' : 'New'}</Chip>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11.5px]" style={{ color: COLORS.muted }}>
                        {p.created_at ? new Date(p.created_at).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}