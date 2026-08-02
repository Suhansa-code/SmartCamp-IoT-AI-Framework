import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit,
  Users,
  TrendingUp,
  Baby,
  Shield,
  Activity,
  FileText,
  PackagePlus,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import Button from '../ui/Button';

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const NETWORK_STYLE = {
  STABLE:   { badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  DEGRADED: { badge: 'bg-amber-50 text-amber-700 border-amber-100',   dot: 'bg-amber-500' },
  CRITICAL: { badge: 'bg-red-50 text-red-700 border-red-100',      dot: 'bg-red-500' },
};

const STATUS_STYLE = {
  none:     'bg-slate-100 text-slate-500 border-slate-200',
  pending:  'bg-amber-50 text-amber-700 border-amber-100',
  sent:     'bg-sky-50 text-sky-700 border-sky-100',
  buffered: 'bg-orange-50 text-orange-700 border-orange-100',
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const STATUS_LABEL = {
  none:     'No forecast yet',
  pending:  'Processing...',
  sent:     'Awaiting cloud',
  buffered: 'Buffered locally',
  complete: 'Complete',
};

const TYPE_LABELS = {
  refugees:          'Refugees',
  asylum_seekers:    'Asylum Seekers',
  idps:              'IDPs',
  returned_refugees: 'Returned Refugees',
  returned_idps:     'Returned IDPs',
  stateless:         'Stateless',
  ooc:               'Others of Concern',
};

function StatChip({ label, value, unit = '', icon: Icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-300"
    >
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-gradient-to-br from-teal-500/10 to-sky-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-4 h-4 text-teal-600" />}
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-2xl font-bold text-slate-800 font-mono tracking-tight">
        {typeof value === 'number' && value < 1 && value > 0
          ? `${(value * 100).toFixed(1)}%`
          : (value?.toLocaleString() ?? '—')}
        {unit && <span className="text-sm text-slate-400 ml-1 font-sans">{unit}</span>}
      </span>
    </motion.div>
  );
}

function ForecastRow({ row, isToday, index }) {
  const r = row.result;
  const pop = row.projected_population;
  const dateObj = new Date(row.date + 'T00:00:00');
  const dayName = isToday ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 + 0.2 }}
      className={`border-t border-slate-100/50 transition-colors ${
        isToday ? 'bg-teal-50/50' : 'hover:bg-slate-50/60'
      }`}
    >
      <td className="px-5 py-4">
        <div className={`font-semibold text-sm ${isToday ? 'text-teal-700' : 'text-slate-700'}`}>{dayName}</div>
        <div className="text-xs text-slate-400">{dateStr}</div>
      </td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
          {pop?.toLocaleString() ?? '—'}
        </span>
      </td>
      {r ? (
        <>
          <td className="px-5 py-4 text-sm font-mono text-amber-700 font-semibold">{r.food_kg_day?.toLocaleString()}</td>
          <td className="px-5 py-4 text-sm font-mono text-sky-700 font-semibold">{r.water_liters_day?.toLocaleString()}</td>
          <td className="px-5 py-4 text-sm font-mono text-emerald-700 font-semibold">{r.shelter_units?.toLocaleString()}</td>
          <td className="px-5 py-4 text-sm font-mono text-violet-700 font-semibold">{r.medical_staff_needed?.toLocaleString()}</td>
        </>
      ) : (
        <td colSpan={4} className="px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-400 italic">
            <Activity className="w-4 h-4 animate-pulse" />
            Computing...
          </div>
        </td>
      )}
    </motion.tr>
  );
}

