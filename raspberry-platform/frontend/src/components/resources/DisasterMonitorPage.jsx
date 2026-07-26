import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity, Droplets, Wind, Thermometer, CloudRain, MapPin, AlertTriangle, Shield, Cpu, Gauge, RefreshCw } from 'lucide-react'

const API = 'http://localhost:5000'
const CAMP_ID = 'galle'

const STATUS_META = {
  critical: { label: 'CRITICAL', color: 'text-red-600', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
  high: { label: 'HIGH', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  medium: { label: 'MEDIUM', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  stable: { label: 'STABLE', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  recovery: { label: 'RECOVERY', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading disaster data...</span>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
      <p className="text-red-600 font-semibold">Could not load disaster data</p>
      <p className="text-red-400 text-sm mt-1">{message}</p>
      <button onClick={onRetry} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition">
        Retry
      </button>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, unit = '', color = 'blue' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 text-${color}-500`} />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">{value ?? '—'}</span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
      </div>
    </div>
  )
}

function ModelCard({ model, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-800 uppercase tracking-wider">{model.model_name.replace(/_/g, ' ')}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          model.roc_auc >= 0.9 ? 'bg-emerald-100 text-emerald-700' :
          model.roc_auc >= 0.85 ? 'bg-blue-100 text-blue-700' :
          'bg-amber-100 text-amber-700'
        }`}>
          ROC-AUC: {model.roc_auc.toFixed(3)}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div><p className="text-gray-400">Accuracy</p><p className="font-bold text-gray-800">{(model.accuracy * 100).toFixed(1)}%</p></div>
        <div><p className="text-gray-400">Precision</p><p className="font-bold text-gray-800">{(model.precision * 100).toFixed(1)}%</p></div>
        <div><p className="text-gray-400">Recall</p><p className="font-bold text-gray-800">{(model.recall * 100).toFixed(1)}%</p></div>
        <div><p className="text-gray-400">F1</p><p className="font-bold text-gray-800">{(model.f1 * 100).toFixed(1)}%</p></div>
      </div>
    </motion.div>
  )
}

function WaterLevelGauge({ wl, alertL, minorL, majorL }) {
  const max = Math.max(majorL, Math.abs(wl) * 1.5, 10)
  const pct = ((wl + max / 2) / max) * 100
  const clampedPct = Math.max(2, Math.min(98, pct))
  const color = wl >= majorL ? 'bg-red-500' : wl >= minorL ? 'bg-orange-500' : wl >= alertL ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clampedPct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full rounded-full ${color} transition-colors`}
      />
      <div className="absolute inset-0 flex items-center justify-between px-1">
        {[alertL, minorL, majorL].map((level, i) => (
          <div
            key={i}
            className="w-0.5 h-full bg-white/60"
            style={{ marginLeft: `${((level + max / 2) / max) * 100}%` }}
            title={`${i === 0 ? 'Alert' : i === 1 ? 'Minor' : 'Major'}: ${level}m`}
          />
        ))}
      </div>
    </div>
  )
}

export default function DisasterMonitorPage() {
  const [camp, setCamp] = useState(null)
  const [models, setModels] = useState([])
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAll = () => {
    setLoading(true)
    setError('')
    Promise.all([
      fetch(`${API}/api/disaster/camps/${CAMP_ID}`).then(r => { if (!r.ok) throw new Error('Camp fetch failed'); return r.json() }),
      fetch(`${API}/api/disaster/prediction-models`).then(r => { if (!r.ok) throw new Error('Models failed'); return r.json() }),
      fetch(`${API}/api/disaster/overview`).then(r => { if (!r.ok) throw new Error('Overview failed'); return r.json() }),
    ])
      .then(([cp, md, ov]) => {
        setCamp(cp.camp ?? null)
        setModels(md.models ?? [])
        setOverview(ov)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  const bestModel = useMemo(() => models.length > 0 ? models.reduce((a, b) => (a.roc_auc > b.roc_auc ? a : b)) : null, [models])

  const getAlertLevel = (c) => {
    if (!c) return 'SAFE'
    if (c.wl >= c.majorL) return 'CRITICAL'
    if (c.wl >= c.minorL) return 'WARNING'
    if (c.wl >= c.alertL) return 'CAUTION'
    return 'SAFE'
  }

  const alertLevel = getAlertLevel(camp)
  const statusMeta = STATUS_META[camp?.status] ?? STATUS_META.stable

  if (loading && !camp) return <LoadingState />
  if (error && !camp) return <ErrorState message={error} onRetry={fetchAll} />
  if (!camp) return <ErrorState message="Camp data not found" onRetry={fetchAll} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Disaster Monitoring</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" />
            {new Date().toLocaleTimeString()}
          </span>
          <button onClick={fetchAll} className="text-xs text-gray-400 hover:text-gray-600 transition-colors" aria-label="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <motion.div
        key={camp.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className={`${statusMeta.bg} rounded-2xl p-4 flex items-center gap-4`}>
          <Shield className={`w-6 h-6 ${statusMeta.color}`} />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-gray-900">{camp.name}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusMeta.color} bg-white/80`}>
                {statusMeta.label}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                alertLevel === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                alertLevel === 'WARNING' ? 'bg-orange-100 text-orange-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                Alert: {alertLevel}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {camp.type} &middot; {camp.displaced.toLocaleString()}/{camp.capacity.toLocaleString()} displaced &middot; {camp.workers} workers
            </p>
          </div>
          <span className={`w-3 h-3 rounded-full ${statusMeta.dot} animate-pulse`} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Displaced" value={camp.displaced.toLocaleString()} icon={Activity} color="red" />
          <MetricCard label="Capacity" value={camp.capacity.toLocaleString()} icon={MapPin} color="blue" />
          <MetricCard label="Occupancy" value={Math.round((camp.displaced / camp.capacity) * 100)} unit="%" icon={Gauge} color="amber" />
          <MetricCard label="Aid Coverage" value={camp.aid} unit="%" icon={Shield} color="emerald" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CloudRain className="w-5 h-5 text-sky-500" />
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Current Sensor Status</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-500 font-medium">Water Level</span>
                    <span className="font-bold text-gray-900">{camp.wl.toFixed(2)}m</span>
                  </div>
                  <WaterLevelGauge wl={camp.wl} alertL={camp.alertL} minorL={camp.minorL} majorL={camp.majorL} />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Alert: {camp.alertL}m</span>
                    <span>Minor: {camp.minorL}m</span>
                    <span>Major: {camp.majorL}m</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400">River</p>
                    <p className="text-sm font-bold text-gray-800">{camp.river}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400">Station</p>
                    <p className="text-sm font-bold text-gray-800">{camp.station} ({camp.stDist.toLocaleString()}m)</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400">Elevation</p>
                    <p className="text-sm font-bold text-gray-800">{camp.elev}m</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400">Water Body</p>
                    <p className="text-sm font-bold text-gray-800">{camp.waterPath}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Thermometer className="w-5 h-5 text-orange-500" />
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Environmental Readings</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="Temperature" value={`${camp.minT} / ${camp.maxT}`} unit="°C" icon={Thermometer} color="orange" />
                <MetricCard label="Humidity" value={camp.hum} unit="%" icon={Droplets} color="sky" />
                <MetricCard label="Rainfall" value={camp.rain} unit="mm" icon={CloudRain} color="blue" />
                <MetricCard label="Precipitation" value={camp.precip} unit="mm" icon={Droplets} color="indigo" />
                <MetricCard label="Wind" value={camp.avgWind} unit="km/h" icon={Wind} color="teal" />
                <MetricCard label="Max Wind" value={camp.maxWind} unit="km/h" icon={Wind} color="amber" />
                <MetricCard label="Pressure" value={camp.pres} unit="hPa" icon={Activity} color="purple" />
                <MetricCard label="Soil Moisture" value={camp.soil?.toFixed(2)} icon={Droplets} color="amber" />
                <MetricCard label="Cloud Cover" value={camp.cloud} unit="%" icon={CloudRain} color="gray" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="w-5 h-5 text-indigo-500" />
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Device Status</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Edge Gateway', desc: 'Intel NUC' },
                  { label: 'XGBoost Model', desc: `ROC-AUC ${bestModel?.roc_auc.toFixed(3) ?? '0.927'}` },
                  { label: 'Sensor Station', desc: camp.station },
                  { label: 'MQTT Bridge', desc: 'EMQX broker' },
                ].map((d, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                    <span className="inline-block w-2 h-2 rounded-full mb-2 bg-emerald-500" />
                    <p className="text-sm font-bold text-gray-800">{d.label}</p>
                    <p className="text-xs text-gray-400">{d.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {bestModel && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Disaster Prediction</h2>
                </div>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold mb-1" style={{
                    color: alertLevel === 'CRITICAL' ? '#ef4444' : alertLevel === 'WARNING' ? '#f59e0b' : '#10b981'
                  }}>
                    {alertLevel}
                  </div>
                  <p className="text-xs text-gray-400">Alert Level</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Camp Status</span>
                    <span className={`font-semibold ${statusMeta.color}`}>{statusMeta.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Best Model</span>
                    <span className="font-semibold text-gray-800 uppercase">{bestModel.model_name.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ROC-AUC</span>
                    <span className="font-semibold text-gray-800">{(bestModel.roc_auc * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Accuracy</span>
                    <span className="font-semibold text-gray-800">{(bestModel.accuracy * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Critical Camps</span>
                    <span className={`font-bold ${(overview?.summary?.critical_count ?? 0) > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                      {overview?.summary?.critical_count ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-violet-500" />
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Prediction Confidence</h2>
              </div>
              <div className="space-y-3">
                {models.map((m, i) => <ModelCard key={m.model_name} model={m} index={i} />)}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
