import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, Users, TrendingUp, Baby, Shield, Activity,
  FileText, PackagePlus, CalendarDays, Sparkles, RefreshCw,
} from 'lucide-react';
import { API } from '../ui/config';
import { COLORS, SHADOW_CARD } from '../../lib/tokens';

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

/* ------------------------------------------------------------------ */
/*  LOCAL PRIMITIVES — mirror the FloodWatch / ReliefOps design system  */
/* ------------------------------------------------------------------ */

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border bg-white ${className}`} style={{ borderColor: COLORS.line }}>
      {children}
    </div>
  );
}

function IconTile({ icon: Icon, tone = "brand", size = "md" }) {
  const t = TONE[tone] || TONE.brand;
  const dims = size === "lg" ? "w-10 h-10 sm:w-11 sm:h-11" : "w-9 h-9";
  return (
    <div className={`${dims} rounded-lg flex items-center justify-center shrink-0 border`} style={{ backgroundColor: t.bg, borderColor: t.border }}>
      <Icon className={size === "lg" ? "w-5 h-5" : "w-4 h-4"} style={{ color: t.color }} strokeWidth={1.7} />
    </div>
  );
}

function Chip({ children, tone = "neutral" }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide border"
      style={{ color: t.color, backgroundColor: t.bg, borderColor: t.border }}
    >
      {children}
    </span>
  );
}

function SectionHeader({ icon, title, subtitle, badge }) {
  return (
    <div className="flex items-center justify-between mb-3 sm:mb-4">
      <div className="flex items-center gap-3">
        <IconTile icon={icon} />
        <div>
          <h2 className="text-[13.5px] sm:text-[14px] font-semibold" style={{ color: COLORS.ink }}>{title}</h2>
          {subtitle && <p className="text-[11px] sm:text-[11.5px]" style={{ color: COLORS.muted }}>{subtitle}</p>}
        </div>
      </div>
      {badge && <Chip tone="brand">{badge}</Chip>}
    </div>
  );
}

function Button({ loading, loadingText, children, className = "", ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold py-2.5 px-4 text-white transition-opacity disabled:opacity-40 hover:opacity-90 ${className}`}
      style={{ backgroundColor: COLORS.brand }}
    >
      {loading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> {loadingText || "Working…"}</> : children}
    </button>
  );
}

