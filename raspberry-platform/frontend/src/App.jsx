import React, { useState } from 'react'
import WristbandScanScreen from './components/resources/WristbandScanScreen'
import RegistrationScreen from './components/resources/RegistrationScreen'
import PredictionScreen from './components/resources/PredictionScreen'
import NetworkScreen from './components/resources/NetworkScreen'
import Navbar from './components/Navbar'

function App() {
  const [activeTab, setActiveTab] = useState('registration')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="p-6">
        {activeTab === 'registration' && <RegistrationScreen />}
        {activeTab === 'wristband' && <WristbandScanScreen />}
        {activeTab === 'prediction' && <PredictionScreen />}
        {activeTab === 'network' && <NetworkScreen />}
      </div>
    </div>
  )
}

export default App
