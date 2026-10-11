import React, { useState } from 'react'
import { LanguageProvider } from './psychoedu/context/LanguageContext'
import ChildWelcomePage from './childEducation/ChildWelcomePage'
import AnimalGame from './psychoedu/child/AnimalGame'
import CognitiveSession from './psychoedu/cognitive/CognitiveSession'
import BreathingCircle from './psychoedu/child/BreathingCircle'
import BubblePlayground from './psychoedu/child/BubblePlayground'
import ContentCard from './psychoedu/child/ContentCard'

function ChildFlowContent() {
  const [screen, setScreen] = useState('welcome')
  const [sessionData, setSessionData] = useState({})
  const [flowType, setFlowType] = useState(null)

  const handleGameComplete = (result) => {
    const nextRoute = result?.nextRoute || '/child/calming'
    const gateDecision = result?.gateDecision
    const currentAttempt = result?.attempt || sessionData.attempt || 1

    setSessionData(prev => ({
      ...prev,
      gameMetrics: result?.metrics,
      attempt: result?.attempt || prev.attempt,
      gateDecision,
      session: result?.sessionId,
    }))

    if (nextRoute === '/child/cognitive') {
      setFlowType('PASS')
      setScreen('cognitive')
    } else if (nextRoute === '/child/calming') {
      setFlowType('FAIL')
      setScreen(currentAttempt >= 2 ? 'play' : 'calming')
    } else {
      setFlowType('FAIL')
      setScreen('calming')
    }
  }

  const handleActivityComplete = (data) => {
    if (flowType === 'PASS') {
      setScreen('welcome')
      setSessionData({})
      setFlowType(null)
    } else if (flowType === 'FAIL') {
      if (screen === 'calming') {
        setScreen('content')
      } else if (screen === 'content') {
        setSessionData(prev => ({
          ...prev,
          attempt: (prev.attempt || 1) + 1,
          session: null,
        }))
        setScreen('game')
      } else if (screen === 'play') {
        setScreen('welcome')
        setSessionData({})
        setFlowType(null)
      }
    } else {
      setScreen('welcome')
      setSessionData({})
      setFlowType(null)
    }
  }

  return (
    <div className="child-flow min-h-screen">
      {screen === 'welcome' && <ChildWelcomePage onNavigate={(data) => { setSessionData(data); setScreen('game') }} />}
      {screen === 'game' && (
        <AnimalGame
          onComplete={handleGameComplete}
          sessionId={sessionData.session || ''}
          childId={sessionData.child || ''}
          attempt={sessionData.attempt || 1}
        />
      )}
      {screen === 'cognitive' && (
        <CognitiveSession
          onComplete={handleActivityComplete}
          childId={sessionData.child || ''}
          lang={sessionData.lang || 'en'}
          sessionId={sessionData.session || 'offline'}
          attempt={sessionData.attempt || 1}
        />
      )}
      {screen === 'calming' && (
        <BreathingCircle
          onComplete={handleActivityComplete}
          sessionId={sessionData.session || 'offline'}
          childId={sessionData.child || ''}
        />
      )}
      {screen === 'play' && (
        <BubblePlayground
          onComplete={handleActivityComplete}
          sessionId={sessionData.session || 'offline'}
          childId={sessionData.child || ''}
        />
      )}
      {screen === 'content' && (
        <ContentCard
          onComplete={handleActivityComplete}
          sessionId={sessionData.session || 'offline'}
          childId={sessionData.child || ''}
          attempt={sessionData.attempt || 1}
        />
      )}
    </div>
  )
}

export default function ChildFlow() {
  return (
    <LanguageProvider>
      <ChildFlowContent />
    </LanguageProvider>
  )
}
