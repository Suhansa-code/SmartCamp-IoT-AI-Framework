import React from 'react';
import { C, stateColor } from '../App.jsx';

export default function Header({ networkState, connected, metrics }) {
  const sc = stateColor(networkState);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: 16,
    }}>

      <div>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 28, fontWeight: 800,
          letterSpacing: -0.5, color: C.text,
        }}>
          SAAMP · Network Monitor
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6, letterSpacing: 1 }}>
          SEMANTIC-AWARE ADAPTIVE MESSAGE PRIORITIZATION · SMART CAMP BOX
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: connected ? C.good : C.offline,
            animation: connected ? 'pulse 1.5s infinite' : 'none',
          }} />
          <span style={{
            fontSize: 14,
            color: connected ? C.good : C.offline,
            fontWeight: 700,
            letterSpacing: 1,
          }}>
            {connected ? 'LIVE' : 'DISCONNECTED'}
          </span>
        </div>

        <div style={{
          background: C.panel,
          border: `1px solid ${sc}`,
          borderRadius: 12,
          padding: '12px 24px',
          textAlign: 'center',
          boxShadow: `0 0 20px ${sc}33`,
        }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>
            PREDICTED STATE (60s)
          </div>
          <div style={{
            fontSize: 24, fontWeight: 700,
            color: sc, filter: `drop-shadow(0 0 8px ${sc})`,
          }}>
            {networkState}
          </div>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: sc, margin: '6px auto 0',
            animation: 'pulse 1.2s infinite',
          }} />
        </div>

        <div style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '10px 18px',
        }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1 }}>
            MQTT BROKER
          </div>
          <div style={{
            fontSize: 14, fontWeight: 700, marginTop: 4,
            color: metrics?.bridge_alive ? C.good : C.offline,
          }}>
            {metrics?.bridge_alive ? '● CONNECTED' : '● OFFLINE'}
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {metrics?.clients || 0} clients
          </div>
        </div>
      </div>
    </div>
  );
}
