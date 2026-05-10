import React from "react";
import { motion } from "framer-motion";

function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "registration", label: "Registration" },
    { id: "wristband", label: "Distribution" },
    { id: "prediction", label: "AI Forecasts" },
    { id: "network", label: "Network QoS" },
  ];

  return (
    <nav className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl max-w-5xl mx-auto px-4 py-3">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 pl-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
            S
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">
            SmartCamp
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1 p-1 bg-slate-100/50 rounded-xl border border-slate-200/50">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 ${
                  isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="navbar-active-pill"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
