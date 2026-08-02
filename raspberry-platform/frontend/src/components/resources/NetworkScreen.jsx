import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Wifi, Layers, Database, RefreshCw, AlertTriangle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const POLL_MS = 10_000;

const STATE_STYLE = {
  STABLE:   { badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',  dot: 'bg-emerald-500',  border: 'border-emerald-200', text: 'text-emerald-700' },
  DEGRADED: { badge: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500', border: 'border-amber-200', text: 'text-amber-700' },
  CRITICAL: { badge: 'bg-red-50 text-red-700 border-red-100',      dot: 'bg-red-500',    border: 'border-red-200',   text: 'text-red-700' },
  UNKNOWN:  { badge: 'bg-slate-100 text-slate-500 border-slate-200',    dot: 'bg-slate-400',   border: 'border-slate-200',  text: 'text-slate-500' },
};

const STATE_DESC = {
  STABLE:   'Network healthy — full QoS 2 for critical messages',
  DEGRADED: 'Network congested — QoS automatically upgraded to protect delivery',
  CRITICAL: 'Network failing — critical messages downgraded to QoS 1, others buffered',
  UNKNOWN:  'Waiting for first ML prediction…',
};

// Matches decideAdaptiveQoS in saampMqtt.js
// STABLE:   full base QoS (CRITICAL → QoS 2, network can handle it)
// DEGRADED: QoS upgraded to protect delivery on stressed network
// CRITICAL: only CRITICAL priority sent at QoS 1 (2-way handshake survives lossy links better than QoS 2's 4-way)
const QOS_TABLE = [
  { priority: 'CRITICAL', pColor: 'text-red-600',    stable: { qos: 2, buf: false }, degraded: { qos: 2, buf: false }, critical: { qos: 1, buf: false } },
  { priority: 'HIGH',     pColor: 'text-orange-500', stable: { qos: 1, buf: false }, degraded: { qos: 2, buf: false }, critical: { qos: 1, buf: true  } },
  { priority: 'MEDIUM',   pColor: 'text-sky-600',   stable: { qos: 1, buf: false }, degraded: { qos: 1, buf: false }, critical: { qos: 1, buf: true  } },
  { priority: 'LOW',      pColor: 'text-slate-500',   stable: { qos: 0, buf: false }, degraded: { qos: 1, buf: false }, critical: { qos: 0, buf: true  } },
];

function metricColor(value, warn, crit, invert = false) {
  const n = parseFloat(value);
  if (isNaN(n)) return 'text-slate-400';
  if (invert) return n < crit ? 'text-red-600' : n < warn ? 'text-amber-600' : 'text-emerald-600';
  return n > crit ? 'text-red-600' : n > warn ? 'text-amber-600' : 'text-emerald-600';
}

function card() {
  return 'bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-6 sm:p-8';
}

function CardHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function NetworkScreen() {
  const [status, setStatus] = useState(null);
  const [error, setError]   = useState(null);
  const [lastAt, setLastAt] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/network/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
      setLastAt(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const state    = status?.state || 'UNKNOWN';
  const st       = STATE_STYLE[state] || STATE_STYLE.UNKNOWN;
  const m        = status?.metrics   || {};
  const buffered = status?.buffered_messages ?? 0;
  const updatedAt = status?.updated_at
    ? new Date(status.updated_at).toLocaleTimeString()
    : '—';

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
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight">
                Network Monitor
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                ML-predicted link health and adaptive QoS decisions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/80 border border-slate-200/80 rounded-full px-3.5 py-1.5 w-fit shadow-sm">
            <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${lastAt ? '' : 'animate-spin'}`} />
            <span className="font-medium">Refreshes every {POLL_MS / 1000}s</span>
          </div>
        </motion.div>

        {/* ── State banner ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`${card()} border-2 ${st.border}`}
        >
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                ML-Predicted Network State
              </p>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${st.dot} animate-pulse`} />
                <span className={`text-3xl font-bold ${st.text}`}>{state}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${st.badge} border`}>
                  Random Forest
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-2">{STATE_DESC[state]}</p>
            </div>
            <div className="text-right text-xs text-slate-400 space-y-1">
              <p>Updated {updatedAt}</p>
              <p>{lastAt ? `Polled ${lastAt.toLocaleTimeString()}` : 'Connecting…'}</p>
            </div>
          </div>
        </motion.div>

        {/* ── Warning banners ──────────────────────────── */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Backend unreachable:</span> {error}.
              Start with <code className="bg-red-100 px-1 rounded">npm start</code> in{' '}
              <code className="bg-red-100 px-1 rounded">raspberry-platform/backend</code>.
            </div>
          </div>
        )}
        {!error && state === 'UNKNOWN' && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-800">
            <Activity className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">No ML prediction received yet.</span> Start the monitor service:
              <br />
              <code className="bg-amber-100 px-1 rounded text-xs">
                python3 scripts/network_monitor_service.py
              </code>
            </div>
          </div>
        )}

        {/* ── Live metrics ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={card()}
        >
          <CardHeader icon={Activity} title="Live Network Metrics" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {[
              { label: 'RTT Average',  val: m.rtt_avg,     unit: ' ms',   warn: 200,  crit: 500  },
              { label: 'RTT Max',      val: m.rtt_max,     unit: ' ms',   warn: 400,  crit: 999  },
              { label: 'Packet Loss',  val: m.packet_loss, unit: '%',     warn: 5,    crit: 15   },
              { label: 'Jitter',       val: m.jitter,      unit: ' ms',   warn: 30,   crit: 80   },
              { label: 'Bandwidth',    val: m.bandwidth,   unit: ' Mbps', warn: 5,    crit: 1,   invert: true },
              { label: 'Queue Depth',  val: m.queue_depth, unit: '',      warn: 50,   crit: 100  },
            ].map(({ label, val, unit, warn, crit, invert }) => (
              <div key={label} className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-sm text-slate-500">{label}</span>
                <span className={`text-sm font-bold ${val !== undefined ? metricColor(val, warn, crit, invert) : 'text-slate-400'}`}>
                  {val !== undefined ? `${val}${unit}` : '—'}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-sm text-slate-500">Broker alive</span>
              <span className={`text-sm font-bold ${m.bridge_alive === true ? 'text-emerald-600' : m.bridge_alive === false ? 'text-red-600' : 'text-slate-400'}`}>
                {m.bridge_alive === true ? 'YES' : m.bridge_alive === false ? 'DOWN' : '—'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── QoS Decision Table ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={card()}
        >
          <CardHeader icon={Layers} title="Adaptive QoS Decisions" subtitle="(current state highlighted)" />
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-medium mb-2">
            <div />
            {['STABLE', 'DEGRADED', 'CRITICAL'].map(s => (
              <div key={s} className={`rounded-lg py-2 ${state === s ? `${STATE_STYLE[s].badge} border ring-2 ring-offset-1 ${STATE_STYLE[s].border.replace('border-', 'ring-')}` : 'bg-slate-100 text-slate-400'}`}>
                {s}
              </div>
            ))}
          </div>
          {QOS_TABLE.map(row => (
            <div key={row.priority} className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
              <div className={`font-bold text-left flex items-center ${row.pColor}`}>
                {row.priority}
              </div>
              {(['stable', 'degraded', 'critical']).map(col => {
                const cell = row[col];
                const colState = col.toUpperCase();
                const isActive = state === colState;
                return (
                  <div key={col} className={`rounded-lg py-2 font-semibold transition-all ${
                    isActive
                      ? cell.buf
                        ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-300'
                        : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300'
                      : 'bg-slate-50 text-slate-400'
                  }`}>
                    <div>QoS {cell.qos}</div>
                    {cell.buf && <div className="text-orange-500 font-bold">buffer</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </motion.div>

        {/* ── Buffer status ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`${card()} border ${buffered > 0 ? 'border-orange-300' : 'border-slate-200'}`}
        >
          <div className="flex justify-between items-center gap-6 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                <Database className={`w-5 h-5 ${buffered > 0 ? 'text-orange-500' : 'text-teal-600'}`} />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                  Priority Message Buffer
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Held during outage · flushed CRITICAL → HIGH → MEDIUM → LOW on reconnect
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${buffered > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>
                {buffered}
              </p>
              <p className="text-xs text-slate-400">buffered</p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
