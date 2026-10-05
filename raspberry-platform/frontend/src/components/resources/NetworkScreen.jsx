import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, Clock3, Database, Gauge, Radio, RefreshCw,
  ShieldCheck, Wifi,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import ErrorState from '../ui/feedback/ErrorState';
import { API, NETWORK_STATE_DESC } from '../ui/config';
import { COLORS } from '../../lib/tokens';

const FALLBACK_POLL_MS = 15_000;
const TONE = {
  brand: { color: COLORS.brand, bg: '#ECFDF5', border: '#A7F3D0' },
  warning: { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  danger: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  info: { color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  neutral: { color: COLORS.body, bg: '#F8FAFC', border: COLORS.line },
};
const STATE_TONE = { STABLE: 'brand', DEGRADED: 'warning', CRITICAL: 'danger', UNKNOWN: 'neutral' };
const PRIORITY_TONE = { CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'neutral' };
const BASE_QOS = { LOW: 0, MEDIUM: 1, HIGH: 1, CRITICAL: 2 };

function fallbackDecision(priority, state) {
  if (state === 'CRITICAL') return priority === 'CRITICAL' ? { qos: 1 } : { buffer: true };
  if (state === 'DEGRADED' && ['HIGH', 'CRITICAL'].includes(priority)) return { qos: 2 };
  if (state === 'DEGRADED' && priority === 'LOW') return { qos: 1 };
  return { qos: BASE_QOS[priority] };
}

function formatValue(value, digits = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '—';
}

function formatAge(iso) {
  if (!iso) return 'not received';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function Card({ children, className = '' }) {
  return <section className={`rounded-xl border bg-white p-4 sm:p-5 ${className}`} style={{ borderColor: COLORS.line }}>{children}</section>;
}

function Chip({ children, tone = 'neutral' }) {
  const t = TONE[tone] || TONE.neutral;
  return <span className="inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold" style={{ color: t.color, background: t.bg, borderColor: t.border }}>{children}</span>;
}

function SectionTitle({ icon: Icon, title, subtitle, action }) {
  return <div className="mb-4 flex items-start justify-between gap-3"><div className="flex items-start gap-2.5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: TONE.brand.bg, color: TONE.brand.color }}><Icon className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold" style={{ color: COLORS.ink }}>{title}</h2>{subtitle && <p className="mt-0.5 text-xs" style={{ color: COLORS.muted }}>{subtitle}</p>}</div></div>{action}</div>;
}

function Metric({ label, value, unit, icon: Icon, tone = 'neutral' }) {
  const t = TONE[tone] || TONE.neutral;
  return <div className="rounded-lg border p-3" style={{ borderColor: t.border, background: t.bg }}><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: COLORS.muted }}>{label}</span><Icon className="h-3.5 w-3.5" style={{ color: t.color }} /></div><p className="mt-2 font-mono text-xl font-semibold" style={{ color: t.color }}>{value}<span className="ml-1 text-xs font-normal">{unit}</span></p></div>;
}

function metricTone(value, warning, critical) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'neutral';
  if (n >= critical) return 'danger';
  if (n >= warning) return 'warning';
  return 'brand';
}

