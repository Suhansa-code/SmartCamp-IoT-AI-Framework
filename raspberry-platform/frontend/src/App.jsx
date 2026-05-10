import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import WristbandScanScreen from './components/resources/WristbandScanScreen'
import RegistrationScreen from './components/resources/RegistrationScreen'
import PredictionScreen from './components/resources/PredictionScreen'
import NetworkScreen from './components/resources/NetworkScreen'
import Navbar from './components/Navbar'

function App() {
  const [activeTab, setActiveTab] = useState('registration')

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans text-slate-900 flex flex-col">
      {/* Global Ambient Background Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-400/20 rounded-full blur-[120px] mix-blend-multiply pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-400/20 rounded-full blur-[120px] mix-blend-multiply pointer-events-none" />
      <div className="absolute top-[40%] right-[10%] w-[400px] h-[400px] bg-amber-400/10 rounded-full blur-[100px] mix-blend-multiply pointer-events-none" />

      <div className="relative z-50 pt-6 px-4 sm:px-6">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
      
      <div className="flex-1 relative z-10 w-full px-4 sm:px-6 pt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === 'registration' && <RegistrationScreen />}
            {activeTab === 'wristband' && <WristbandScanScreen />}
            {activeTab === 'prediction' && <PredictionScreen />}
            {activeTab === 'network' && <NetworkScreen />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default App
