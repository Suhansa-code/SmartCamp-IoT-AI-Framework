import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle2, 
  Server, 
  Clock, 
  ShieldAlert,
  ArrowDownToLine,
  Gauge,
  Box
} from 'lucide-react';

const API = 'http://localhost:5000';
const POLL_MS = 10_000;

const STATE_STYLE = {
  STABLE:   { 
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',  
    dot: 'bg-emerald-500', 
    shadow: 'shadow-emerald-500/20',
    border: 'border-emerald-500/30', 
    text: 'text-emerald-700',
    icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />
  },
  DEGRADED: { 
    badge: 'bg-amber-100 text-amber-800 border-amber-200', 
    dot: 'bg-amber-500', 
    shadow: 'shadow-amber-500/20',
    border: 'border-amber-500/30', 
    text: 'text-amber-700',
    icon: <AlertTriangle className="w-6 h-6 text-amber-500" />
  },
  CRITICAL: { 
    badge: 'bg-rose-100 text-rose-800 border-rose-200',      
    dot: 'bg-rose-500',    
    shadow: 'shadow-rose-500/20',
    border: 'border-rose-500/30',   
    text: 'text-rose-700',
    icon: <ShieldAlert className="w-6 h-6 text-rose-500" />
  },
  UNKNOWN:  { 
    badge: 'bg-slate-100 text-slate-600 border-slate-200',    
    dot: 'bg-slate-400',   
    shadow: 'shadow-slate-400/20',
    border: 'border-slate-300/50',  
    text: 'text-slate-600',
    icon: <Activity className="w-6 h-6 text-slate-500" />
  },
};

const STATE_DESC = {
  STABLE:   'Network healthy — full QoS 2 for critical messages.',
  DEGRADED: 'Network congested — QoS automatically upgraded to protect delivery.',
  CRITICAL: 'Network failing — critical messages downgraded to QoS 1, others buffered.',
  UNKNOWN:  'Waiting for first ML prediction…',
};

// Matches decideAdaptiveQoS in saampMqtt.js
const QOS_TABLE = [
  { priority: 'CRITICAL', pColor: 'text-rose-600 bg-rose-50 border-rose-100',    stable: { qos: 2, buf: false }, degraded: { qos: 2, buf: false }, critical: { qos: 1, buf: false } },
  { priority: 'HIGH',     pColor: 'text-amber-600 bg-amber-50 border-amber-100', stable: { qos: 1, buf: false }, degraded: { qos: 2, buf: false }, critical: { qos: 1, buf: true  } },
  { priority: 'MEDIUM',   pColor: 'text-blue-600 bg-blue-50 border-blue-100',   stable: { qos: 1, buf: false }, degraded: { qos: 1, buf: false }, critical: { qos: 1, buf: true  } },
  { priority: 'LOW',      pColor: 'text-slate-600 bg-slate-50 border-slate-100',   stable: { qos: 0, buf: false }, degraded: { qos: 1, buf: false }, critical: { qos: 0, buf: true  } },
];

