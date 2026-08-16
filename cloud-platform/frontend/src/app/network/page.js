'use client'

import { useState, useEffect, useCallback } from 'react'
import PageHeader from '@/components/common/PageHeader'
import SideNav from '@/components/common/SideNav'
import Header from '@/components/network/Header'
import StatCards from '@/components/network/StatCards'
import MessageLog from '@/components/network/MessageLog'
import NetworkPanel from '@/components/network/NetworkPanel'
import StatsPanel from '@/components/network/StatsPanel'
import BottomBar from '@/components/network/BottomBar'
import { C } from '@/components/common/theme'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function fetchNetworkMetrics() {
  const res = await fetch(`${API_BASE}/api/network/metrics`)
  if (!res.ok) return null
  return res.json()
}

export default function NetworkPage() {
  const [adminName] = useState('Dr. Perera')
  const [connected, setConnected] = useState(false)
  const [networkState, setNetworkState] = useState('GOOD')
  const [metrics, setMetrics] = useState(null)
  const [messages, setMessages] = useState([])
  const [stats, setStats] = useState({})
  const [buffer, setBuffer] = useState([])
  const [history, setHistory] = useState([])
  const [isDarkMode, setIsDarkMode] = useState(true)

  const updateData = useCallback(async () => {
    try {
      const data = await fetchNetworkMetrics()
      if (data) {
        setMetrics(data.metrics)
        setNetworkState(data.network_state?.network_state || 'GOOD')
        setConnected(data.connected ?? false)
        setStats(data.stats || {})
        setMessages(data.messages || [])
        setBuffer(data.buffer || [])
        setHistory(data.history || [])
      } else {
        setConnected(false)
      }
    } catch {
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    updateData()
    const interval = setInterval(updateData, 5000)
    return () => clearInterval(interval)
  }, [updateData])

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: #071B30; }
        ::-webkit-scrollbar-thumb { background: #2D4A70; border-radius:9999px; }
        .pulse { animation: pulse 1.5s ease-in-out infinite; }
        .slide { animation: slide 0.15s ease; }
      `}</style>

      <div style={{ minHeight: '100svh', background: '#0A2540', fontFamily: "'Inter',sans-serif", color: 'white', paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>

        <SideNav />

        <PageHeader title="PAGES" subtitle="Admin Console" adminName={adminName} height={72} />

        {/* SAAMP Network Monitor Content */}
        <div className={isDarkMode ? 'dark' : ''}>
          <div className="min-h-[calc(100svh-72px)] p-6 sm:p-8 lg:p-10 transition-colors duration-500 bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-slate-200 relative overflow-hidden z-0 max-w-7xl mx-auto">
            {/* Dynamic Background Blurs for Light Mode */}
            {!isDarkMode && (
              <>
                <div className="absolute top-[-10%] left-[-10%] w-125 h-125 bg-blue-400/20 rounded-full blur-[100px] mix-blend-multiply pointer-events-none -z-10" />
                <div className="absolute bottom-[-10%] right-[-10%] w-150 h-150 bg-emerald-400/20 rounded-full blur-[120px] mix-blend-multiply pointer-events-none -z-10" />
              </>
            )}

            {/* MQTT Manager Header */}
            <Header 
              networkState={networkState}
              connected={connected}
              metrics={metrics}
              isDarkMode={isDarkMode}
              toggleTheme={() => setIsDarkMode(!isDarkMode)}
            />

          {/* Stat Cards */}
          <StatCards metrics={metrics} history={history} />

          {/* Main Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 380px',
            gap: 18,
          }}>
            {/* Left - Message Log */}
            <MessageLog 
              messages={messages}
              networkState={networkState}
            />

            {/* Right - Network Panel */}
            <NetworkPanel 
              networkState={networkState}
              metrics={metrics}
            />
          </div>

          {/* Stats Panel */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 18,
            marginTop: 18,
          }}>
            <StatsPanel 
              stats={stats}
              buffer={buffer}
              metrics={metrics}
              networkState={networkState}
            />
            
            {/* Empty placeholder for balance */}
            <div style={{
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: 20,
            }}>
              <div style={{
                fontSize: 13, color: C.muted,
                letterSpacing: 1, marginBottom: 16,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                System Logs
              </div>
              <div style={{ fontSize: 14, color: C.muted, textAlign: 'center', padding: '3rem 0' }}>
                No system logs available
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div style={{ marginTop: 18 }}>
            <BottomBar metrics={metrics} />
          </div>
        </div>
        </div>
      </div>
    </>
  )
}