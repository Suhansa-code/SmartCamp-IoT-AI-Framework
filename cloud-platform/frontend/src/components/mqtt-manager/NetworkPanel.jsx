import React from 'react';
import { C, stateColor } from '../App.jsx';

const FEATURES = [
  { key: 'rtt_avg',     label: 'RTT average',   importance: 0.18, fmt: v => `${v}ms`    },
  { key: 'rtt_max',     label: 'RTT max',        importance: 0.09, fmt: v => `${v}ms`    },
  { key: 'jitter',      label: 'Jitter',         importance: 0.14, fmt: v => `${v}ms`    },
  { key: 'packet_loss', label: 'Packet loss',    importance: 0.22, fmt: v => `${v}%`     },
  { key: 'queue_depth', label: 'Queue depth',   importance: 0.11, fmt: v => v           },
  { key: 'queue_delta', label: 'Queue delta',    importance: 0.13, fmt: v => v           },
  { key: 'throughput',  label: 'Throughput',     importance: 0.06, fmt: v => `${v}m/s`  },
  { key: 'bandwidth',   label: 'Bandwidth',     importance: 0.04, fmt: v => `${v}KB/s` },
  { key: 'drop_rate',   label: 'Drop rate',      importance: 0.05, fmt: v => `${v}/s`   },
  { key: 'bridge_alive',label: 'Bridge alive',   importance: 0.19, fmt: v => v ? 'YES' : 'NO' },
];

const QOS_MATRIX = {
  CRITICAL:  ['QoS 2', 'QoS 2', 'QoS 2', 'Buffer'],
  IMPORTANT: ['QoS 2', 'QoS 1', 'QoS 1', 'Buffer'],
  ROUTINE:   ['QoS 0', 'QoS 0', 'Drop',  'Drop'  ],
};

const PRIORITY_COLORS = {
  CRITICAL:  C.offline,
  IMPORTANT: C.weak,
  ROUTINE:   C.routine,
};

export default function NetworkPanel({ networkState, metrics }) {
  const sc         = stateColor(networkState);
  const stateIndex = ['GOOD', 'WEAK', 'POOR', 'OFFLINE'].indexOf(networkState);
  const m          = metrics || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 18,
      }}>
        <div style={{
          fontSize: 12, color: C.muted, letterSpacing: 1,
          marginBottom: 14, textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          Random Forest · 19 Features
        </div>

        {FEATURES.map((feat, i) => {
          const raw = m[feat.key];
          const val = raw !== undefined ? feat.fmt(raw) : '—';
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center',
              gap: 10, marginBottom: 10,
            }}>
              <div style={{
                fontSize: 12, color: C.muted,
                width: 100, flexShrink: 0,
              }}>
                {feat.label}
              </div>
              <div style={{
                flex: 1, height: 8,
                background: C.border, borderRadius: 4,
              }}>
                <div style={{
                  width: `${feat.importance * 100}%`,
                  height: '100%',
                  background: sc, borderRadius: 4,
                  transition: 'width 0.5s',
                  boxShadow: `0 0 6px ${sc}88`,
                }} />
              </div>
              <div style={{
                fontSize: 12, color: C.text,
                width: 70, textAlign: 'right', flexShrink: 0,
                fontWeight: 600,
              }}>
                {val}
              </div>
            </div>
          );
        })}

        <div style={{
          marginTop: 14, padding: '12px 14px',
          background: `${sc}11`, borderRadius: 8,
          border: `1px solid ${sc}33`,
        }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1 }}>
            PREDICTION (60 seconds ahead)
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: sc,
            marginTop: 4, filter: `drop-shadow(0 0 8px ${sc})`,
          }}>
            {networkState}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            Inference &lt;5ms · Raspberry Pi 5
          </div>
        </div>
      </div>

      <div style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 18,
      }}>
        <div style={{
          fontSize: 12, color: C.muted, letterSpacing: 1,
          marginBottom: 14, textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          QoS Decision Matrix
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px repeat(4, 1fr)',
          gap: 6,
        }}>
          <div />
          {['GOOD', 'WEAK', 'POOR', 'OFF'].map((h, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '8px 4px',
              background: '#1a2540', borderRadius: 6,
              color: C.muted, fontWeight: 700, fontSize: 12,
            }}>
              {h}
            </div>
          ))}

          {Object.entries(QOS_MATRIX).map(([priority, cells]) => (
            <React.Fragment key={priority}>
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: PRIORITY_COLORS[priority],
                display: 'flex', alignItems: 'center',
              }}>
                {priority}
              </div>

              {cells.map((cell, ci) => {
                const isActive = stateIndex === ci;
                const isBad    = cell === 'Buffer' || cell === 'Drop';
                const cellColor = cell === 'Buffer' ? C.weak
                                : cell === 'Drop'   ? C.offline
                                : C.good;
                return (
                  <div key={ci} style={{
                    textAlign: 'center', padding: '10px 6px',
                    fontSize: 12,
                    background: isActive
                      ? (isBad ? `${C.weak}44` : `${C.good}33`)
                      : '#1a254033',
                    borderRadius: 6,
                    color: cellColor,
                    fontWeight: isActive ? 700 : 400,
                    border: isActive
                      ? `2px solid ${isBad ? C.weak : C.good}55`
                      : '2px solid transparent',
                    transition: 'all 0.3s',
                  }}>
                    {cell}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{
            fontSize: 12, color: C.muted,
            letterSpacing: 1, marginBottom: 10,
            fontWeight: 600,
          }}>
            BUFFER FLUSH ORDER ON RECONNECT
          </div>
          {[
            { label: '1st — CRITICAL',  color: C.offline },
            { label: '2nd — IMPORTANT', color: C.weak    },
            { label: '3rd — ROUTINE',   color: C.routine },
          ].map((row, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center',
              gap: 12, padding: '6px 0', fontSize: 13,
            }}>
              <div style={{
                width: 30, height: 6, borderRadius: 3,
                background: row.color,
                boxShadow: `0 0 5px ${row.color}`,
              }} />
              <span style={{ color: row.color, fontWeight: 600 }}>{row.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
