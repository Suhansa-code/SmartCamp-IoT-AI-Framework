import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Wifi, WifiOff, Server, Box, Sun, Moon } from 'lucide-react';

export default function Header({ networkState, connected, metrics, isDarkMode, toggleTheme }) {
  const getStateColorClass = (state) => ({
    GOOD: 'text-emerald-600 dark:text-emerald-500 border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-emerald-500/30',
    WEAK: 'text-amber-600 dark:text-amber-500 border-amber-500 bg-amber-50 dark:bg-amber-500/10 shadow-amber-500/30',
    POOR: 'text-orange-600 dark:text-orange-500 border-orange-500 bg-orange-50 dark:bg-orange-500/10 shadow-orange-500/30',
    OFFLINE: 'text-rose-600 dark:text-rose-500 border-rose-500 bg-rose-50 dark:bg-rose-500/10 shadow-rose-500/30'
  }[state] || 'text-emerald-600 dark:text-emerald-500 border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-emerald-500/30');

  const sc = getStateColorClass(networkState);
  
  const getDotColorClass = (state) => ({
    GOOD: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]',
    WEAK: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]',
    POOR: 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]',
    OFFLINE: 'bg-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.8)]'
  }[state] || 'bg-emerald-500');

  const dot = getDotColorClass(networkState);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 p-6 sm:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] relative overflow-hidden transition-colors duration-500"
    >
      {/* Background Glows */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-indigo-500 dark:to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 dark:shadow-indigo-500/30 border border-white/20 dark:border-white/10">
          <Activity className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-slate-800 dark:from-white dark:to-slate-400 tracking-tight transition-all">
            SAAMP Network Monitor
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-indigo-400 font-semibold tracking-wider uppercase mt-1 flex items-center gap-2">
            <Box className="w-4 h-4" /> Smart Camp Box · Semantic-Aware
          </p>
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-4">
        
        {/* Connection Status */}
        <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 border border-white dark:border-slate-700 rounded-2xl px-5 py-3 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-inner transition-colors duration-500">
          <div className="flex items-center justify-center relative">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {connected && <div className="absolute w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75" />}
          </div>
          <span className={`text-sm font-bold tracking-widest ${connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {connected ? 'LIVE' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Prediction Display */}
        <div className={`flex items-center gap-4 border border-white/50 dark:border-transparent bg-white/60 dark:bg-transparent rounded-2xl px-6 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-lg transition-all duration-500 ${sc}`}>
          <div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest mb-0.5 opacity-80">
              PREDICTED STATE (60S)
            </div>
            <div className="text-xl font-black tracking-tight">
              {networkState}
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${dot} animate-pulse`} />
        </div>

        {/* MQTT Broker Status */}
        <div className="bg-white/80 dark:bg-slate-800/80 border border-white dark:border-slate-700 rounded-2xl px-5 py-3 flex items-center gap-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-inner transition-colors duration-500">
          <Server className={`w-8 h-8 ${metrics?.bridge_alive ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
          <div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest mb-0.5">
              MQTT BROKER
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${metrics?.bridge_alive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {metrics?.bridge_alive ? 'CONNECTED' : 'OFFLINE'}
              </span>
              <span className="text-slate-400 dark:text-slate-500 text-sm">·</span>
              <span className="text-blue-600 dark:text-blue-400 text-sm font-semibold">{metrics?.clients || 0} clients</span>
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="bg-white/80 dark:bg-slate-800 border border-white dark:border-slate-700 text-slate-600 dark:text-slate-300 p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-sm active:scale-95"
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

      </div>
    </motion.div>
  );
}
