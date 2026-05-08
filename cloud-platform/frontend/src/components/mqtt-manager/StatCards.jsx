import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { C, valColor } from '../App.jsx';

function MiniChart({ data, dataKey, color }) {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width={120} height={50}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function StatCards({ metrics, history }) {
  const m = metrics || {};

  const cards = [
    {
      label:   'RTT Average',
      value:   m.rtt_avg      || 0,
      unit:    'ms',
      color:   valColor(m.rtt_avg      || 0, 100, 300),
      dataKey: 'rtt',
    },
    {
      label:   'Packet Loss',
      value:   m.packet_loss  || 0,
      unit:    '%',
      color:   valColor(m.packet_loss  || 0, 5,   20),
      dataKey: 'loss',
    },
    {
      label:   'Queue Depth',
      value:   m.queue_depth  || 0,
      unit:    'msgs',
      color:   valColor(m.queue_depth  || 0, 10,  50),
      dataKey: 'queue',
    },
    {
      label:   'Throughput',
      value:   m.throughput   || 0,
      unit:    'msg/s',
      color:   valColor(m.throughput   || 0, 5,   12, true),
      dataKey: 'throughput',
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14,
      marginBottom: 16,
    }}>
      {cards.map((card, i) => {
        const displayVal = typeof card.value === 'number'
          ? card.value.toFixed(card.value > 99 ? 0 : 1)
          : card.value;

        const lastTwo = history.slice(-2);
        const trend = lastTwo.length === 2
          ? (lastTwo[1][card.dataKey] - lastTwo[0][card.dataKey]).toFixed(1)
          : null;
        const trendUp = trend !== null && Number(trend) > 0;
        const trendColor = card.dataKey === 'throughput'
          ? (trendUp ? C.good : C.poor)
          : (trendUp ? C.poor : C.good);

        return (
          <div key={i} style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '18px 20px',
            borderLeft: `4px solid ${card.color}`,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
              <div>
                <div style={{
                  fontSize: 13, color: C.muted,
                  letterSpacing: 1, marginBottom: 8,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}>
                  {card.label}
                </div>
                <div style={{
                  fontSize: 36, fontWeight: 700,
                  color: card.color,
                  filter: `drop-shadow(0 0 8px ${card.color}66)`,
                  lineHeight: 1,
                }}>
                  {displayVal}
                  <span style={{ fontSize: 16, color: C.muted, marginLeft: 6 }}>
                    {card.unit}
                  </span>
                </div>
              </div>
              <MiniChart
                data={history}
                dataKey={card.dataKey}
                color={card.color}
              />
            </div>

            {trend !== null && (
              <div style={{ fontSize: 12, marginTop: 8, color: trendColor, fontWeight: 600 }}>
                {trendUp ? '▲' : '▼'} {Math.abs(trend)} from last
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
