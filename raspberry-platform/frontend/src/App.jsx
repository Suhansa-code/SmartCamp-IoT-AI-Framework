import React, { useState } from 'react'
import WristbandScanScreen from './components/resources/WristbandScanScreen'
import RegistrationScreen from './components/resources/RegistrationScreen'
import Navbar from './components/Navbar'

function App() {
  const [activeTab, setActiveTab] = useState('registration')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="p-6">
        {activeTab === 'registration' && <RegistrationScreen />}
        {activeTab === 'wristband' && <WristbandScanScreen />}
      </div>
    </div>
  )
}

export default App
