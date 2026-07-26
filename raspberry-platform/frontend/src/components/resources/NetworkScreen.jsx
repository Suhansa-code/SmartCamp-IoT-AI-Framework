import React, { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:5000';
const POLL_MS = 10_000;

const STATE_STYLE = {
  STABLE:   { badge: 'bg-green-100 text-green-800',  dot: 'bg-green-500',  border: 'border-green-300', text: 'text-green-700' },
  DEGRADED: { badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-yellow-700' },
  CRITICAL: { badge: 'bg-red-100 text-red-800',      dot: 'bg-red-500',    border: 'border-red-300',   text: 'text-red-700' },
  UNKNOWN:  { badge: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-400',   border: 'border-gray-300',  text: 'text-gray-500' },
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
  { priority: 'MEDIUM',   pColor: 'text-blue-600',   stable: { qos: 1, buf: false }, degraded: { qos: 1, buf: false }, critical: { qos: 1, buf: true  } },
  { priority: 'LOW',      pColor: 'text-gray-500',   stable: { qos: 0, buf: false }, degraded: { qos: 1, buf: false }, critical: { qos: 0, buf: true  } },
];

function metricColor(value, warn, crit, invert = false) {
  const n = parseFloat(value);
  if (isNaN(n)) return 'text-gray-400';
  if (invert) return n < crit ? 'text-red-600' : n < warn ? 'text-yellow-600' : 'text-green-600';
  return n > crit ? 'text-red-600' : n > warn ? 'text-yellow-600' : 'text-green-600';
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
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── State banner ─────────────────────────────── */}
      <div className={`bg-white rounded-2xl shadow p-6 border-2 ${st.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              ML-Predicted Network State
            </p>
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${st.dot} animate-pulse`} />
              <span className={`text-3xl font-black ${st.text}`}>{state}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${st.badge}`}>
                Random Forest
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-2">{STATE_DESC[state]}</p>
          </div>
          <div className="text-right text-xs text-gray-400 space-y-1">
            <p>Updated {updatedAt}</p>
            <p>{lastAt ? `Polled ${lastAt.toLocaleTimeString()}` : 'Connecting…'}</p>
            <p>Refreshes every 10s</p>
          </div>
        </div>
      </div>

      {/* ── Warning banners ──────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <span className="font-bold">Backend unreachable:</span> {error}.
          Start with <code className="bg-red-100 px-1 rounded">npm start</code> in{' '}
           <code className="bg-red-100 px-1 rounded">raspberry-platform/backend</code>.
        </div>
      )}
      {!error && state === 'UNKNOWN' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <span className="font-bold">No ML prediction received yet.</span> Start the monitor service:
          <br />
          <code className="bg-yellow-100 px-1 rounded text-xs">
            python3 scripts/network_monitor_service.py
          </code>
        </div>
      )}

      {/* ── Live metrics ─────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Live Network Metrics
        </h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {[
            { label: 'RTT Average',  val: m.rtt_avg,     unit: ' ms',   warn: 200,  crit: 500  },
            { label: 'RTT Max',      val: m.rtt_max,     unit: ' ms',   warn: 400,  crit: 999  },
            { label: 'Packet Loss',  val: m.packet_loss, unit: '%',     warn: 5,    crit: 15   },
            { label: 'Jitter',       val: m.jitter,      unit: ' ms',   warn: 30,   crit: 80   },
            { label: 'Bandwidth',    val: m.bandwidth,   unit: ' Mbps', warn: 5,    crit: 1,   invert: true },
            { label: 'Queue Depth',  val: m.queue_depth, unit: '',      warn: 50,   crit: 100  },
          ].map(({ label, val, unit, warn, crit, invert }) => (
            <div key={label} className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm font-bold ${val !== undefined ? metricColor(val, warn, crit, invert) : 'text-gray-400'}`}>
                {val !== undefined ? `${val}${unit}` : '—'}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
            <span className="text-sm text-gray-500">Broker alive</span>
            <span className={`text-sm font-bold ${m.bridge_alive === true ? 'text-green-600' : m.bridge_alive === false ? 'text-red-600' : 'text-gray-400'}`}>
              {m.bridge_alive === true ? 'YES' : m.bridge_alive === false ? 'DOWN' : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ── QoS Decision Table ───────────────────────── */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Adaptive QoS Decisions
          <span className="ml-2 text-blue-500 normal-case font-normal">(current state highlighted)</span>
        </h2>
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold mb-2">
          <div />
          {['STABLE', 'DEGRADED', 'CRITICAL'].map(s => (
            <div key={s} className={`rounded-lg py-2 ${state === s ? `${STATE_STYLE[s].badge} ring-2 ring-offset-1 ${STATE_STYLE[s].border.replace('border-', 'ring-')}` : 'bg-gray-100 text-gray-400'}`}>
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
                      ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                      : 'bg-green-100 text-green-700 ring-1 ring-green-300'
                    : 'bg-gray-50 text-gray-400'
                }`}>
                  <div>QoS {cell.qos}</div>
                  {cell.buf && <div className="text-orange-500 font-bold">buffer</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Buffer status ─────────────────────────────── */}
      <div className={`bg-white rounded-2xl shadow p-6 border ${buffered > 0 ? 'border-orange-300' : 'border-gray-200'}`}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              Priority Message Buffer
            </h2>
            <p className="text-sm text-gray-500">
              Held during outage · flushed CRITICAL → HIGH → MEDIUM → LOW on reconnect
            </p>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-black ${buffered > 0 ? 'text-orange-500' : 'text-green-600'}`}>
              {buffered}
            </p>
            <p className="text-xs text-gray-400">buffered</p>
          </div>
        </div>
      </div>

    </div>
  );
}
