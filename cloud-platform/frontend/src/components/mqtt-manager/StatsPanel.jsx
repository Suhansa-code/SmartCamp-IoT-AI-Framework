import React from 'react';
import { C, priorityColor } from '../App.jsx';

export default function StatsPanel({ stats, buffer, metrics, networkState }) {
  const s            = stats || {};
  const totalCrit    = (s.critical_sent || 0) + (s.critical_buffered || 0);
  const deliveryRate = totalCrit > 0
    ? ((s.critical_sent / totalCrit) * 100).toFixed(1)
    : '100.0';
  const drColor      = +deliveryRate >= 95 ? C.good
                     : +deliveryRate >= 70 ? C.weak
                     : C.offline;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 20,
      }}>
        <div style={{
          fontSize: 13, color: C.muted, letterSpacing: 1,
          marginBottom: 16, textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          Delivery Statistics
        </div>

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: C.muted, letterSpacing: 1 }}>
            CRITICAL DELIVERY RATE
          </div>
          <div style={{
            fontSize: 52, fontWeight: 700, color: drColor,
            filter: `drop-shadow(0 0 12px ${drColor})`,
            lineHeight: 1, marginTop: 8,
          }}>
            {deliveryRate}
            <span style={{ fontSize: 24 }}>%</span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>
            target ≥ 95%
          </div>
          <div style={{
            height: 8, background: C.border,
            borderRadius: 4, marginTop: 12, overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(+deliveryRate, 100)}%`,
              height: '100%', background: drColor,
              borderRadius: 4, transition: 'width 0.5s',
              boxShadow: `0 0 8px ${drColor}`,
            }} />
          </div>
        </div>

        {[
          { label: 'Total sent',          value: s.total_sent         || 0, color: C.good    },
          { label: 'Total buffered',       value: s.total_buffered     || 0, color: C.weak    },
          { label: 'Total dropped',        value: s.total_dropped      || 0, color: C.offline },
          { label: 'Critical sent',        value: s.critical_sent      || 0, color: C.good    },
          { label: 'Critical buffered',   value: s.critical_buffered  || 0, color: C.weak    },
        ].map((row, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: `1px solid ${C.border}`,
            fontSize: 14,
          }}>
            <span style={{ color: C.muted }}>{row.label}</span>
            <span style={{ color: row.color, fontWeight: 700 }}>
              {row.value}
            </span>
          </div>
        ))}

        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: metrics?.bridge_alive ? `${C.good}11` : `${C.offline}11`,
          border: `1px solid ${metrics?.bridge_alive ? C.good : C.offline}33`,
          borderRadius: 8,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, color: C.muted }}>Cloud bridge</span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: metrics?.bridge_alive ? C.good : C.offline,
          }}>
            {metrics?.bridge_alive ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 20, flex: 1,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 14,
        }}>
          <div style={{
            fontSize: 13, color: C.muted,
            letterSpacing: 1, textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            Priority Buffer
          </div>
          <span style={{
            background: buffer.length > 0 ? `${C.weak}22` : 'transparent',
            border: `1px solid ${buffer.length > 0 ? C.weak : C.border}`,
            color: buffer.length > 0 ? C.weak : C.muted,
            borderRadius: 6, padding: '4px 12px',
            fontSize: 13, fontWeight: 700,
          }}>
            {buffer.length} queued
          </span>
        </div>

        {buffer.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '30px 0',
            color: C.muted, fontSize: 14,
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            Buffer empty — all messages delivered
          </div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {buffer.slice(0, 10).map((msg, i) => {
              const pc = priorityColor(msg.priority);
              const timeStr = msg.time
                || (msg.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString()
                      : '—');
              return (
                <div key={msg.id || i} style={{
                  padding: '10px 12px', marginBottom: 6,
                  background: '#080c14', borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', fontSize: 12,
                  animation: i === 0 ? 'slide 0.15s ease' : 'none',
                }}>
                  <div>
                    <div style={{
                      color: C.text, textTransform: 'capitalize', fontSize: 13,
                    }}>
                      {msg.source || msg.source_type} · {(msg.action || '').replace(/_/g, ' ')}
                    </div>
                    <div style={{ color: C.muted, marginTop: 3, fontSize: 11 }}>
                      {timeStr}
                    </div>
                  </div>
                  <span style={{
                    background: `${pc}22`, border: `1px solid ${pc}`,
                    color: pc, borderRadius: 5,
                    padding: '4px 10px', fontWeight: 700, fontSize: 12,
                  }}>
                    {(msg.priority || '').slice(0, 4)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {networkState !== 'OFFLINE' && buffer.length > 0 && (
          <div style={{
            marginTop: 10, padding: '10px 12px',
            background: `${C.good}11`, borderRadius: 8,
            border: `1px solid ${C.good}33`,
            fontSize: 12, color: C.good, textAlign: 'center',
          }}>
            Reconnected — flushing CRITICAL records first...
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 12, color: C.muted,
            letterSpacing: 1, marginBottom: 8,
            fontWeight: 600,
          }}>
            FLUSH ORDER ON RECONNECT
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
                background: row.color, boxShadow: `0 0 5px ${row.color}`,
              }} />
              <span style={{ color: row.color, fontWeight: 600 }}>{row.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
