import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Activity, ListFilter } from 'lucide-react';

const getStatusColor = (s) => ({
  sent:     'text-emerald-600 dark:text-emerald-400 bg-white/80 dark:bg-emerald-500/10 border-white dark:border-emerald-500/30 shadow-sm dark:shadow-[0_0_10px_rgba(16,185,129,0.2)]',
  buffered: 'text-amber-600 dark:text-amber-400 bg-white/80 dark:bg-amber-500/10 border-white dark:border-amber-500/30 shadow-sm dark:shadow-[0_0_10px_rgba(245,158,11,0.2)]',
  dropped:  'text-rose-600 dark:text-rose-400 bg-white/80 dark:bg-rose-500/10 border-white dark:border-rose-500/30 shadow-sm dark:shadow-[0_0_10px_rgba(244,63,94,0.2)]',
  delayed:  'text-amber-600 dark:text-amber-400 bg-white/80 dark:bg-amber-500/10 border-white dark:border-amber-500/30 shadow-sm dark:shadow-[0_0_10px_rgba(245,158,11,0.2)]',
}[s] || 'text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-500/10 border-white dark:border-slate-500/30');

const getStatusLabel = (s, qos) => ({
  sent:     `QoS ${qos}`,
  buffered: 'BUFFERED',
  dropped:  'DROPPED',
  delayed:  'DELAYED',
}[s] || (s || '').toUpperCase());

const getPriorityColor = (p) => ({
  CRITICAL: 'text-rose-600 dark:text-rose-400 bg-white/80 dark:bg-rose-500/10 border-white dark:border-rose-500/30 shadow-sm dark:shadow-[0_0_10px_rgba(244,63,94,0.2)]',
  IMPORTANT: 'text-amber-600 dark:text-amber-400 bg-white/80 dark:bg-amber-500/10 border-white dark:border-amber-500/30 shadow-sm dark:shadow-[0_0_10px_rgba(245,158,11,0.2)]',
  ROUTINE: 'text-blue-600 dark:text-blue-400 bg-white/80 dark:bg-blue-500/10 border-white dark:border-blue-500/30 shadow-sm dark:shadow-[0_0_10px_rgba(59,130,246,0.2)]'
}[p] || 'text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-500/10 border-white dark:border-slate-500/30');

const getStateTextColor = (state) => ({
  GOOD: 'text-emerald-600 dark:text-emerald-400',
  WEAK: 'text-amber-600 dark:text-amber-400',
  POOR: 'text-orange-600 dark:text-orange-400',
  OFFLINE: 'text-rose-600 dark:text-rose-400'
}[state] || 'text-slate-500 dark:text-slate-400');

export default function MessageLog({ messages, networkState }) {
  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-lg flex flex-col h-full relative overflow-hidden transition-colors duration-500">
      
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex justify-between items-center mb-6 relative z-10">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">SAAMP Live Log</h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/80 dark:bg-emerald-500/10 border border-white dark:border-emerald-500/30 rounded-full transition-colors duration-500 shadow-sm dark:shadow-none">
          <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)] dark:shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest">
            LIVE · {messages.length} MSG
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[60px_100px_100px_80px_1fr_80px] gap-4 pb-3 border-b border-white/80 dark:border-slate-700/50 text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase relative z-10">
        <span>Time</span>
        <span>Source</span>
        <span>Action</span>
        <span>Priority</span>
        <span>Topic</span>
        <span className="text-right">Status</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-2 relative z-10 min-h-[300px]">
        {messages.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <ListFilter className="w-12 h-12 mb-3 opacity-50" />
            <div className="text-sm font-semibold tracking-wide">Awaiting Traffic</div>
            <div className="text-xs mt-1 opacity-75">Monitoring MQTT broker for messages</div>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg, i) => {
              const sl = getStatusLabel(msg.status, msg.qos_assigned || msg.qos);
              const timeStr = msg.time || (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '—');

              return (
                <motion.div
                  key={msg.id || i}
                  initial={{ opacity: 0, x: -10, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
                  animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(255, 255, 255, 0)' }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                  className="grid grid-cols-[60px_100px_100px_80px_1fr_80px] gap-4 py-3 border-b border-white/40 dark:border-slate-800 hover:bg-white/80 dark:hover:bg-slate-800/40 transition-colors items-center"
                >
                  <span className="text-[10px] font-mono text-slate-500">
                    {timeStr.slice(-8, -3)}
                  </span>

                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize truncate">
                    {msg.source || msg.source_type || '—'}
                  </span>

                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 capitalize truncate">
                    {(msg.action || '').replace(/_/g, ' ')}
                  </span>

                  <div>
                    <span className={`inline-block px-2 py-1 rounded border text-[9px] font-black tracking-widest text-center transition-colors duration-500 ${getPriorityColor(msg.priority)}`}>
                      {(msg.priority || '').slice(0, 4)}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-500 truncate" title={msg.topic}>
                    {msg.topic || '—'}
                  </span>

                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded border text-[9px] font-black tracking-widest text-center transition-colors duration-500 ${getStatusColor(msg.status)}`}>
                      {sl}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <div className="mt-6 p-4 bg-white/80 dark:bg-slate-950/50 rounded-2xl border border-white dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between relative z-10 transition-colors duration-500 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <span>SAAMP active classification mode</span>
        </div>
        <div>
          Current State: <span className={`font-black tracking-wider ml-1 ${getStateTextColor(networkState)}`}>{networkState}</span>
        </div>
      </div>
    </div>
  );
}
