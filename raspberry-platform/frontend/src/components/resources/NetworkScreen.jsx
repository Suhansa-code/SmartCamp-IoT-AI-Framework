import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Wifi, Layers, Database, RefreshCw, AlertTriangle } from 'lucide-react';
import ErrorState from '../ui/feedback/ErrorState';
import { API, NETWORK_STATE_DESC } from '../ui/config';
import { COLORS, SHADOW_CARD } from '../../lib/tokens';

const POLL_MS = 10_000;

/* ------------------------------------------------------------------ */
/*  SEMANTIC COLOUR MAP                                                 */
/* ------------------------------------------------------------------ */

const TONE = {
  brand:   { color: COLORS.brand, bg: `${COLORS.brand}14`, border: `${COLORS.brand}33` },
  warning: { color: '#D97706',    bg: '#FFFBEB',           border: '#FDE68A' },
  danger:  { color: '#DC2626',    bg: '#FEF2F2',           border: '#FECACA' },
  info:    { color: '#0284C7',    bg: '#F0F9FF',           border: '#BAE6FD' },
  neutral: { color: COLORS.body,  bg: '#F5F6F5',            border: COLORS.line },
};

// Maps ML-predicted network state to a semantic tone
const STATE_TONE = {
  STABLE: 'brand',
  DEGRADED: 'warning',
  CRITICAL: 'danger',
  UNKNOWN: 'neutral',
};

// Matches decideAdaptiveQoS in saampMqtt.js
// STABLE:   full base QoS (CRITICAL → QoS 2, network can handle it)
// DEGRADED: QoS upgraded to protect delivery on stressed network
// CRITICAL: only CRITICAL priority sent at QoS 1 (2-way handshake survives lossy links better than QoS 2's 4-way)
const QOS_TABLE = [
  { priority: 'CRITICAL', tone: 'danger',  stable: { qos: 2, buf: false }, degraded: { qos: 2, buf: false }, critical: { qos: 1, buf: false } },
  { priority: 'HIGH',     tone: 'warning', stable: { qos: 1, buf: false }, degraded: { qos: 2, buf: false }, critical: { qos: 1, buf: true  } },
  { priority: 'MEDIUM',   tone: 'info',    stable: { qos: 1, buf: false }, degraded: { qos: 1, buf: false }, critical: { qos: 1, buf: true  } },
  { priority: 'LOW',      tone: 'neutral', stable: { qos: 0, buf: false }, degraded: { qos: 1, buf: false }, critical: { qos: 0, buf: true  } },
];

function metricTone(value, warn, crit, invert = false) {
  const n = parseFloat(value);
  if (isNaN(n)) return 'neutral';
  if (invert) return n < crit ? 'danger' : n < warn ? 'warning' : 'brand';
  return n > crit ? 'danger' : n > warn ? 'warning' : 'brand';
}

