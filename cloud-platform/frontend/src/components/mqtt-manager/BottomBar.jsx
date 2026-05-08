import React from 'react';
import { C, valColor } from '../App.jsx';

export default function BottomBar({ metrics }) {
  const m = metrics || {};

  const items = [
    {
      label: 'Jitter',
      value: `${m.jitter || 0}ms`,
      color: valColor(m.jitter || 0, 15, 50),
    },
    {
      label: 'Bandwidth',
      value: `${m.bandwidth || 0} Mbps`,
      color: C.routine,
    },
    {
      label: 'Drop Rate',
      value: `${m.drop_rate || 0}/s`,
      color: (m.drop_rate || 0) > 2 ? C.offline
           : (m.drop_rate || 0) > 0 ? C.poor
           : C.good,
    },
    {
      label: 'WiFi Clients',
      value: m.clients || 0,
      color: C.good,
    },
    {
      label: 'Throughput',
      value: `${m.throughput || 0} msg/s`,
      color: valColor(m.throughput || 0, 5, 12, true),
    },
    {
      label: 'Queue Δ',
      value: `${(m.queue_delta || 0) >= 0 ? '+' : ''}${m.queue_delta || 0}`,
      color: (m.queue_delta || 0) > 10 ? C.poor
           : (m.queue_delta || 0) > 0  ? C.weak
           : C.good,
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 12,
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '14px 16px',
          borderLeft: `3px solid ${item.color}`,
        }}>
          <div style={{
            fontSize: 11, color: C.muted,
            letterSpacing: 1, marginBottom: 6,
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {item.label}
          </div>
          <div style={{
            fontSize: 20, fontWeight: 700, color: item.color,
            filter: `drop-shadow(0 0 6px ${item.color}88)`,
          }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
