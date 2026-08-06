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
import Button from '../ui/base/Button';
import { API, NETWORK_STYLE } from '../ui/config';
import PageHeader from '../ui/base/PageHeader';
import Card from '../ui/base/Card';
import SectionHeader from '../ui/base/SectionHeader';
import StatCard from '../ui/base/StatCard';

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

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-800 font-sans relative">

      <div className="max-w-7xl mx-auto sm:px-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
        <PageHeader
          icon={BrainCircuit}
          title="AI Prediction"
          subtitle="Resource allocation forecast"
        />

        {campData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <SectionHeader
              title="Live Demographics"
              icon={Users}
              badge="Auto-synced"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatCard label="Total Population" value={campData.total_population} icon={Users} delay={0.1} color="teal" />
              <StatCard label="Daily Arrival" value={campData.daily_arrival_rate} unit="/ day" icon={TrendingUp} delay={0.2} color="amber" />
              <StatCard label="Children Ratio" value={campData.children_ratio} icon={Baby} delay={0.3} color="sky" />
              <StatCard label="Female Ratio" value={campData.female_ratio} icon={Users} delay={0.4} color="violet" />
              <StatCard label="Yearly Arrivals" value={campData.yearly_arrivals} icon={PackagePlus} delay={0.5} color="emerald" />
              <StatCard label="Pregnant" value={campData.pregnant} icon={Activity} delay={0.6} color="rose" />
              <StatCard label="Chronic Illness" value={campData.chronic_illness} icon={Shield} delay={0.7} color="orange" />
              <StatCard label="Elderly Ratio" value={campData.elderly_ratio} icon={Users} delay={0.8} color="slate" />
            </div>

            <Card delay={0.9} className="p-5 mt-4">
              <SectionHeader
                title="Category Breakdown"
                icon={FileText}
              />
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
            </Card>
          </motion.div>
        )}

        <Card delay={0.2} className="p-6 sm:p-8">
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
        </Card>

        <AnimatePresence>
          {forecasts.length > 0 && (
            <Card delay={0.2} className="overflow-hidden">
              <div className="px-6 sm:px-8 py-6 border-b border-slate-100/50">
                <SectionHeader
                  title="Forecast Matrix"
                  icon={CalendarDays}
                  subtitle="Population projected linearly. Resource ratios calculated dynamically via AI."
                />
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
            </Card>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default PredictionScreen;
