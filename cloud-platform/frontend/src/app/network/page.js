'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/mqtt-manager/Header'
import StatCards from '@/components/mqtt-manager/StatCards'
import MessageLog from '@/components/mqtt-manager/MessageLog'
import NetworkPanel from '@/components/mqtt-manager/NetworkPanel'
import StatsPanel from '@/components/mqtt-manager/StatsPanel'
import BottomBar from '@/components/mqtt-manager/BottomBar'
import { C } from '@/components/App.jsx'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function fetchNetworkMetrics() {
  const res = await fetch(`${API_BASE}/api/network/metrics`)
  if (!res.ok) return null
  return res.json()
}

export default function NetworkPage() {
  const router = useRouter()
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

      <div style={{ minHeight: '100svh', background: '#0A2540', fontFamily: "'Nunito',sans-serif", color: 'white' }}>

        {/* Header */}
        <header style={{
          background: '#071B30',
          borderBottom: '1px solid #2D4A70',
          padding: '0 2rem',
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width:44, height:44, borderRadius:'0.8rem', background:'#0D9488', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Baloo 2',cursive", fontWeight:900, fontSize:'1.3rem', color:'white' }}>P</div>
            <span style={{ fontFamily:"'Baloo 2',cursive", fontWeight:800, fontSize:'1.4rem' }}>PAGES <span style={{ fontSize:'0.9rem', color:'#94A3B8', fontWeight:600 }}>Admin Console</span></span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            <div style={{ textAlign:'right' }}>
              <p style={{ fontSize:'1rem', fontWeight:700 }}>{adminName}</p>
              <p style={{ fontSize:'0.85rem', color:'#94A3B8' }}>Administrator</p>
            </div>
            <div style={{ width:44, height:44, borderRadius:'50%', background:'#1E3A5F', border:'2px solid #0D9488', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem' }}>👤</div>
          </div>
        </header>

        {/* Nav tabs */}
        <nav style={{ background:'#071B30', borderBottom:'1px solid #2D4A70', padding:'0 2rem', display:'flex', gap:'0' }}>
          {[
            { label:'All Camps', path:'/admin', active: false },
            { label:'Alerts',    path:'/admin/alerts', active: false },
            { label:'Analytics', path:'/admin/analytics', active: false },
            { label:'Network',   path:'/admin/network', active: true },
          ].map(tab => (
            <button key={tab.path} onClick={() => router.push(tab.path)} style={{
              padding:'1rem 1.5rem',
              background:'transparent',
              border:'none',
              borderBottom: tab.active ? '4px solid #0D9488' : '4px solid transparent',
              color: tab.active ? 'white' : '#94A3B8',
              fontWeight: tab.active ? 800 : 600,
              fontSize:'1rem',
              cursor:'pointer',
              transition:'color 0.15s',
            }}>
              {tab.label}
            </button>
          ))}
        </nav>

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