function PredictionScreen() {
  const [campData, setCampData]       = useState(null);
  const [forecasts, setForecasts]     = useState([]);
  const [reqStatus, setReqStatus]     = useState('none');
  const [requestId, setRequestId]     = useState(null);
  const [networkState, setNetworkState] = useState('STABLE');
  const [mqttInfo, setMqttInfo]       = useState(null);
  const [statusMsg, setStatusMsg]     = useState('');
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    fetch(`${API}/api/prediction/inputs`).then(r => r.json()).then(setCampData).catch(() => {});
    fetch(`${API}/api/network/state`).then(r => r.json()).then(d => setNetworkState(d.state || 'STABLE')).catch(() => {});
    fetch(`${API}/api/prediction/results`).then(r => r.json()).then(d => {
      if (d.status !== 'none') {
        setReqStatus(d.status);
        setRequestId(d.request_id);
        if (d.forecasts) setForecasts(d.forecasts);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!requestId || reqStatus === 'complete' || reqStatus === 'none') return;
    const interval = setInterval(() => {
      fetch(`${API}/api/prediction/results`).then(r => r.json()).then(d => {
        if (d.request_id === requestId) {
          setReqStatus(d.status);
          if (d.forecasts) {
            setForecasts(d.forecasts);
            if (d.status === 'complete') clearInterval(interval);
          }
        }
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [requestId, reqStatus]);

  const handleForecast = useCallback(async () => {
    setLoading(true);
    setStatusMsg('');
    setMqttInfo(null);
    try {
      const res = await fetch(`${API}/api/prediction/forecast?days=7`);
      const data = await res.json();
      if (data.error) { setStatusMsg(data.error); return; }
      setRequestId(data.request_id);
      setReqStatus(data.status);
      setForecasts(data.forecasts || []);
      setMqttInfo(data.mqtt || null);
      setStatusMsg(data.message || (data.status === 'complete' ? '' : 'Forecast submitted'));
    } catch (e) {
      setStatusMsg('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const ns = NETWORK_STYLE[networkState] || NETWORK_STYLE.STABLE;

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-800 font-sans relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-teal-100/40 blur-3xl" />
        <div className="absolute bottom-0 -left-24 w-72 h-72 rounded-full bg-sky-100/40 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-500/25">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight">
                AI Resource Forecast
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Predictive models driven by real-time demographics
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <span className={`px-3.5 py-1.5 border rounded-full text-xs font-medium flex items-center gap-2 tracking-wide ${ns.badge}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${ns.dot}`} />
              {networkState}
            </span>
            <span className={`px-3.5 py-1.5 border rounded-full text-xs font-medium tracking-wide ${STATUS_STYLE[reqStatus]}`}>
              {STATUS_LABEL[reqStatus]}
            </span>
          </div>
        </motion.div>

        {campData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Live Demographics
              </h3>
              <span className="text-[11px] bg-teal-50 text-teal-700 px-3 py-1 rounded-full font-medium border border-teal-100">
                Auto-synced
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatChip label="Total Population" value={campData.total_population} icon={Users} delay={0.1} />
              <StatChip label="Daily Arrival" value={campData.daily_arrival_rate} unit="/ day" icon={TrendingUp} delay={0.2} />
              <StatChip label="Children Ratio" value={campData.children_ratio} icon={Baby} delay={0.3} />
              <StatChip label="Female Ratio" value={campData.female_ratio} icon={Users} delay={0.4} />
              <StatChip label="Yearly Arrivals" value={campData.yearly_arrivals} icon={PackagePlus} delay={0.5} />
              <StatChip label="Pregnant" value={campData.pregnant} icon={Activity} delay={0.6} />
              <StatChip label="Chronic Illness" value={campData.chronic_illness} icon={Shield} delay={0.7} />
              <StatChip label="Elderly Ratio" value={campData.elderly_ratio} icon={Users} delay={0.8} />
            </div>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
              className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl p-5 mt-4 shadow-[0_1px_4px_0_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-teal-600" />
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Category Breakdown</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  campData[key] > 0 && (
                    <span key={key} className="bg-teal-50/50 border border-teal-100 text-teal-800 text-sm px-4 py-1.5 rounded-full font-medium">
                      {label}: <span className="font-bold text-teal-700">{campData[key].toLocaleString()}</span>
                    </span>
                  )
                ))}
                {Object.keys(TYPE_LABELS).every(k => !campData[k]) && (
                  <span className="text-sm text-slate-400 italic">No category breakdown available.</span>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                onClick={handleForecast}
                loading={loading}
                loadingText="Synthesizing..."
              >
                <Sparkles className="w-4 h-4" />
                Generate 7-Day Forecast
              </Button>

              <AnimatePresence mode="wait">
                {statusMsg && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="text-sm font-medium text-slate-600 bg-slate-100 px-4 py-2 rounded-xl"
                  >
                    {statusMsg}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {mqttInfo && (
              <div className="flex gap-2 flex-wrap">
                <span className="bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200">
                  Priority: {mqttInfo.priority}
                </span>
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${mqttInfo.published ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {mqttInfo.published ? 'Published (MQTT)' : 'Buffered Local'}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {forecasts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] overflow-hidden"
            >
              <div className="px-6 sm:px-8 py-6 border-b border-slate-100/50 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800">Forecast Matrix</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Population projected linearly. Resource ratios calculated dynamically via AI.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-4">Date Target</th>
                      <th className="px-5 py-4">Est. Pop.</th>
                      <th className="px-5 py-4 text-amber-700/80">Food (kg/d)</th>
                      <th className="px-5 py-4 text-sky-700/80">Water (L/d)</th>
                      <th className="px-5 py-4 text-emerald-700/80">Shelters</th>
                      <th className="px-5 py-4 text-violet-700/80">Med Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecasts.map((row, i) => (
                      <ForecastRow key={row.date} row={row} isToday={i === 0} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default PredictionScreen;
