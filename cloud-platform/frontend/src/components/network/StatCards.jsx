import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function MiniChart({ data, dataKey, color }) {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width={120} height={50}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={3}
          dot={false}
          isAnimationActive={false}
          strokeLinecap="round"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const getValColorInfo = (v, warn, crit, invert = false) => {
  const bad = invert ? v < warn : v > crit;
  const warn2 = invert ? v > warn * 1.5 : v > warn * 1.5;
  
  if (bad) return { hex: '#f43f5e', tw: 'rose' }; // rose-500
  if (warn2) return { hex: '#f59e0b', tw: 'amber' }; // amber-500
  return { hex: '#10b981', tw: 'emerald' }; // emerald-500
};

export default function StatCards({ metrics, history }) {
  const m = metrics || {};

  const cards = [
    {
      label:   'RTT Average',
      value:   m.rtt_avg || 0,
      unit:    'ms',
      colorInfo: getValColorInfo(m.rtt_avg || 0, 100, 300),
      dataKey: 'rtt',
    },
    {
      label:   'Packet Loss',
      value:   m.packet_loss || 0,
      unit:    '%',
      colorInfo: getValColorInfo(m.packet_loss || 0, 5, 20),
      dataKey: 'loss',
    },
    {
      label:   'Queue Depth',
      value:   m.queue_depth || 0,
      unit:    'msgs',
      colorInfo: getValColorInfo(m.queue_depth || 0, 10, 50),
      dataKey: 'queue',
    },
    {
      label:   'Throughput',
      value:   m.throughput || 0,
      unit:    'msg/s',
      colorInfo: getValColorInfo(m.throughput || 0, 5, 12, true),
      dataKey: 'throughput',
    },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
    >
      {cards.map((card, i) => {
        const displayVal = typeof card.value === 'number'
          ? card.value.toFixed(card.value > 99 ? 0 : 1)
          : card.value;

        const lastTwo = history.slice(-2);
        let trend = null;
        if (lastTwo.length === 2) {
          const t = (lastTwo[1][card.dataKey] - lastTwo[0][card.dataKey]).toFixed(1);
          trend = parseFloat(t);
        }

        const isThroughput = card.dataKey === 'throughput';
        let trendStatus = 'neutral';
        if (trend !== null && trend !== 0) {
           if (trend > 0) trendStatus = isThroughput ? 'good' : 'bad';
           else trendStatus = isThroughput ? 'bad' : 'good';
        }

        const borderColors = {
          'emerald': 'border-l-emerald-500',
          'amber': 'border-l-amber-500',
          'rose': 'border-l-rose-500'
        };

        const textColors = {
          'emerald': 'text-emerald-600 dark:text-emerald-400',
          'amber': 'text-amber-600 dark:text-amber-400',
          'rose': 'text-rose-600 dark:text-rose-400'
        };

        const shadowColors = {
          'emerald': 'drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] dark:drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]',
          'amber': 'drop-shadow-[0_0_8px_rgba(245,158,11,0.3)] dark:drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]',
          'rose': 'drop-shadow-[0_0_8px_rgba(244,63,94,0.3)] dark:drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]'
        };

        return (
          <motion.div 
            key={i} 
            variants={item}
            className={`bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-y border-r border-white/50 dark:border-slate-700/50 rounded-2xl p-5 border-l-4 ${borderColors[card.colorInfo.tw]} hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-lg relative overflow-hidden group`}
          >
            {/* Subtle corner glow */}
            <div className={`absolute -right-10 -top-10 w-24 h-24 bg-${card.colorInfo.tw}-500/5 dark:bg-${card.colorInfo.tw}-500/10 rounded-full blur-2xl group-hover:bg-${card.colorInfo.tw}-500/10 dark:group-hover:bg-${card.colorInfo.tw}-500/20 transition-all`} />

            <div className="flex justify-between items-start relative z-10">
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase mb-2">
                  {card.label}
                </div>
                <div className={`text-4xl font-black ${textColors[card.colorInfo.tw]} ${shadowColors[card.colorInfo.tw]} tracking-tighter leading-none flex items-baseline`}>
                  {displayVal}
                  <span className="text-base font-semibold text-slate-400 dark:text-slate-500 ml-1 tracking-normal">{card.unit}</span>
                </div>
              </div>
              <div className="opacity-60 dark:opacity-80 dark:mix-blend-screen mt-1">
                <MiniChart
                  data={history}
                  dataKey={card.dataKey}
                  color={card.colorInfo.hex}
                />
              </div>
            </div>

            {trend !== null && (
              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
                {trend > 0 ? (
                  <TrendingUp className={`w-4 h-4 ${trendStatus === 'good' ? 'text-emerald-500' : 'text-rose-500'}`} />
                ) : trend < 0 ? (
                  <TrendingDown className={`w-4 h-4 ${trendStatus === 'good' ? 'text-emerald-500' : 'text-rose-500'}`} />
                ) : (
                  <Minus className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                )}
                
                <span className={
                  trend === 0 ? 'text-slate-400 dark:text-slate-500' :
                  trendStatus === 'good' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }>
                  {Math.abs(trend)} vs last
                </span>
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