/* ------------------------------------------------------------------ */
/*  LOCAL PRIMITIVES — mirror the FloodWatch / ReliefOps design system  */
/* ------------------------------------------------------------------ */

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border bg-white p-4 sm:p-6 ${className}`} style={{ borderColor: COLORS.line }}>
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

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-3 sm:mb-4">
      <IconTile icon={icon} />
      <div>
        <h2 className="text-[13.5px] sm:text-[14px] font-semibold" style={{ color: COLORS.ink }}>{title}</h2>
        {subtitle && <p className="text-[11px] sm:text-[11.5px]" style={{ color: COLORS.muted }}>{subtitle}</p>}
      </div>
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

/* ------------------------------------------------------------------ */
/*  MAIN SCREEN                                                         */
/* ------------------------------------------------------------------ */

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
  const tone     = STATE_TONE[state] || 'neutral';
  const t        = TONE[tone];
  const m        = status?.metrics   || {};
  const buffered = status?.buffered_messages ?? 0;
  const updatedAt = status?.updated_at
    ? new Date(status.updated_at).toLocaleTimeString()
    : '—';

  return (
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>
      <div className="sm:px-5 lg:px-6 py-2 sm:py-5 space-y-4 sm:space-y-6">

        {/* ================= TITLE ROW ================= */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.12em]" style={{ color: COLORS.muted }}>Camp operations</p>
            <div className="flex items-center gap-3 flex-wrap mt-1.5">

              <h1 className="font-serif font-medium text-[26px] sm:text-[32px] leading-[1.1] tracking-tight">Network Monitor</h1>
            </div>
            <p className="text-[12.5px] mt-2" style={{ color: COLORS.muted }}>ML-predicted link health and adaptive QoS decisions</p>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-mono" style={{ color: COLORS.muted }}>
            <RefreshCw className={`w-3.5 h-3.5 ${lastAt ? '' : 'animate-spin'}`} style={{ color: COLORS.brand }} />
            <span className="font-medium">Refreshes every {POLL_MS / 1000}s</span>
          </div>
        </div>

        {/* ── Warning banners ──────────────────────────── */}
        {error && (
          <ErrorState title="Backend unreachable" message={error} onRetry={fetchStatus} />
        )}
        {!error && state === 'UNKNOWN' && (
          <div className="flex items-start gap-3 rounded-xl border px-5 py-4 text-[13px]" style={{ backgroundColor: TONE.warning.bg, borderColor: TONE.warning.border, color: TONE.warning.color }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">No ML prediction received yet.</span> Start the monitor service:
              <br />
              <code className="px-1.5 py-0.5 rounded text-[11.5px] font-mono mt-1 inline-block" style={{ backgroundColor: '#FDE68A' }}>
                python3 scripts/network_monitor_service.py
              </code>
            </div>
          </div>
        )}

        {/* ── Live metrics + Adaptive QoS (side by side) ─ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-6">
          <Card className="h-full">
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <p className="text-[11px] font-mono font-semibold uppercase tracking-wider mb-2" style={{ color: COLORS.muted }}>
                    ML-Predicted Network State
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full animate-pulse" style={{ backgroundColor: t.color }} />
                    <span className="font-serif font-medium text-[26px] sm:text-[30px] tracking-tight" style={{ color: t.color }}>{state}</span>
                    <Chip tone={tone}>Random Forest</Chip>
                  </div>
                  <p className="text-[13px] mt-2" style={{ color: COLORS.muted }}>{NETWORK_STATE_DESC[state]}</p>
                </div>
                <div className="text-right text-[11.5px] font-mono space-y-1" style={{ color: COLORS.muted }}>
                  <p>Updated {updatedAt}</p>
                  <p>{lastAt ? `Polled ${lastAt.toLocaleTimeString()}` : 'Connecting…'}</p>
                </div>
              </div>
              <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t flex flex-col flex-1" style={{ borderColor: COLORS.hairline }}>
                <SectionHeader icon={Activity} title="Live Network Metrics" />
                <div className="grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-3">
              {[
                { label: 'RTT Average',  val: m.rtt_avg,     unit: ' ms',   warn: 200,  crit: 500  },
                { label: 'RTT Max',      val: m.rtt_max,     unit: ' ms',   warn: 400,  crit: 999  },
                { label: 'Packet Loss',  val: m.packet_loss, unit: '%',     warn: 5,    crit: 15   },
                { label: 'Jitter',       val: m.jitter,      unit: ' ms',   warn: 30,   crit: 80   },
                { label: 'Bandwidth',    val: m.bandwidth,   unit: ' Mbps', warn: 5,    crit: 1,   invert: true },
                { label: 'Queue Depth',  val: m.queue_depth, unit: '',      warn: 50,   crit: 100  },
              ].map(({ label, val, unit, warn, crit, invert }) => {
                const mTone = val !== undefined ? metricTone(val, warn, crit, invert) : 'neutral';
                return (
                  <div key={label} className="flex justify-between items-center border-b pb-2" style={{ borderColor: COLORS.hairline }}>
                    <span className="text-[12.5px]" style={{ color: COLORS.muted }}>{label}</span>
                    <span className="text-[13px] font-semibold font-mono" style={{ color: val !== undefined ? TONE[mTone].color : COLORS.muted }}>
                      {val !== undefined ? `${val}${unit}` : '—'}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: COLORS.hairline }}>
                <span className="text-[12.5px]" style={{ color: COLORS.muted }}>Broker alive</span>
                <span
                  className="text-[13px] font-semibold font-mono"
                  style={{ color: m.bridge_alive === true ? COLORS.brand : m.bridge_alive === false ? TONE.danger.color : COLORS.muted }}
                >
                  {m.bridge_alive === true ? 'YES' : m.bridge_alive === false ? 'DOWN' : '—'}
                </span>
              </div>
              </div>
            </div>
            </div>
          </Card>
        </motion.div>

        {/* ── QoS Decision Table ───────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-6">
          <Card className="h-full">
            <SectionHeader icon={Layers} title="Adaptive QoS Decisions" subtitle="Current state highlighted" />
            <div className="overflow-x-auto">
            <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono font-semibold mb-2 min-w-[320px]">
              <div />
              {['STABLE', 'DEGRADED', 'CRITICAL'].map((s) => {
                const sTone = TONE[STATE_TONE[s]];
                const active = state === s;
                return (
                  <div
                    key={s}
                    className="rounded-lg py-2 border"
                    style={active
                      ? { backgroundColor: sTone.bg, color: sTone.color, borderColor: sTone.color, boxShadow: `0 0 0 2px ${sTone.color}22` }
                      : { backgroundColor: '#F5F6F5', color: COLORS.muted, borderColor: 'transparent' }}
                  >
                    {s}
                  </div>
                );
              })}
            </div>
            {QOS_TABLE.map((row) => {
              const rowTone = TONE[row.tone];
              return (
                <div key={row.priority} className="grid grid-cols-4 gap-2 text-center text-[11px] mb-2">
                  <div className="font-bold text-left flex items-center font-mono" style={{ color: rowTone.color }}>
                    {row.priority}
                  </div>
                  {(['stable', 'degraded', 'critical']).map((col) => {
                    const cell = row[col];
                    const colState = col.toUpperCase();
                    const isActive = state === colState;
                    const cellTone = cell.buf ? TONE.warning : TONE.brand;
                    return (
                      <div
                        key={col}
                        className="rounded-lg py-2 font-semibold font-mono transition-all border"
                        style={isActive
                          ? { backgroundColor: cellTone.bg, color: cellTone.color, borderColor: cellTone.border }
                          : { backgroundColor: '#FAFAF9', color: COLORS.muted, borderColor: 'transparent' }}
                      >
                        <div>QoS {cell.qos}</div>
                        {cell.buf && <div className="font-bold" style={{ color: TONE.warning.color }}>buffer</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            </div>
          </Card>
        </motion.div>
        </div>

        {/* ── Buffer status ─────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border" style={{ borderColor: buffered > 0 ? TONE.warning.border : COLORS.line }}>
            <div className="flex justify-between items-center gap-6 flex-wrap">
              <div className="flex items-start gap-3">
                <IconTile icon={Database} tone={buffered > 0 ? 'warning' : 'brand'} size="lg" />
                <div>
                  <h2 className="text-[12px] font-semibold uppercase tracking-wider font-mono" style={{ color: COLORS.ink }}>
                    Priority Message Buffer
                  </h2>
                  <p className="text-[12.5px] mt-1" style={{ color: COLORS.muted }}>
                    Held during outage · flushed CRITICAL → HIGH → MEDIUM → LOW on reconnect
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-serif font-medium text-[32px] sm:text-[36px]" style={{ color: buffered > 0 ? TONE.warning.color : COLORS.brand }}>
                  {buffered}
                </p>
                <p className="text-[11px] font-mono" style={{ color: COLORS.muted }}>buffered</p>
              </div>
            </div>
          </Card>
        </motion.div>

      </div>
    </div>
  );
}