function metricColor(value, warn, crit, invert = false) {
  const n = parseFloat(value);
  if (isNaN(n)) return 'text-slate-400';
  if (invert) return n < crit ? 'text-rose-600' : n < warn ? 'text-amber-600' : 'text-emerald-600';
  return n > crit ? 'text-rose-600' : n > warn ? 'text-amber-600' : 'text-emerald-600';
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

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
    <motion.div 
      className="max-w-5xl mx-auto space-y-6 pb-12"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-500" />
            Network Intelligence
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time QoS adaptation & ML-based state prediction
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
          <div className={`w-2.5 h-2.5 rounded-full ${error ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="text-xs font-medium text-slate-600">
            {error ? 'Disconnected' : lastAt ? `Polled at ${lastAt.toLocaleTimeString()}` : 'Connecting…'}
          </span>
        </div>
      </motion.div>

      {/* ── Warning banners ──────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 flex items-start gap-3 shadow-sm mb-6">
              <WifiOff className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
              <div className="text-sm text-rose-800">
                <p className="font-semibold text-rose-900 mb-1">Backend unreachable: {error}</p>
                <p>Start with <code className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-900 font-mono text-xs">npm start</code> in <code className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-900 font-mono text-xs">raspberry-platform/backend/res-mng_backend</code>.</p>
              </div>
            </div>
          </motion.div>
        )}
        {!error && state === 'UNKNOWN' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-start gap-3 shadow-sm mb-6">
              <Activity className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold text-amber-900 mb-1">No ML prediction received yet.</p>
                <p>Start the monitor service: <code className="bg-amber-100/50 px-1.5 py-0.5 rounded text-amber-900 font-mono text-xs border border-amber-200/50">python3 scripts/network_monitor_service.py</code></p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ── Left Column (State & Buffer) ─────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* ── State banner ─────────────────────────────── */}
          <motion.div 
            variants={itemVariants}
            className={`relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-sm border ${st.border} transition-colors duration-500`}
          >
            <div className="absolute -top-6 -right-6 p-4 opacity-[0.03] scale-150 pointer-events-none">
              {st.icon}
            </div>
            
            <div className="relative z-10">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                Network State
              </p>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${st.dot} shadow-[0_0_12px_rgba(0,0,0,0.3)] shadow-${st.dot.replace('bg-','')}`} />
                  <span className={`text-4xl font-black tracking-tight ${st.text}`}>{state}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.badge} shadow-sm`}>
                    Random Forest
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                    <Clock className="w-3 h-3" /> {updatedAt}
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-slate-600 mt-5 leading-relaxed font-medium">
                {STATE_DESC[state]}
              </p>
            </div>
          </motion.div>

          {/* ── Buffer status ─────────────────────────────── */}
          <motion.div 
            variants={itemVariants}
            className={`bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-sm border ${buffered > 0 ? 'border-amber-200 ring-2 ring-amber-50' : 'border-slate-200'} transition-all`}
          >
            <div className="flex flex-col h-full justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5" />
                  Priority Buffer
                </p>
                <p className="text-xs text-slate-500 leading-relaxed pr-4">
                  Held during outage. Flushed <span className="font-semibold text-slate-700">CRITICAL → LOW</span> on reconnect.
                </p>
              </div>
              <div className="flex items-end justify-between border-t border-slate-100 pt-5 mt-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total queued</span>
                <motion.div 
                  key={buffered}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`text-5xl font-black tracking-tighter ${buffered > 0 ? 'text-amber-500' : 'text-emerald-500'}`}
                >
                  {buffered}
                </motion.div>
              </div>
            </div>
          </motion.div>

        </div>

        {/* ── Right Column (Metrics & QoS Table) ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ── Live metrics ─────────────────────────────── */}
          <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" />
                Live Telemetry
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Broker:</span>
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-sm ${m.bridge_alive === true ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : m.bridge_alive === false ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {m.bridge_alive === true ? <CheckCircle2 className="w-3 h-3" /> : m.bridge_alive === false ? <WifiOff className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                  {m.bridge_alive === true ? 'ALIVE' : m.bridge_alive === false ? 'DOWN' : 'WAITING'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Avg RTT',  val: m.rtt_avg,     unit: ' ms',   warn: 200,  crit: 500  },
                { label: 'Max RTT',  val: m.rtt_max,     unit: ' ms',   warn: 400,  crit: 999  },
                { label: 'Loss',     val: m.packet_loss, unit: '%',     warn: 5,    crit: 15   },
                { label: 'Jitter',   val: m.jitter,      unit: ' ms',   warn: 30,   crit: 80   },
                { label: 'B/width',  val: m.bandwidth,   unit: ' Mbps', warn: 5,    crit: 1,   invert: true },
                { label: 'Queue',    val: m.queue_depth, unit: '',      warn: 50,   crit: 100  },
              ].map(({ label, val, unit, warn, crit, invert }) => (
                <div key={label} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">{label}</span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold tracking-tight ${val !== undefined ? metricColor(val, warn, crit, invert) : 'text-slate-300'}`}>
                      {val !== undefined ? val : '—'}
                    </span>
                    {val !== undefined && <span className="text-xs font-medium text-slate-400">{unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── QoS Decision Table ───────────────────────── */}
          <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Adaptive QoS Matrix
              </h2>
            </div>
            
            <div className="overflow-x-auto pb-2 -mx-2 px-2">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-4 gap-3 text-center text-[10px] font-bold mb-3 uppercase tracking-wider text-slate-400">
                  <div className="text-left pl-3">Priority</div>
                  {['STABLE', 'DEGRADED', 'CRITICAL'].map(s => (
                    <div key={s} className="relative py-1">
                      {s}
                      {state === s && (
                        <motion.div layoutId="activeCol" className="absolute inset-0 bg-slate-50 rounded-xl -z-10 border border-slate-200 shadow-sm" />
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="space-y-2.5">
                  {QOS_TABLE.map(row => (
                    <div key={row.priority} className="grid grid-cols-4 gap-3 text-center text-xs items-center group">
                      <div className={`font-bold text-left px-4 py-2.5 rounded-xl border flex items-center justify-center sm:justify-start shadow-sm ${row.pColor}`}>
                        {row.priority}
                      </div>
                      
                      {(['stable', 'degraded', 'critical']).map(col => {
                        const cell = row[col];
                        const colState = col.toUpperCase();
                        const isActive = state === colState;
                        const isCurrentCell = isActive;
                        
                        return (
                          <div 
                            key={col} 
                            className={`relative rounded-xl py-3 font-semibold transition-all duration-300 border ${
                              isCurrentCell
                                ? cell.buf
                                  ? 'bg-amber-100 text-amber-800 border-amber-200 shadow-md transform scale-105 z-10'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200 shadow-md transform scale-105 z-10'
                                : 'bg-white text-slate-400 border-slate-100 group-hover:border-slate-200 shadow-sm'
                            }`}
                          >
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span>QoS {cell.qos}</span>
                              {cell.buf ? (
                                <span className={`text-[9px] uppercase tracking-wider font-bold ${isCurrentCell ? 'text-amber-600' : 'text-amber-400'}`}>Buffer</span>
                              ) : (
                                <span className="text-[9px] uppercase tracking-wider opacity-0">Drop</span> // Invisible spacer
                              )}
                            </div>
                            
                            {isCurrentCell && (
                              <motion.div 
                                layoutId="activeCellRing" 
                                className="absolute inset-0 rounded-xl ring-2 ring-indigo-500/20 pointer-events-none" 
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
          
        </div>
      </div>
    </motion.div>
  );
}
