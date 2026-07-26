import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, UserPlus, ClipboardCheck, Heart, Baby, Activity, TrendingUp, Wifi } from 'lucide-react'

const API = 'http://localhost:5000'

const NETWORK_STYLE = {
  STABLE:   { badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', dot: 'bg-emerald-500' },
  DEGRADED: { badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',   dot: 'bg-amber-500' },
  CRITICAL: { badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20',      dot: 'bg-rose-500' },
}

function StatCard({ label, value, icon: Icon, delay = 0, color = 'indigo' }) {
  const colorMap = {
    indigo: 'from-indigo-500/5 to-purple-500/5',
    emerald: 'from-emerald-500/5 to-teal-500/5',
    amber: 'from-amber-500/5 to-orange-500/5',
    rose: 'from-rose-500/5 to-pink-500/5',
    sky: 'from-sky-500/5 to-blue-500/5',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white rounded-2xl p-5 border border-gray-200 relative overflow-hidden hover:shadow-lg transition-shadow group"
    >
      <div className={`absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br ${colorMap[color]} rounded-full group-hover:scale-150 transition-transform duration-500`} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className={`w-4 h-4 text-${color}-500`} />}
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-3xl font-bold text-gray-900">{value ?? '—'}</span>
      </div>
    </motion.div>
  )
}

function DistributionRow({ label, data }) {
  if (!data) return null
  const pct = data.percent ?? 0
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm font-semibold text-gray-700 w-20">{label}</span>
      <div className="flex-1 mx-3">
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-sm font-medium text-gray-600 w-24 text-right">
        {data.served}/{data.served + data.pending}
      </span>
      <span className="text-sm font-bold w-12 text-right" style={{ color: pct >= 85 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444' }}>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-red-600 font-semibold">Could not load dashboard</p>
        <p className="text-red-400 text-sm mt-1">{error}</p>
        <button onClick={fetchStats} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition">
          Retry
        </button>
      </div>
    )
  }

  const pop = stats?.population ?? {}
  const vuln = stats?.vulnerable ?? {}
  const dist = stats?.distribution_today ?? {}
  const pred = stats?.prediction_tomorrow ?? {}
  const mqtt = stats?.mqtt ?? {}
  const recent = stats?.recent_registrations ?? []

  const netStyle = NETWORK_STYLE[mqtt.network_state] ?? NETWORK_STYLE.STABLE

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Camp Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Population" value={pop.total?.toLocaleString()} icon={Users} delay={0} color="indigo" />
        <StatCard label="Today Registered" value={pop.today_registered} icon={UserPlus} delay={0.05} color="emerald" />
        <StatCard label="Today Check-ins" value={pop.today_checkins} icon={ClipboardCheck} delay={0.1} color="sky" />
        <StatCard label="Families" value={pop.families} icon={Heart} delay={0.15} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Today's Distribution</h2>
          <DistributionRow label="Breakfast" data={dist.breakfast} />
          <DistributionRow label="Lunch" data={dist.lunch} />
          <DistributionRow label="Dinner" data={dist.dinner} />
          <DistributionRow label="Water" data={dist.water} />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">Vulnerable</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                  <Baby className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pregnant</p>
                  <p className="text-lg font-bold text-gray-900">{vuln.pregnant ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Chronic Illness</p>
                  <p className="text-lg font-bold text-gray-900">{vuln.chronic_illness ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Flagged</p>
                  <p className="text-lg font-bold text-gray-900">{vuln.total_flagged ?? 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Network</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${netStyle.badge}`}>
                <span className={`w-2 h-2 rounded-full ${netStyle.dot}`} />
                {mqtt.network_state ?? 'UNKNOWN'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Wifi className="w-4 h-4" />
              <span>Buffered: <strong className="text-gray-800">{mqtt.buffered_messages ?? 0}</strong> messages</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Tomorrow</h2>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Expected: <strong className="text-gray-900">{pred.expected_persons?.toLocaleString() ?? '—'}</strong> persons</p>
              <p>Food: <strong className="text-gray-900">{pred.breakfast_kg ?? '—'}</strong> kg</p>
              <p>Water: <strong className="text-gray-900">{pred.water_litres?.toLocaleString() ?? '—'}</strong> L</p>
            </div>
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Recent Registrations</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Age</th>
                  <th className="pb-2 pr-4">Gender</th>
                  <th className="pb-2 pr-4">Wristband</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.slice(0, 10).map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{p.full_name}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{p.age}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{p.gender}</td>
                    <td className="py-2.5 pr-4 text-gray-600 font-mono text-xs">{p.wristband_barcode ?? '—'}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                        p.pre_registered ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {p.pre_registered ? 'Pre-registered' : 'New'}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleTimeString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
