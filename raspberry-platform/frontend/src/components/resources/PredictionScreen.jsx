import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, BrainCircuit, Users, TrendingUp, Baby, Shield, Activity as Heartbeat, FileText, PackagePlus } from 'lucide-react';

const API = 'http://localhost:5000';

const NETWORK_STYLE = {
  STABLE:   { badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', dot: 'bg-emerald-500' },
  DEGRADED: { badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',   dot: 'bg-amber-500' },
  CRITICAL: { badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20',      dot: 'bg-rose-500' },
};

const STATUS_STYLE = {
  none:     'bg-slate-500/10 text-slate-400 border-slate-500/20',
  pending:  'bg-amber-500/10 text-amber-500 border-amber-500/20',
  sent:     'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  buffered: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  complete: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
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
      className="bg-white/40 backdrop-blur-md border border-white/40 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:bg-white/60 hover:shadow-lg transition-all duration-300"
    >
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-4 h-4 text-indigo-500" />}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
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
        isToday ? 'bg-indigo-50/50' : 'hover:bg-white/60'
      }`}
    >
      <td className="px-5 py-4">
        <div className={`font-semibold text-sm ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{dayName}</div>
        <div className="text-xs text-slate-400">{dateStr}</div>
      </td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
          {pop?.toLocaleString() ?? '—'}
        </span>
      </td>
      {r ? (
        <>
          <td className="px-5 py-4 text-sm font-mono text-amber-600 font-semibold">{r.food_kg_day?.toLocaleString()}</td>
          <td className="px-5 py-4 text-sm font-mono text-blue-600 font-semibold">{r.water_liters_day?.toLocaleString()}</td>
          <td className="px-5 py-4 text-sm font-mono text-emerald-600 font-semibold">{r.shelter_units?.toLocaleString()}</td>
          <td className="px-5 py-4 text-sm font-mono text-purple-600 font-semibold">{r.medical_staff_needed?.toLocaleString()}</td>
        </>
      ) : (
        <td colSpan={4} className="px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-400 italic">
            <Activity className="w-4 h-4 animate-spin-slow" />
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
    <div className="max-w-5xl mx-auto space-y-8 pb-12">

        {/* Header Glass Card */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 flex items-start justify-between gap-6 flex-wrap"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-slate-800">
                AI Resource Forecast
              </h2>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                Predictive models driven by real-time demographics
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <span className={`px-4 py-2 border rounded-full text-xs font-bold flex items-center gap-2 tracking-wide uppercase shadow-sm ${ns.badge}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${ns.dot}`} />
              {networkState}
            </span>
            <span className={`px-4 py-2 border rounded-full text-xs font-bold tracking-wide uppercase shadow-sm ${STATUS_STYLE[reqStatus]}`}>
              {STATUS_LABEL[reqStatus]}
            </span>
          </div>
        </motion.div>

        {/* Demographics Dashboard */}
        {campData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-2">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Live Demographics
              </h3>
              <span className="text-xs bg-indigo-100/50 text-indigo-700 px-3 py-1 rounded-full font-semibold border border-indigo-200/50">
                Auto-synced
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatChip label="Total Population" value={campData.total_population} icon={Users} delay={0.1} />
              <StatChip label="Daily Arrival" value={campData.daily_arrival_rate} unit="/ day" icon={TrendingUp} delay={0.2} />
              <StatChip label="Children Ratio" value={campData.children_ratio} icon={Baby} delay={0.3} />
              <StatChip label="Female Ratio" value={campData.female_ratio} icon={Users} delay={0.4} />
              <StatChip label="Yearly Arrivals" value={campData.yearly_arrivals} icon={PackagePlus} delay={0.5} />
              <StatChip label="Pregnant" value={campData.pregnant} icon={Heartbeat} delay={0.6} />
              <StatChip label="Chronic Illness" value={campData.chronic_illness} icon={Shield} delay={0.7} />
              <StatChip label="Elderly Ratio" value={campData.elderly_ratio} icon={Users} delay={0.8} />
            </div>

            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
              className="bg-white/40 backdrop-blur-md rounded-2xl p-5 border border-white/40 mt-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-indigo-500" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Category Breakdown</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  campData[key] > 0 && (
                    <span key={key} className="bg-white border border-indigo-100 text-indigo-700 text-sm px-4 py-1.5 rounded-full font-medium shadow-sm hover:shadow-md transition-shadow">
                      {label}: <span className="font-bold">{campData[key].toLocaleString()}</span>
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

        {/* Action Area */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl shadow-sm p-6 sm:p-8 relative overflow-hidden"
        >
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleForecast}
                disabled={loading}
                className="relative group px-8 py-3.5 bg-slate-900 disabled:bg-slate-300 text-white font-bold rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(15,23,42,0.2)] hover:shadow-[0_0_30px_rgba(15,23,42,0.4)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-2">
                  {loading ? <Activity className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                  {loading ? 'Synthesizing...' : 'Generate 7-Day Forecast'}
                </span>
              </button>

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
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200">
                  Priority: {mqttInfo.priority}
                </span>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${mqttInfo.published ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                  {mqttInfo.published ? 'Published (MQTT)' : 'Buffered Local'}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Forecast Table */}
        <AnimatePresence>
          {forecasts.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white overflow-hidden"
            >
              <div className="px-6 sm:px-8 py-6 border-b border-slate-100/50 bg-white/50">
                <h3 className="text-xl font-bold text-slate-800">Forecast Matrix</h3>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  Population projected linearly. Resource ratios calculated dynamically via AI.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-4">Date Target</th>
                      <th className="px-5 py-4">Est. Pop.</th>
                      <th className="px-5 py-4 text-amber-600/80">Food (kg/d)</th>
                      <th className="px-5 py-4 text-blue-600/80">Water (L/d)</th>
                      <th className="px-5 py-4 text-emerald-600/80">Shelters</th>
                      <th className="px-5 py-4 text-purple-600/80">Med Staff</th>
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
  );
}

export default PredictionScreen;
