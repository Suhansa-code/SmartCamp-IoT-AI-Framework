import React from 'react';
import { motion } from 'framer-motion';

const getValColorInfo = (v, warn, crit, invert = false) => {
  const bad = invert ? v < warn : v > crit;
  const warn2 = invert ? v > warn * 1.5 : v > warn * 1.5;
  
  if (bad) return { tw: 'rose', bg: 'bg-white/80 dark:bg-rose-500/10', border: 'border-l-rose-500', text: 'text-rose-600 dark:text-rose-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' };
  if (warn2) return { tw: 'amber', bg: 'bg-white/80 dark:bg-amber-500/10', border: 'border-l-amber-500', text: 'text-amber-600 dark:text-amber-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' };
  return { tw: 'emerald', bg: 'bg-white/80 dark:bg-emerald-500/10', border: 'border-l-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' };
};

const getDropRateColorInfo = (v) => {
  if (v > 2) return { tw: 'rose', bg: 'bg-white/80 dark:bg-rose-500/10', border: 'border-l-rose-500', text: 'text-rose-600 dark:text-rose-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' };
  if (v > 0) return { tw: 'orange', bg: 'bg-white/80 dark:bg-orange-500/10', border: 'border-l-orange-500', text: 'text-orange-600 dark:text-orange-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]' };
  return { tw: 'emerald', bg: 'bg-white/80 dark:bg-emerald-500/10', border: 'border-l-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' };
};

const getQueueDeltaColorInfo = (v) => {
  if (v > 10) return { tw: 'orange', bg: 'bg-white/80 dark:bg-orange-500/10', border: 'border-l-orange-500', text: 'text-orange-600 dark:text-orange-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]' };
  if (v > 0) return { tw: 'amber', bg: 'bg-white/80 dark:bg-amber-500/10', border: 'border-l-amber-500', text: 'text-amber-600 dark:text-amber-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' };
  return { tw: 'emerald', bg: 'bg-white/80 dark:bg-emerald-500/10', border: 'border-l-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' };
};

export default function BottomBar({ metrics }) {
  const m = metrics || {};

  const items = [
    {
      label: 'Jitter',
      value: `${m.jitter || 0}ms`,
      style: getValColorInfo(m.jitter || 0, 15, 50),
    },
    {
      label: 'Bandwidth',
      value: `${m.bandwidth || 0} Mbps`,
      style: { bg: 'bg-white/80 dark:bg-blue-500/10', border: 'border-l-blue-500', text: 'text-blue-600 dark:text-blue-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' },
    },
    {
      label: 'Drop Rate',
      value: `${m.drop_rate || 0}/s`,
      style: getDropRateColorInfo(m.drop_rate || 0),
    },
    {
      label: 'WiFi Clients',
      value: m.clients || 0,
      style: { bg: 'bg-white/80 dark:bg-emerald-500/10', border: 'border-l-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', shadow: 'drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' },
    },
    {
      label: 'Throughput',
      value: `${m.throughput || 0} msg/s`,
      style: getValColorInfo(m.throughput || 0, 5, 12, true),
    },
    {
      label: 'Queue Δ',
      value: `${(m.queue_delta || 0) >= 0 ? '+' : ''}${m.queue_delta || 0}`,
      style: getQueueDeltaColorInfo(m.queue_delta || 0),
    },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
    >
      {items.map((item, i) => (
        <motion.div 
          key={i} 
          variants={itemAnim}
          className={`bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-y border-r border-white/50 dark:border-slate-700/50 rounded-2xl p-4 border-l-4 ${item.style.border} hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-lg relative overflow-hidden group`}
        >
          {/* Subtle hover glow */}
          <div className={`absolute inset-0 ${item.style.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
          
          <div className="relative z-10">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-1">
              {item.label}
            </div>
            <div className={`text-xl font-black ${item.style.text} ${item.style.shadow} tracking-tighter`}>
              {item.value}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
