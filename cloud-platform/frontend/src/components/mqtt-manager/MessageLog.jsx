import React from 'react';
import { C, stateColor, priorityColor } from '../App.jsx';

const statusColor = (s) => ({
  sent:     C.good,
  buffered: C.weak,
  dropped:  C.offline,
  delayed:  C.weak,
}[s] || C.muted);

const statusLabel = (s, qos) => ({
  sent:     `QoS ${qos}`,
  buffered: 'BUFFERED',
  dropped:  'DROPPED',
  delayed:  'DELAYED',
}[s] || (s || '').toUpperCase());

export default function MessageLog({ messages, networkState }) {
  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
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
          SAAMP Live Message Decisions
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: C.good, animation: 'pulse 1s infinite',
          }} />
          <span style={{ fontSize: 12, color: C.good, letterSpacing: 1, fontWeight: 600 }}>
            LIVE · {messages.length} messages
          </span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '70px 120px 100px 90px 1fr 80px',
        gap: 8,
        paddingBottom: 10,
        borderBottom: `1px solid ${C.border}`,
        fontSize: 11, color: C.muted, letterSpacing: 1,
        fontWeight: 600,
      }}>
        <span>TIME</span>
        <span>SOURCE</span>
        <span>ACTION</span>
        <span>PRIORITY</span>
        <span>TOPIC</span>
        <span style={{ textAlign: 'right' }}>STATUS</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 0',
            color: C.muted, fontSize: 13,
          }}>
            Waiting for MQTT messages...
          </div>
        ) : (
          messages.map((msg, i) => {
            const pc  = priorityColor(msg.priority);
            const sc2 = statusColor(msg.status);
            const sl  = statusLabel(msg.status, msg.qos_assigned || msg.qos);

            const timeStr = msg.time
              || (msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString()
                    : '—');

            return (
              <div
                key={msg.id || i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 120px 100px 90px 1fr 80px',
                  gap: 8,
                  padding: '10px 0',
                  borderBottom: `1px solid ${C.border}18`,
                  fontSize: 12,
                  animation: i === 0 ? 'slide 0.15s ease' : 'none',
                  opacity: Math.max(0.4, 1 - i * 0.01),
                }}
              >
                <span style={{ color: C.muted, fontSize: 11 }}>
                  {timeStr.slice(-8, -3)}
                </span>

                <span style={{
                  color: C.text,
                  textTransform: 'capitalize', fontSize: 11,
                }}>
                  {msg.source || msg.source_type || '—'}
                </span>

                <span style={{
                  color: C.muted,
                  textTransform: 'capitalize', fontSize: 11,
                }}>
                  {(msg.action || '').replace(/_/g, ' ')}
                </span>

                <span style={{
                  background: `${pc}22`,
                  border: `1px solid ${pc}`,
                  color: pc, borderRadius: 5,
                  padding: '3px 8px',
                  fontSize: 11, fontWeight: 700,
                  textAlign: 'center',
                }}>
                  {(msg.priority || '').slice(0, 4)}
                </span>

                <span style={{
                  color: C.muted, fontSize: 10,
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {msg.topic || '—'}
                </span>

                <span style={{
                  background: `${sc2}22`,
                  border: `1px solid ${sc2}`,
                  color: sc2, borderRadius: 5,
                  padding: '3px 8px',
                  fontSize: 11, fontWeight: 700,
                  textAlign: 'center',
                }}>
                  {sl}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div style={{
        marginTop: 12, padding: '12px 16px',
        background: '#080c14', borderRadius: 10,
        border: `1px solid ${C.border}`,
        fontSize: 12, color: C.muted,
      }}>
        <span>Current state: </span>
        <span style={{
          color: stateColor(networkState),
          fontWeight: 700,
        }}>
          {networkState}
        </span>
        <span> · SAAMP classifies messages automatically</span>
      </div>
    </div>
  );
}