export default function NetworkScreen() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [lastAt, setLastAt] = useState(null);

  const acceptStatus = useCallback((next) => {
    setStatus(next);
    setError(null);
    setLastAt(new Date());
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/network/status`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      acceptStatus(await response.json());
    } catch (requestError) {
      setError(requestError.message || 'Unable to reach the network monitor');
    }
  }, [acceptStatus]);

  useEffect(() => {
    fetchStatus();
    const poll = window.setInterval(fetchStatus, FALLBACK_POLL_MS);
    if (!window.EventSource) return () => window.clearInterval(poll);

    const source = new EventSource(`${API}/api/network/stream`);
    const onNetwork = (event) => {
      try {
        acceptStatus(JSON.parse(event.data));
        setStreamConnected(true);
      } catch { /* Ignore malformed events and wait for the next sample. */ }
    };
    source.addEventListener('network', onNetwork);
    source.onerror = () => setStreamConnected(false);
    return () => {
      window.clearInterval(poll);
      source.removeEventListener('network', onNetwork);
      source.close();
    };
  }, [acceptStatus, fetchStatus]);

  const state = status?.state || 'UNKNOWN';
  const tone = STATE_TONE[state] || 'neutral';
  const stateTone = TONE[tone];
  const metrics = status?.metrics || {};
  const diagnostics = status?.diagnostics || {};
  const history = useMemo(() => (status?.history || []).map((sample) => ({
    ...sample.metrics,
    at: sample.at,
    time: sample.at ? new Date(sample.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
    state: sample.state,
  })), [status]);
  const transitions = useMemo(() => history.filter((row, index) => index === 0 || row.state !== history[index - 1].state).slice(-5).reverse(), [history]);
  const policy = diagnostics.qos_policy || null;
  const buffered = status?.buffered_messages || 0;

  return (
    <div className="mx-auto min-h-screen max-w-7xl bg-white font-sans" style={{ color: COLORS.ink }}>
      <div className="space-y-4 py-2 sm:space-y-5 sm:py-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: COLORS.muted }}>Camp operations · live telemetry</p><h1 className="mt-1 font-serif text-3xl font-medium tracking-tight">Network QoS Monitor</h1><p className="mt-2 text-sm" style={{ color: COLORS.muted }}>Clear link health, forecast risk, and the exact delivery policy now in effect.</p></div>
          <div className="flex items-center gap-2 text-xs font-mono" style={{ color: COLORS.muted }}><Radio className={`h-3.5 w-3.5 ${streamConnected ? 'animate-pulse' : ''}`} style={{ color: streamConnected ? COLORS.brand : TONE.warning.color }} /><span>{streamConnected ? 'Live stream connected' : `Snapshot fallback · ${lastAt ? lastAt.toLocaleTimeString() : 'connecting'}`}</span></div>
        </header>

        {error && <ErrorState title="Network monitor unavailable" message={error} onRetry={fetchStatus} />}
        {!error && state === 'UNKNOWN' && <div className="flex gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: TONE.warning.bg, borderColor: TONE.warning.border, color: TONE.warning.color }}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>No QoS observation has arrived.</strong> Start <code className="rounded px-1" style={{ background: '#FDE68A' }}>python3 scripts/network_monitor_service.py</code> on the Pi.</span></div>}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-[11px] font-mono font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>Effective delivery state</p><div className="mt-2 flex items-center gap-3"><span className="h-3 w-3 rounded-full animate-pulse" style={{ background: stateTone.color }} /><span className="font-serif text-3xl font-medium" style={{ color: stateTone.color }}>{state}</span><Chip tone={tone}>{diagnostics.stale ? 'transport fallback' : metrics.decision?.source === 'safety_floor' ? 'live safety override' : 'forecast active'}</Chip></div><p className="mt-2 max-w-xl text-sm" style={{ color: COLORS.body }}>{NETWORK_STATE_DESC[state]}</p>{metrics.decision && <p className="mt-1 text-[11px]" style={{ color: COLORS.muted }}>Forecast: {metrics.decision.forecast_state} · observed link: {metrics.decision.observed_state}</p>}</div><div className="rounded-lg border px-3 py-2 text-right" style={{ borderColor: stateTone.border, background: stateTone.bg }}><p className="text-[10px] font-mono uppercase" style={{ color: COLORS.muted }}>last observation</p><p className="mt-1 text-sm font-semibold" style={{ color: stateTone.color }}>{formatAge(status?.updated_at)}</p>{diagnostics.raw_state && diagnostics.raw_state !== state && <p className="mt-1 text-[10px]" style={{ color: COLORS.muted }}>raw: {diagnostics.raw_state} · recovery {diagnostics.recovery_progress}</p>}</div></div>
            <div className="mt-5 grid grid-cols-2 gap-2 border-t pt-4 sm:grid-cols-4" style={{ borderColor: COLORS.hairline }}><Metric label="Latency" value={formatValue(metrics.rtt_avg)} unit="ms" icon={Gauge} tone={metricTone(metrics.rtt_avg, 200, 500)} /><Metric label="Packet loss" value={formatValue(metrics.packet_loss, 1)} unit="%" icon={Activity} tone={metricTone(metrics.packet_loss, 5, 15)} /><Metric label="Jitter" value={formatValue(metrics.jitter)} unit="ms" icon={Activity} tone={metricTone(metrics.jitter, 30, 80)} /><Metric label="Broker" value={metrics.bridge_alive === false ? 'DOWN' : formatValue(metrics.broker_rtt)} unit={metrics.bridge_alive === false ? '' : 'ms'} icon={Wifi} tone={metrics.bridge_alive === false ? 'danger' : metricTone(metrics.broker_rtt, 300, 1000)} /></div>
          </Card>
          <Card>
            <SectionTitle icon={ShieldCheck} title="Adaptive action" subtitle="Policy used by the publish path" action={<Chip tone={diagnostics.qos_source === 'model' ? 'info' : 'neutral'}>{diagnostics.qos_source || 'rules'}</Chip>} />
            <div className="space-y-2">{['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => { const value = policy?.[priority]; const decision = value === -1 ? { buffer: true } : value !== undefined ? { qos: value } : fallbackDecision(priority, state); const pTone = TONE[PRIORITY_TONE[priority]]; return <div className="flex items-center justify-between rounded-lg px-3 py-2" key={priority} style={{ background: COLORS.hairline }}><span className="text-xs font-mono font-semibold" style={{ color: pTone.color }}>{priority}</span><span className="text-xs font-semibold" style={{ color: decision.buffer ? TONE.warning.color : COLORS.body }}>{decision.buffer ? 'Buffer until recovery' : `Publish · QoS ${decision.qos}`}</span></div>; })}</div>
            <p className="mt-3 text-[11px]" style={{ color: COLORS.muted }}>Policy expires safely if the monitor stops reporting; SAAMP then uses its built-in rules.</p>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2"><SectionTitle icon={Activity} title="Live QoS trend" subtitle="Recent monitor observations · latency and packet loss use separate scales" action={<Chip tone={history.length > 1 ? 'brand' : 'neutral'}>{history.length} samples</Chip>} />{history.length > 1 ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}><defs><linearGradient id="latencyFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#00acf0" stopOpacity={0.25} /><stop offset="100%" stopColor="#00acf0" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" /><XAxis dataKey="time" tick={{ fill: COLORS.muted, fontSize: 10 }} minTickGap={35} axisLine={false} tickLine={false} /><YAxis yAxisId="latency" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="loss" orientation="right" domain={[0, 100]} tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 8, borderColor: COLORS.line, fontSize: 12 }} formatter={(value, name) => [`${Number(value).toFixed(name === 'Packet loss' ? 1 : 0)}${name === 'Packet loss' ? '%' : ' ms'}`, name]} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area yAxisId="latency" type="monotone" dataKey="rtt_avg" name="Latency" stroke="#00acf0" strokeWidth={2} fill="url(#latencyFill)" /><Area yAxisId="loss" type="monotone" dataKey="packet_loss" name="Packet loss" stroke="#DC2626" strokeWidth={2} fill="transparent" /></AreaChart></ResponsiveContainer></div> : <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center" style={{ borderColor: COLORS.line, color: COLORS.muted }}><RefreshCw className="h-5 w-5" /><p className="mt-2 text-sm">Waiting for two QoS samples</p><p className="mt-1 text-xs">The chart fills as the Pi reports each measurement.</p></div>}</Card>
          <Card><SectionTitle icon={Clock3} title="State changes" subtitle="Newest first" />{transitions.length ? <ol className="space-y-3">{transitions.map((item, index) => { const itemTone = TONE[STATE_TONE[item.state]]; return <li className="flex gap-3" key={`${item.at}-${index}`}><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: itemTone.color }} /><div className="min-w-0"><p className="text-xs font-semibold" style={{ color: itemTone.color }}>{item.state}</p><p className="text-[11px]" style={{ color: COLORS.muted }}>{item.at ? new Date(item.at).toLocaleString() : 'time unavailable'} · RTT {formatValue(item.rtt_avg)}ms · loss {formatValue(item.packet_loss, 1)}%</p></div></li>; })}</ol> : <p className="py-8 text-center text-sm" style={{ color: COLORS.muted }}>No transitions recorded yet.</p>}</Card>
        </div>

        <Card><SectionTitle icon={Database} title="Recovery buffer" subtitle="Messages retained while the link is unsafe, sent by priority after recovery" action={<div className="text-right"><p className="font-mono text-2xl font-semibold" style={{ color: buffered ? TONE.warning.color : COLORS.brand }}>{buffered}</p><p className="text-[10px] uppercase" style={{ color: COLORS.muted }}>held messages</p></div>} /><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(status?.buffer_by_priority || []).map(({ priority, count, oldest_at, flush_position }) => { const t = TONE[PRIORITY_TONE[priority]]; return <div className="rounded-lg border p-3" key={priority} style={{ borderColor: t.border, background: t.bg }}><div className="flex justify-between"><span className="text-xs font-mono font-semibold" style={{ color: t.color }}>{flush_position}. {priority}</span><span className="font-mono text-lg font-semibold" style={{ color: t.color }}>{count}</span></div><p className="mt-1 text-[10px]" style={{ color: COLORS.muted }}>{count ? `oldest ${formatAge(oldest_at?.replace(' ', 'T') + 'Z')}` : 'nothing queued'}</p></div>; })}</div>{metrics.queue_depth !== undefined && <p className="mt-3 text-xs" style={{ color: COLORS.muted }}>Current publisher queue depth: <strong style={{ color: COLORS.body }}>{metrics.queue_depth}</strong></p>}</Card>
      </div>
    </div>
  );
}
