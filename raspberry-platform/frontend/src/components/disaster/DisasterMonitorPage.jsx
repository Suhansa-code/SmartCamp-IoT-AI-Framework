import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity, Droplets, Wind, Thermometer, CloudRain, MapPin, AlertTriangle, Shield, Cpu, Gauge, RefreshCw, Radar, Navigation, Satellite } from 'lucide-react'
import LoadingState from '../ui/feedback/LoadingState'
import ErrorState from '../ui/feedback/ErrorState'
import { API } from '../ui/config'
import PageHeader from '../ui/base/PageHeader'
import Card from '../ui/base/Card'
import SectionHeader from '../ui/base/SectionHeader'
import StatCard from '../ui/base/StatCard'

const CAMP_LOCATION = {
  latitude: 6.0535,
  longitude: 80.2210,
  altitude: 10.0,
  satellites: 5,
  live: false,
  fetched_at: new Date().toISOString(),
}

const STATUS_META = {
  critical: { label: 'CRITICAL', color: 'text-red-600', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
  high: { label: 'HIGH', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  medium: { label: 'MEDIUM', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  stable: { label: 'STABLE', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-100', dot: 'bg-teal-500' },
  recovery: { label: 'RECOVERY', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
}

function ModelCard({ model, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl p-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">{model.model_name.replace(/_/g, ' ')}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
          model.roc_auc >= 0.9 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
          model.roc_auc >= 0.85 ? 'bg-sky-50 text-sky-700 border-sky-100' :
          'bg-amber-50 text-amber-700 border-amber-100'
        }`}>
          ROC-AUC: {model.roc_auc.toFixed(3)}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div><p className="text-slate-400">Accuracy</p><p className="font-bold text-slate-800">{(model.accuracy * 100).toFixed(1)}%</p></div>
        <div><p className="text-slate-400">Precision</p><p className="font-bold text-slate-800">{(model.precision * 100).toFixed(1)}%</p></div>
        <div><p className="text-slate-400">Recall</p><p className="font-bold text-slate-800">{(model.recall * 100).toFixed(1)}%</p></div>
        <div><p className="text-slate-400">F1</p><p className="font-bold text-slate-800">{(model.f1 * 100).toFixed(1)}%</p></div>
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
    <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
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
  const [gps, setGps] = useState(CAMP_LOCATION)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const STATUS_PRIORITY = { critical: 0, high: 1, medium: 2, stable: 3, recovery: 4 }

  const fetchAll = () => {
    setLoading(true)
    setError('')
    Promise.all([
      fetch(`${API}/api/disaster/camps`).then(r => { if (!r.ok) throw new Error('Camps failed'); return r.json() }),
      fetch(`${API}/api/disaster/prediction-models`).then(r => { if (!r.ok) throw new Error('Models failed'); return r.json() }),
      fetch(`${API}/api/disaster/overview`).then(r => { if (!r.ok) throw new Error('Overview failed'); return r.json() }),
    ])
      .then(([cp, md, ov]) => {
        const camps = cp.camps ?? []
        const sorted = [...camps].sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9))
        setCamp(sorted[0] ?? null)
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
    const dataInterval = setInterval(fetchAll, 30000)
    return () => clearInterval(dataInterval)
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

  if (loading && !camp) return <LoadingState message="Loading disaster data..." fullPage />
  if (error && !camp) return <ErrorState title="Could not load disaster data" message={error} onRetry={fetchAll} />
  if (!camp) return <ErrorState title="Camp data not found" message="No camp data available" onRetry={fetchAll} />

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-linear-to-b from-slate-50 via-white to-slate-50 text-slate-800 font-sans relative">

      <div className="max-w-7xl mx-auto sm:px-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
        <PageHeader icon={Radar} title="Disaster Monitoring" subtitle="Flood prediction, sensor telemetry & model confidence">
          <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
          <span className="font-medium">{new Date().toLocaleTimeString()}</span>
        </PageHeader>

        <motion.div
          key={camp.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className={`${statusMeta.bg} rounded-2xl p-4 flex items-center gap-4 border`}>
            <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center shrink-0 border border-slate-100">
              <Shield className={`w-5 h-5 ${statusMeta.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-lg font-bold text-slate-900">{camp.name}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusMeta.color} bg-white/80 border`}>
                  {statusMeta.label}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  alertLevel === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-200' :
                  alertLevel === 'WARNING' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                  'bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}>
                  Alert: {alertLevel}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {camp.type} &middot; {camp.displaced.toLocaleString()}/{camp.capacity.toLocaleString()} displaced &middot; {camp.workers} workers
              </p>
            </div>
            <span className={`w-3 h-3 rounded-full ${statusMeta.dot} animate-pulse`} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Displaced" value={camp.displaced.toLocaleString()} icon={Activity} color="red" />
            <StatCard label="Capacity" value={camp.capacity.toLocaleString()} icon={MapPin} color="blue" />
            <StatCard label="Occupancy" value={Math.round((camp.displaced / camp.capacity) * 100)} unit="%" icon={Gauge} color="amber" />
            <StatCard label="Aid Coverage" value={camp.aid} unit="%" icon={Shield} color="emerald" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <SectionHeader icon={CloudRain} title="Current Sensor Status" color="sky" />
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-500 font-medium">Water Level</span>
                      <span className="font-bold text-slate-900">{camp.wl.toFixed(2)}m</span>
                    </div>
                    <WaterLevelGauge wl={camp.wl} alertL={camp.alertL} minorL={camp.minorL} majorL={camp.majorL} />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>Alert: {camp.alertL}m</span>
                      <span>Minor: {camp.minorL}m</span>
                      <span>Major: {camp.majorL}m</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[11px] text-slate-400">River</p>
                      <p className="text-sm font-bold text-slate-800">{camp.river}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[11px] text-slate-400">Station</p>
                      <p className="text-sm font-bold text-slate-800">{camp.station} ({camp.stDist.toLocaleString()}m)</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[11px] text-slate-400">Elevation</p>
                      <p className="text-sm font-bold text-slate-800">{camp.elev}m</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[11px] text-slate-400">Water Body</p>
                      <p className="text-sm font-bold text-slate-800">{camp.waterPath}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionHeader icon={Thermometer} title="Environmental Readings" color="orange" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard label="Temperature" value={`${camp.minT} / ${camp.maxT}`} unit="°C" icon={Thermometer} color="orange" />
                  <StatCard label="Humidity" value={camp.hum} unit="%" icon={Droplets} color="blue" />
                  <StatCard label="Rainfall" value={camp.rain} unit="mm" icon={CloudRain} color="blue" />
                  <StatCard label="Precipitation" value={camp.precip} unit="mm" icon={Droplets} color="indigo" />
                  <StatCard label="Wind" value={camp.avgWind} unit="km/h" icon={Wind} color="teal" />
                  <StatCard label="Max Wind" value={camp.maxWind} unit="km/h" icon={Wind} color="amber" />
                  <StatCard label="Pressure" value={camp.pres} unit="hPa" icon={Activity} color="purple" />
                  <StatCard label="Soil Moisture" value={camp.soil?.toFixed(2)} icon={Droplets} color="amber" />
                  <StatCard label="Cloud Cover" value={camp.cloud} unit="%" icon={CloudRain} color="gray" />
                </div>
              </Card>

              <Card>
                <SectionHeader icon={Cpu} title="Device Status" color="indigo" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Edge Gateway', desc: 'Intel NUC' },
                    { label: 'XGBoost Model', desc: `ROC-AUC ${bestModel?.roc_auc.toFixed(3) ?? '0.927'}` },
                    { label: 'Sensor Station', desc: camp.station },
                    { label: 'MQTT Bridge', desc: 'EMQX broker' },
                  ].map((d, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
                      <span className="inline-block w-2 h-2 rounded-full mb-2 bg-emerald-500" />
                      <p className="text-sm font-bold text-slate-800">{d.label}</p>
                      <p className="text-xs text-slate-400">{d.desc}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              {bestModel && (
                <Card>
                  <SectionHeader icon={AlertTriangle} title="Disaster Prediction" color="indigo" />
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold mb-1" style={{
                      color: alertLevel === 'CRITICAL' ? '#ef4444' : alertLevel === 'WARNING' ? '#f59e0b' : '#10b981'
                    }}>
                      {alertLevel}
                    </div>
                    <p className="text-xs text-slate-400">Alert Level</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Camp Status</span>
                      <span className={`font-semibold ${statusMeta.color}`}>{statusMeta.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Best Model</span>
                      <span className="font-semibold text-slate-800 uppercase">{bestModel.model_name.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ROC-AUC</span>
                      <span className="font-semibold text-slate-800">{(bestModel.roc_auc * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Accuracy</span>
                      <span className="font-semibold text-slate-800">{(bestModel.accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Critical Camps</span>
                      <span className={`font-bold ${(overview?.summary?.critical_count ?? 0) > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {overview?.summary?.critical_count ?? 0}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              <Card>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center border border-teal-100">
                    <Navigation className="w-4 h-4 text-teal-600" />
                  </div>
                  <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Current Location</h2>
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-sky-600 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-sky-500" />Fixed</span>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[11px] text-slate-400">Latitude</p>
                      <p className="text-sm font-bold text-slate-800 font-mono">{gps?.latitude != null ? gps.latitude.toFixed(6) : '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[11px] text-slate-400">Longitude</p>
                      <p className="text-sm font-bold text-slate-800 font-mono">{gps?.longitude != null ? gps.longitude.toFixed(6) : '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[11px] text-slate-400">Altitude</p>
                      <p className="text-sm font-bold text-slate-800 font-mono">{gps?.altitude != null ? `${gps.altitude.toFixed(1)}m` : '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[11px] text-slate-400">Satellites</p>
                      <p className="text-sm font-bold text-slate-800 font-mono flex items-center gap-1.5">
                        <Satellite className="w-3.5 h-3.5 text-slate-400" />
                        {gps?.satellites ?? '—'}
                      </p>
                    </div>
                  </div>
                  {gps?.fetched_at && (
                    <p className="text-[10px] text-slate-400 text-right">Updated {new Date(gps.fetched_at).toLocaleTimeString()}</p>
                  )}
                </div>
              </Card>

              <Card>
                <SectionHeader icon={Activity} title="Prediction Confidence" color="violet" />
                <div className="space-y-3">
                  {models.map((m, i) => <ModelCard key={m.model_name} model={m} index={i} />)}
                </div>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
