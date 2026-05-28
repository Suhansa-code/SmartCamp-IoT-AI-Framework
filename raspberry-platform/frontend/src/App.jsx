import React, { useState } from 'react'
// PAGES Psychology Components
import LanguagePicker from './components/psychoedu/child/LanguagePicker'
// Resource Management Components
import RegistrationScreen from './components/resources/RegistrationScreen'
import WristbandScanScreen from './components/resources/WristbandScanScreen'
import PredictionScreen from './components/resources/PredictionScreen'
import NetworkScreen from './components/resources/NetworkScreen'
// Context & Shared
import { LanguageProvider } from './components/psychoedu/context/LanguageContext'
import Navbar from './components/Navbar'

function AppContent() {
  const [activeTab, setActiveTab] = useState('pages')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="p-6">
        {activeTab === 'pages' && <LanguagePicker />}

        {activeTab === 'registration' && <RegistrationScreen />}
        {activeTab === 'wristband' && <WristbandScanScreen />}
        {activeTab === 'prediction' && <PredictionScreen />}
        {activeTab === 'network' && <NetworkScreen />}
      </div>
    </div>
  )
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  )
}

export default App
