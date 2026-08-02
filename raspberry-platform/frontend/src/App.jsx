import React, { useState } from 'react'
// PAGES Component
import ChildWelcomePage from './app/page.jsx'
import AnimalGame from './components/psychoedu/child/AnimalGame'
import CognitiveSession from './components/psychoedu/cognitive/CognitiveSession'
import BreathingCircle from './components/psychoedu/child/BreathingCircle'
import BubblePlayground from './components/psychoedu/child/BubblePlayground'
import ContentCard from './components/psychoedu/child/ContentCard'
// Resource Management Component
import RegistrationScreen from './components/resources/RegistrationScreen'
import WristbandScanScreen from './components/resources/WristbandScanScreen'
import ChildEducationScreen from './components/childEducation/ChildEducationScreen'
import PredictionScreen from './components/resources/PredictionScreen'
import NetworkScreen from './components/resources/NetworkScreen'
// Context & Shared
import { LanguageProvider } from './components/psychoedu/context/LanguageContext'
import Navbar from './components/Navbar'

function AppContent() {
  const [activeTab, setActiveTab] = useState('pages')
  const [pagesScreen, setPagesScreen] = useState('welcome') 
  const [sessionData, setSessionData] = useState({})
  const [flowType, setFlowType] = useState(null) 

  const handleNavigate = (data) => {
    console.log('QR scan successful, starting game:', data)
    setSessionData(data)
    setFlowType(null) 
    setPagesScreen('game')
  }

  const handleGameComplete = (result) => {
    console.log('Game completed, routing based on gating decision:', result)
    
    const nextRoute = result?.nextRoute || '/child/calming'
    const gateDecision = result?.gateDecision
    const currentAttempt = result?.attempt || sessionData.attempt || 1
    console.log('[APP] Next route determined:', nextRoute, 'Gate decision:', gateDecision, 'Attempt:', currentAttempt)
    
    setSessionData(prev => ({
      ...prev,
      gameMetrics: result?.metrics,
      attempt: result?.attempt || prev.attempt,
      gateDecision: gateDecision,
      session: result?.sessionId // Update session ID from new attempt 2 session
    }))

    if (nextRoute === '/child/cognitive') {
      console.log('[APP] PASS flow: Routing to cognitive session')
      setFlowType('PASS')
      setPagesScreen('cognitive')
    } else if (nextRoute === '/child/calming') {
      console.log('[APP] FAIL detected, attempt:', currentAttempt)
      setFlowType('FAIL')
      // If attempt 2 or higher failed, go to bubble game (FAILED_CONFIRMED)
      // If attempt 1 failed, go to breathing circle for retry
      if (currentAttempt >= 2) {
        console.log('[APP] Attempt 2+ failed (FAILED_CONFIRMED): Routing to bubble game')
        setPagesScreen('play')
      } else {
        console.log('[APP] Attempt 1 failed: Routing to breathing circle for recovery attempt')
        setPagesScreen('calming')
      }
    } else {
      console.log('[APP] No matching route, defaulting to calming')
      setFlowType('FAIL')
      setPagesScreen('calming')
    }
  }

  const handleActivityComplete = (data) => {
    console.log('[APP] Activity completed:', data, 'flowType:', flowType, 'screen:', pagesScreen)
    
    if (flowType === 'PASS') {
      console.log('[APP] PASS flow complete: Ending session')
      setPagesScreen('welcome')
      setSessionData({})
      setFlowType(null)
    } else if (flowType === 'FAIL') {
      if (pagesScreen === 'calming') {
        console.log('[APP] FAIL flow (attempt 1): After breathing, showing content cards')
        setPagesScreen('content')
      } 
      else if (pagesScreen === 'content') {
        console.log('[APP] FAIL flow (attempt 1): After content, starting attempt 2 of animal game')
        setSessionData(prev => ({
          ...prev,
          attempt: (prev.attempt || 1) + 1,
          session: null // Clear session ID so a new one will be created for attempt 2
        }))
        setPagesScreen('game')
      }
      // After bubble game in FAIL flow (attempt 2 failed): end session
      else if (pagesScreen === 'play') {
        console.log('[APP] FAIL flow (attempt 2 FAILED_CONFIRMED): After bubble game, ending session')
        setPagesScreen('welcome')
        setSessionData({})
        setFlowType(null)
      }
    } else {
      // Default: return to welcome
      console.log('[APP] Unknown flow, returning to welcome')
      setPagesScreen('welcome')
      setSessionData({})
      setFlowType(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="p-6">
        {activeTab === 'pages' && (
          <>
            {pagesScreen === 'welcome' && (
              <ChildWelcomePage onNavigate={handleNavigate} />
            )}
            {pagesScreen === 'game' && (
              <AnimalGame 
                onComplete={handleGameComplete}
                sessionId={sessionData.session || ''}
                childId={sessionData.child || ''}
                attempt={sessionData.attempt || 1}
              />
            )}
            {pagesScreen === 'cognitive' && (
              <CognitiveSession 
                onComplete={handleActivityComplete}
                childId={sessionData.child || ''}
                lang={sessionData.lang || 'en'}
                sessionId={sessionData.session || 'offline'}
                attempt={sessionData.attempt || 1}
              />
            )}
            {pagesScreen === 'calming' && (
              <BreathingCircle 
                onComplete={handleActivityComplete}
                sessionId={sessionData.session || 'offline'}
                childId={sessionData.child || ''}
              />
            )}
            {pagesScreen === 'play' && (
              <BubblePlayground 
                onComplete={handleActivityComplete}
                sessionId={sessionData.session || 'offline'}
                childId={sessionData.child || ''}
              />
            )}
            {pagesScreen === 'content' && (
              <ContentCard 
                onComplete={handleActivityComplete}
                sessionId={sessionData.session || 'offline'}
                childId={sessionData.child || ''}
                attempt={sessionData.attempt || 1}
              />
            )}
          </>
        )}

        {activeTab === 'registration' && <RegistrationScreen />}
        {activeTab === 'wristband' && <WristbandScanScreen />}
        {activeTab === 'childEducation' && <ChildEducationScreen />}
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
