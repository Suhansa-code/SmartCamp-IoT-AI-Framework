import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Network, Zap } from 'lucide-react';

const FEATURES = [
  { key: 'rtt_avg',     label: 'RTT Average',    importance: 0.18, fmt: v => `${v}ms`    },
  { key: 'rtt_max',     label: 'RTT Max',        importance: 0.09, fmt: v => `${v}ms`    },
  { key: 'jitter',      label: 'Jitter',         importance: 0.14, fmt: v => `${v}ms`    },
  { key: 'packet_loss', label: 'Packet Loss',    importance: 0.22, fmt: v => `${v}%`     },
  { key: 'queue_depth', label: 'Queue Depth',    importance: 0.11, fmt: v => v           },
  { key: 'queue_delta', label: 'Queue Delta',    importance: 0.13, fmt: v => v           },
  { key: 'throughput',  label: 'Throughput',     importance: 0.06, fmt: v => `${v}m/s`   },
  { key: 'bandwidth',   label: 'Bandwidth',      importance: 0.04, fmt: v => `${v}KB/s`  },
  { key: 'drop_rate',   label: 'Drop Rate',      importance: 0.05, fmt: v => `${v}/s`    },
  { key: 'bridge_alive',label: 'Bridge Alive',   importance: 0.19, fmt: v => v ? 'YES' : 'NO' },
];

const QOS_MATRIX = {
  CRITICAL:  ['QoS 2', 'QoS 2', 'QoS 2', 'Buffer'],
  IMPORTANT: ['QoS 2', 'QoS 1', 'QoS 1', 'Buffer'],
  ROUTINE:   ['QoS 0', 'QoS 0', 'Drop',  'Drop'  ],
};

const PRIORITY_COLORS = {
  CRITICAL:  'text-rose-600 dark:text-rose-500 drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]',
  IMPORTANT: 'text-amber-600 dark:text-amber-500 drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]',
  ROUTINE:   'text-blue-600 dark:text-blue-500 drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]',
};

export default function NetworkPanel({ networkState, metrics }) {
  const m = metrics || {};
  
  const getStateStyle = (state) => ({
    GOOD: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/20 dark:shadow-emerald-500/50', border: 'border-emerald-500/20 dark:border-emerald-500/30' },
    WEAK: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', shadow: 'shadow-amber-500/20 dark:shadow-amber-500/50', border: 'border-amber-500/20 dark:border-amber-500/30' },
    POOR: { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500', shadow: 'shadow-orange-500/20 dark:shadow-orange-500/50', border: 'border-orange-500/20 dark:border-orange-500/30' },
    OFFLINE: { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500', shadow: 'shadow-rose-500/20 dark:shadow-rose-500/50', border: 'border-rose-500/20 dark:border-rose-500/30' }
  }[state] || { text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-400 dark:bg-slate-500', shadow: 'shadow-slate-500/20 dark:shadow-slate-500/50', border: 'border-slate-300 dark:border-slate-500/30' });

  const sc = getStateStyle(networkState);
  const stateIndex = ['GOOD', 'WEAK', 'POOR', 'OFFLINE'].indexOf(networkState);

  return (
    <div className="flex flex-col gap-6">
      
      {/* ML Feature Importance Panel */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-lg relative overflow-hidden transition-colors duration-500"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-2 mb-6 relative z-10">
          <Cpu className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">Random Forest · 19 Features</h3>
        </div>

        <div className="space-y-4 relative z-10">
          {FEATURES.map((feat, i) => {
            const raw = m[feat.key];
            const val = raw !== undefined ? feat.fmt(raw) : '—';
            return (
              <div key={i} className="flex items-center gap-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-24 shrink-0">
                  {feat.label}
                </div>
                <div className="flex-1 h-2 bg-white/80 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${feat.importance * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full ${sc.bg} ${sc.shadow} rounded-full`}
                  />
                </div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200 w-16 text-right shrink-0">
                  {val}
                </div>
              </div>
            );
          })}
        </div>

        <div className={`mt-6 p-4 rounded-2xl bg-white/80 dark:bg-slate-800/50 border ${sc.border} relative overflow-hidden group transition-colors duration-500 shadow-sm dark:shadow-none`}>
          <div className={`absolute inset-0 ${sc.bg} opacity-5 group-hover:opacity-10 transition-opacity`} />
          <div className="relative z-10">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-1">
              Prediction (60s Ahead)
            </div>
            <div className={`text-3xl font-black ${sc.text} drop-shadow-sm dark:drop-shadow-[0_0_12px_currentColor] tracking-tighter`}>
              {networkState}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400" /> Inference &lt;5ms · Pi 5
            </div>
          </div>
        </div>
      </motion.div>

      {/* QoS Decision Matrix */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-lg relative overflow-hidden transition-colors duration-500"
      >
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-2 mb-6 relative z-10">
          <Network className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">QoS Decision Matrix</h3>
        </div>

        <div className="grid grid-cols-[90px_repeat(4,1fr)] gap-2 mb-6 relative z-10">
          <div />
          {['GOOD', 'WEAK', 'POOR', 'OFF'].map((h, i) => (
            <div key={i} className="text-center py-2 bg-white/80 dark:bg-slate-800/80 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider shadow-sm dark:shadow-none">
              {h}
            </div>
          ))}

          {Object.entries(QOS_MATRIX).map(([priority, cells]) => (
            <React.Fragment key={priority}>
              <div className={`text-[10px] font-bold flex items-center ${PRIORITY_COLORS[priority]}`}>
                {priority}
              </div>

              {cells.map((cell, ci) => {
                const isActive = stateIndex === ci;
                const isBad = cell === 'Buffer' || cell === 'Drop';
                const cellText = cell === 'Buffer' ? 'text-amber-600 dark:text-amber-400' : cell === 'Drop' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
                const activeBg = isBad ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 shadow-md dark:shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.2)]';
                
                return (
                  <div key={ci} className={`
                    text-center py-2.5 text-[11px] rounded-lg transition-all duration-300
                    ${isActive ? `border-2 font-black ${activeBg} ${cellText} scale-105 z-10 relative` : `bg-white/80 dark:bg-slate-800/30 border-2 border-transparent font-medium ${cellText} opacity-80 dark:opacity-60 shadow-[0_2px_10px_rgb(0,0,0,0.02)]`}
                  `}>
                    {cell}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div className="relative z-10">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-3">
            Buffer Flush Order on Reconnect
          </div>
          {[
            { label: '1st — CRITICAL',  color: 'bg-rose-500 shadow-rose-500/50', text: 'text-rose-600 dark:text-rose-400' },
            { label: '2nd — IMPORTANT', color: 'bg-amber-500 shadow-amber-500/50', text: 'text-amber-600 dark:text-amber-400' },
            { label: '3rd — ROUTINE',   color: 'bg-blue-500 shadow-blue-500/50', text: 'text-blue-600 dark:text-blue-400' },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 text-xs">
              <div className={`w-8 h-1.5 rounded-full ${row.color} shadow-sm dark:shadow-[0_0_8px_currentColor]`} />
              <span className={`font-bold tracking-wide ${row.text}`}>{row.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  );
}
