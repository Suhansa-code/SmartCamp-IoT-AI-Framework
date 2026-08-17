'use client'

import { useState, useEffect, useCallback } from 'react'
import SideNav from '@/components/common/SideNav'
import PageHeader from '@/components/common/PageHeader'
import Header from '@/components/network/Header'
import StatCards from '@/components/network/StatCards'
import MessageLog from '@/components/network/MessageLog'
import NetworkPanel from '@/components/network/NetworkPanel'
import StatsPanel from '@/components/network/StatsPanel'
import BottomBar from '@/components/network/BottomBar'
import { useTheme } from '@/components/common/ThemeProvider'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function fetchNetworkMetrics() {
  const res = await fetch(`${API_BASE}/api/network/metrics`)
  if (!res.ok) return null
  return res.json()
}

export default function NetworkPage() {
  const { T } = useTheme()
  const [connected, setConnected] = useState(false)
  const [networkState, setNetworkState] = useState('GOOD')
  const [metrics, setMetrics] = useState(null)
  const [messages, setMessages] = useState([])
  const [stats, setStats] = useState({})
  const [buffer, setBuffer] = useState([])
  const [history, setHistory] = useState([])

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
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #071B30; }
        ::-webkit-scrollbar-thumb { background: #2D4A70; border-radius: 9999px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
      `}</style>

      <div style={{ minHeight: '100svh', background: T.bg, fontFamily: "'Inter',sans-serif", color: T.text, paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>

        <SideNav />

        <main style={{ padding: '1.5rem 2rem', width: '100%' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <PageHeader />
          </div>

          <Header
            networkState={networkState}
            connected={connected}
            metrics={metrics}
          />

          <StatCards metrics={metrics} history={history} />

          <div className="grid-panel" style={{ alignItems: 'start' }}>
            <MessageLog messages={messages} networkState={networkState} />
            <NetworkPanel networkState={networkState} metrics={metrics} />
          </div>

          <div className="grid-2" style={{ marginTop: 18 }}>
            <StatsPanel stats={stats} buffer={buffer} metrics={metrics} networkState={networkState} />

            <div style={{
              background: `linear-gradient(160deg, ${T.card} 0%, ${T.bg} 100%)`,
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '0.9rem 1.1rem', borderBottom: `1px solid ${T.line}` }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>System Logs</span>
              </div>
              <div style={{ padding: '1rem 1.1rem', fontSize: '0.85rem', color: T.muted, textAlign: 'center', padding: '3rem 0' }}>
                No system logs available
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <BottomBar metrics={metrics} />
          </div>
        </main>
      </div>
    </>
  )
}