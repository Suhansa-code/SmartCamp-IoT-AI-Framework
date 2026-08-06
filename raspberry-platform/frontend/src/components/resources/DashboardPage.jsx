import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, UserPlus, ClipboardCheck, Heart, Baby, Activity, TrendingUp, Wifi,
  LayoutDashboard, CalendarDays,
} from 'lucide-react'
import Button from '../ui/base/Button'
import LoadingState from '../ui/feedback/LoadingState'
import ErrorState from '../ui/feedback/ErrorState'

const API = import.meta.env.VITE_API_URL || "http://localhost:5000"

const NETWORK_STYLE = {
  STABLE:   { badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  DEGRADED: { badge: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
  CRITICAL: { badge: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500' },
}

function StatCard({ label, value, icon: Icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl p-5 relative overflow-hidden group hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-300"
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-teal-500/10 to-sky-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className="w-4 h-4 text-teal-600" />}
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-2xl font-bold text-slate-800 font-mono tracking-tight">{value ?? '—'}</span>
      </div>
    </motion.div>
  )
}

function DistributionRow({ label, data }) {
  if (!data) return null
  const pct = data.percent ?? 0
  const color = pct >= 85 ? 'bg-teal-600' : pct >= 60 ? 'bg-teal-400' : 'bg-sky-400'
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm font-semibold text-slate-700 w-20">{label}</span>
      <div className="flex-1 mx-3">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-sm text-slate-500 w-24 text-right">
        {data.served}/{data.served + data.pending}
      </span>
      <span className="text-sm font-semibold w-12 text-right text-teal-700">
        {pct}%
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [])

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (loading) {
    return <LoadingState message="Loading dashboard..." fullPage />
  }

  if (error) {
    return <ErrorState title="Could not load dashboard" message={error} onRetry={fetchStats} />
  }

  const pop = stats?.population ?? {}
  const vuln = stats?.vulnerable ?? {}
  const dist = stats?.distribution_today ?? {}
  const pred = stats?.prediction_tomorrow ?? {}
  const mqtt = stats?.mqtt ?? {}
  const recent = stats?.recent_registrations ?? []

  const netStyle = NETWORK_STYLE[mqtt.network_state] ?? NETWORK_STYLE.STABLE

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-800 font-sans relative">


      <div className="max-w-7xl mx-auto sm:px-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-500/25">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight">
                Camp Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Live overview of population, distribution &amp; readiness
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/80 border border-slate-200/80 rounded-full px-3.5 py-1.5 w-fit shadow-sm">
            <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
            <span className="font-medium">{today}</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Population" value={pop.total?.toLocaleString()} icon={Users} delay={0} />
          <StatCard label="Today Registered" value={pop.today_registered} icon={UserPlus} delay={0.05} />
          <StatCard label="Today Check-ins" value={pop.today_checkins} icon={ClipboardCheck} delay={0.1} />
          <StatCard label="Families" value={pop.families} icon={Heart} delay={0.15} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-5">
            <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Today's Distribution</h2>
            <DistributionRow label="Breakfast" data={dist.breakfast} />
            <DistributionRow label="Lunch" data={dist.lunch} />
            <DistributionRow label="Dinner" data={dist.dinner} />
            <DistributionRow label="Water" data={dist.water} />
          </div>

          <div className="space-y-4">
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl p-5">
              <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Vulnerable</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center border border-violet-100">
                    <Baby className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Pregnant</p>
                    <p className="text-base font-bold text-slate-900">{vuln.pregnant ?? 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                    <Activity className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Chronic Illness</p>
                    <p className="text-base font-bold text-slate-900">{vuln.chronic_illness ?? 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center border border-teal-100">
                    <Heart className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Flagged</p>
                    <p className="text-base font-bold text-slate-900">{vuln.total_flagged ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Network</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${netStyle.badge}`}>
                  <span className={`w-2 h-2 rounded-full ${netStyle.dot}`} />
                  {mqtt.network_state ?? 'UNKNOWN'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Wifi className="w-4 h-4 text-teal-600" />
                <span>Buffered: <strong className="text-slate-800">{mqtt.buffered_messages ?? 0}</strong> messages</span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tomorrow</h2>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <p>Expected: <strong className="text-slate-900">{pred.expected_persons?.toLocaleString() ?? '—'}</strong> persons</p>
                <p>Food: <strong className="text-slate-900">{pred.breakfast_kg ?? '—'}</strong> kg</p>
                <p>Water: <strong className="text-slate-900">{pred.water_litres?.toLocaleString() ?? '—'}</strong> L</p>
              </div>
            </div>
          </div>
        </div>

        {recent.length > 0 && (
          <div className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-5">
            <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Recent Registrations</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-100">
                    <th className="pb-2 pr-4 font-semibold">Name</th>
                    <th className="pb-2 pr-4 font-semibold">Age</th>
                    <th className="pb-2 pr-4 font-semibold">Gender</th>
                    <th className="pb-2 pr-4 font-semibold">Wristband</th>
                    <th className="pb-2 pr-4 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(0, 10).map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-slate-900">{p.full_name}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{p.age}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{p.gender}</td>
                      <td className="py-2.5 pr-4 text-slate-600 font-mono text-xs">{p.wristband_barcode ?? '—'}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                          p.pre_registered ? 'bg-teal-100 text-teal-700' : 'bg-sky-50 text-sky-600 border border-sky-100'
                        }`}>
                          {p.pre_registered ? 'Pre-registered' : 'New'}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleTimeString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
