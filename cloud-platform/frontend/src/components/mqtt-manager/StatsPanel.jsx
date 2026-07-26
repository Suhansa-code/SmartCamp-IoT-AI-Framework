import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CheckCircle2, ShieldAlert, ServerCrash, Layers } from 'lucide-react';

export default function StatsPanel({ stats, buffer, metrics, networkState }) {
  const s = stats || {};
  const totalCrit = (s.critical_sent || 0) + (s.critical_buffered || 0);
  const deliveryRate = totalCrit > 0
    ? ((s.critical_sent / totalCrit) * 100).toFixed(1)
    : '100.0';
  
  let drColorClass = 'text-emerald-600 dark:text-emerald-400 drop-shadow-sm dark:drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]';
  let drBgClass = 'bg-emerald-500 shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.5)]';
  if (+deliveryRate < 70) {
    drColorClass = 'text-rose-600 dark:text-rose-500 drop-shadow-sm dark:drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]';
    drBgClass = 'bg-rose-500 shadow-sm dark:shadow-[0_0_15px_rgba(244,63,94,0.5)]';
  } else if (+deliveryRate < 95) {
    drColorClass = 'text-amber-600 dark:text-amber-500 drop-shadow-sm dark:drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]';
    drBgClass = 'bg-amber-500 shadow-sm dark:shadow-[0_0_15px_rgba(245,158,11,0.5)]';
  }

  const priorityColor = (p) => ({
    CRITICAL: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30',
    IMPORTANT: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
    ROUTINE: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30'
  }[p] || 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30');

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* Delivery Statistics */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-lg relative overflow-hidden shrink-0 transition-colors duration-500"
      >
        <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2 mb-6 relative z-10">
          <Activity className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">Delivery Statistics</h3>
        </div>

        <div className="text-center mb-8 relative z-10">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest mb-2">CRITICAL DELIVERY RATE</div>
          <div className={`text-6xl font-black ${drColorClass} tracking-tighter leading-none`}>
            {deliveryRate}<span className="text-3xl ml-1">%</span>
          </div>
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider mt-2 uppercase">target ≥ 95%</div>
          
          <div className="h-2.5 bg-white/80 dark:bg-slate-800 rounded-full mt-4 overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(+deliveryRate, 100)}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className={`h-full rounded-full ${drBgClass}`}
            />
          </div>
        </div>

        <div className="space-y-3 relative z-10">
          {[
            { label: 'Total Sent',          value: s.total_sent || 0,        color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Total Buffered',      value: s.total_buffered || 0,    color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Total Dropped',       value: s.total_dropped || 0,     color: 'text-rose-600 dark:text-rose-400' },
            { label: 'Critical Sent',       value: s.critical_sent || 0,     color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Critical Buffered',   value: s.critical_buffered || 0, color: 'text-amber-600 dark:text-amber-400' },
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{row.label}</span>
              <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>

        <div className={`mt-6 p-3 rounded-xl border flex justify-between items-center shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-inner relative z-10 transition-colors duration-500 ${
          metrics?.bridge_alive 
            ? 'bg-white/80 dark:bg-emerald-500/10 border-white dark:border-emerald-500/30' 
            : 'bg-white/80 dark:bg-rose-500/10 border-white dark:border-rose-500/30'
        }`}>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
            {metrics?.bridge_alive ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <ServerCrash className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
            Cloud Bridge
          </span>
          <span className={`text-xs font-black tracking-wider ${metrics?.bridge_alive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {metrics?.bridge_alive ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
      </motion.div>

      {/* Priority Buffer */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-lg relative overflow-hidden flex-1 flex flex-col min-h-[300px] transition-colors duration-500"
      >
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">Priority Buffer</h3>
          </div>
          <span className={`px-3 py-1 text-[10px] font-bold tracking-widest rounded-full border transition-colors duration-500 ${
            buffer.length > 0 
              ? 'bg-white/80 dark:bg-amber-500/10 border-white dark:border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-sm dark:shadow-none' 
              : 'bg-white/80 dark:bg-slate-800/50 border-white dark:border-slate-700 text-slate-500 shadow-sm dark:shadow-none'
          }`}>
            {buffer.length} QUEUED
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
          {buffer.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <CheckCircle2 className="w-12 h-12 mb-3 opacity-50" />
              <div className="text-sm font-semibold tracking-wide">Buffer Empty</div>
              <div className="text-xs mt-1 opacity-75">All messages delivered to cloud</div>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {buffer.slice(0, 10).map((msg, i) => {
                  const pc = priorityColor(msg.priority);
                  const timeStr = msg.time || (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '—');
                  
                  return (
                    <motion.div 
                      key={msg.id || i}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="p-3 bg-white/80 dark:bg-slate-800/60 rounded-xl border border-white dark:border-slate-700/50 flex justify-between items-center shadow-sm transition-colors duration-500"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize tracking-wide flex items-center gap-2">
                          {msg.source || msg.source_type} 
                          <span className="text-slate-300 dark:text-slate-600">·</span> 
                          {(msg.action || '').replace(/_/g, ' ')}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          {timeStr}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-black tracking-widest rounded-md border ${pc}`}>
                        {(msg.priority || '').slice(0, 4)}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {networkState !== 'OFFLINE' && buffer.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-white/80 dark:bg-emerald-500/10 border border-white dark:border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 text-center flex items-center justify-center gap-2 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-inner transition-colors duration-500 relative z-10"
          >
            <ShieldAlert className="w-4 h-4" />
            Reconnected — Flushing CRITICAL records first
          </motion.div>
        )}
      </motion.div>

    </div>
  );
}