function StatTile({ label, value, unit, icon: Icon, tone = "brand" }) {
  const t = TONE[tone] || TONE.brand;
  return (
    <Card className="p-3.5 relative overflow-hidden group">
      <div
        className="absolute -right-5 -top-5 w-20 h-20 rounded-full group-hover:scale-150 transition-transform duration-500"
        style={{ backgroundColor: t.bg }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.06em] font-mono" style={{ color: COLORS.muted }}>{label}</span>
          <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
        </div>
        <p className="text-[18px] sm:text-[19px] font-semibold font-mono tracking-tight" style={{ color: COLORS.ink }}>
          {value ?? '—'}<span className="text-[11px] font-normal" style={{ color: COLORS.muted }}>{unit}</span>
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  FORECAST ROW                                                        */
/* ------------------------------------------------------------------ */

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
      transition={{ delay: index * 0.05 + 0.15 }}
      className="border-t transition-colors"
      style={{ borderColor: COLORS.hairline, backgroundColor: isToday ? `${COLORS.brand}0A` : 'transparent' }}
    >
      <td className="px-4 sm:px-5 py-3.5">
        <div className="font-semibold text-[12.5px]" style={{ color: isToday ? COLORS.brand : COLORS.ink }}>{dayName}</div>
        <div className="text-[10.5px] font-mono" style={{ color: COLORS.muted }}>{dateStr}</div>
      </td>
      <td className="px-4 sm:px-5 py-3.5">
        <Chip>{pop?.toLocaleString() ?? '—'}</Chip>
      </td>
      {r ? (
        <>
          <td className="px-4 sm:px-5 py-3.5 text-[12.5px] font-mono font-semibold" style={{ color: '#B45309' }}>{r.food_kg_day?.toLocaleString()}</td>
          <td className="px-4 sm:px-5 py-3.5 text-[12.5px] font-mono font-semibold" style={{ color: '#0284C7' }}>{r.water_liters_day?.toLocaleString()}</td>
          <td className="px-4 sm:px-5 py-3.5 text-[12.5px] font-mono font-semibold" style={{ color: COLORS.brand }}>{r.shelter_units?.toLocaleString()}</td>
          <td className="px-4 sm:px-5 py-3.5 text-[12.5px] font-mono font-semibold" style={{ color: '#7C3AED' }}>{r.medical_staff_needed?.toLocaleString()}</td>
        </>
      ) : (
        <td colSpan={4} className="px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2 text-[12.5px] italic" style={{ color: COLORS.muted }}>
            <Activity className="w-3.5 h-3.5 animate-pulse" /> Computing...
          </div>
        </td>
      )}
    </motion.tr>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN SCREEN                                                         */
/* ------------------------------------------------------------------ */

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
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>
      <div className="sm:px-5 lg:px-6 py-5 sm:py-7 space-y-4 sm:space-y-6">

        {/* ================= TITLE ROW ================= */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.12em]" style={{ color: COLORS.muted }}>Camp operations</p>
            <div className="flex items-center gap-3 mt-1.5">
              <IconTile icon={BrainCircuit} size="lg" />
              <h1 className="font-serif font-medium text-[26px] sm:text-[32px] leading-[1.1] tracking-tight">AI Prediction</h1>
            </div>
            <p className="text-[12.5px] mt-2" style={{ color: COLORS.muted }}>Resource allocation forecast, projected 7 days ahead</p>
          </div>
        </div>

        {campData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <Card className="p-4 sm:p-6">
              <SectionHeader icon={Users} title="Live Demographics" badge="Auto-synced" />

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatTile label="Population" value={campData.total_population?.toLocaleString()} icon={Users} tone="brand" />
                <StatTile label="Daily Arrival" value={campData.daily_arrival_rate} unit=" /day" icon={TrendingUp} tone="warning" />
                <StatTile label="Children Ratio" value={campData.children_ratio} icon={Baby} tone="info" />
                <StatTile label="Female Ratio" value={campData.female_ratio} icon={Users} tone="violet" />
                <StatTile label="Yearly Arrivals" value={campData.yearly_arrivals?.toLocaleString()} icon={PackagePlus} tone="brand" />
                <StatTile label="Pregnant" value={campData.pregnant} icon={Activity} tone="danger" />
                <StatTile label="Chronic Illness" value={campData.chronic_illness} icon={Shield} tone="warning" />
                <StatTile label="Elderly Ratio" value={campData.elderly_ratio} icon={Users} tone="neutral" />
              </div>

              <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t" style={{ borderColor: COLORS.hairline }}>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-3.5 h-3.5" style={{ color: COLORS.muted }} />
                  <span className="text-[11px] uppercase tracking-[0.08em] font-mono" style={{ color: COLORS.muted }}>Category Breakdown</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(TYPE_LABELS).map(([key, label]) => (
                    campData[key] > 0 && (
                      <Chip key={key} tone="brand">{label}: {campData[key].toLocaleString()}</Chip>
                    )
                  ))}
                  {Object.keys(TYPE_LABELS).every(k => !campData[k]) && (
                    <span className="text-[12.5px] italic" style={{ color: COLORS.muted }}>No category breakdown available.</span>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <Card className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={handleForecast} loading={loading} loadingText="Synthesizing…">
                <Sparkles className="w-3.5 h-3.5" /> Generate 7-Day Forecast
              </Button>

              <AnimatePresence mode="wait">
                {statusMsg && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg"
                    style={{ color: COLORS.body, backgroundColor: '#F5F6F5' }}
                  >
                    {statusMsg}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {mqttInfo && (
              <div className="flex gap-1.5 flex-wrap">
                <Chip>Priority: {mqttInfo.priority}</Chip>
                <Chip tone={mqttInfo.published ? 'brand' : 'warning'}>
                  {mqttInfo.published ? 'Published (MQTT)' : 'Buffered Local'}
                </Chip>
              </div>
            )}
          </div>
        </Card>

        <AnimatePresence>
          {forecasts.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b flex items-center gap-3" style={{ borderColor: COLORS.hairline }}>
                <IconTile icon={CalendarDays} />
                <div>
                  <h2 className="text-[13.5px] sm:text-[14px] font-semibold" style={{ color: COLORS.ink }}>Forecast Matrix</h2>
                  <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.muted }}>Population projected linearly. Resource ratios calculated dynamically via AI.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] font-mono font-semibold uppercase tracking-[0.06em]" style={{ color: COLORS.muted, backgroundColor: '#FAFAF9' }}>
                      <th className="px-4 sm:px-5 py-3">Date Target</th>
                      <th className="px-4 sm:px-5 py-3">Est. Pop.</th>
                      <th className="px-4 sm:px-5 py-3" style={{ color: '#B45309' }}>Food kg/d</th>
                      <th className="px-4 sm:px-5 py-3" style={{ color: '#0284C7' }}>Water L/d</th>
                      <th className="px-4 sm:px-5 py-3" style={{ color: COLORS.brand }}>Shelters</th>
                      <th className="px-4 sm:px-5 py-3" style={{ color: '#7C3AED' }}>Med Staff</th>
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