'use client'

import { useRouter } from 'next/navigation'
import OverviewPanel from '@/components/resources/OverviewPanel'

// Cloud-side admin resources page.
// Registration and wristband scanning run on the Pi at the camp (raspberry-platform/backend/server.js, port 5000).
// This page shows the cloud dashboard: live camp stats + resource prediction.
// Data arrives via EMQX → CampDataService → /api/resources/overview

export default function ResourcesPage() {
  const router = useRouter()

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: #071B30; }
        ::-webkit-scrollbar-thumb { background: #2D4A70; border-radius:9999px; }
      `}</style>

      <div style={{ minHeight: '100svh', background: '#0A2540', fontFamily: "'Nunito',sans-serif", color: 'white' }}>

        {/* ── Header ─────────────────────────────────────── */}
        <header style={{
          background: '#071B30', borderBottom: '1px solid #2D4A70',
          padding: '0 1.5rem', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width:34, height:34, borderRadius:'0.6rem', background:'#0D9488',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:"'Baloo 2',cursive", fontWeight:900, fontSize:'1rem', color:'white' }}>R</div>
            <span style={{ fontFamily:"'Baloo 2',cursive", fontWeight:800, fontSize:'1.15rem' }}>
              Smart Camp{' '}
              <span style={{ fontSize:'0.72rem', color:'#94A3B8', fontWeight:600 }}>
                Resources · Cloud Dashboard
              </span>
            </span>
          </div>

          {/* Live badge */}
          <div style={{ display:'flex', alignItems:'center', gap:6,
            background:'#0A1A2E', border:'1px solid #1E3A5F',
            borderRadius:99, padding:'4px 12px', fontSize:11 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#22C55E',
              boxShadow:'0 0 6px #22C55E', animation:'pulse 2s infinite' }} />
            <span style={{ color:'#94A3B8', fontWeight:700 }}>LIVE via EMQX</span>
          </div>
        </header>

        {/* ── Top nav ────────────────────────────────────── */}
        <nav style={{ background:'#071B30', borderBottom:'1px solid #2D4A70',
          padding:'0 1.5rem', display:'flex', gap:0, overflowX:'auto' }}>
          {[
            { label:'All Camps',  path:'/admin' },
            { label:'Alerts',     path:'/admin/alert' },
            { label:'Analytics',  path:'/admin/analytics' },
            { label:'Network',    path:'/admin/network' },
            { label:'Resources',  path:'/admin/resources', active: true },
          ].map(t => (
            <button key={t.path} onClick={() => router.push(t.path)} style={{
              padding:'0.75rem 1.25rem', background:'transparent', border:'none',
              borderBottom: t.active ? '3px solid #0D9488' : '3px solid transparent',
              color: t.active ? 'white' : '#94A3B8',
              fontWeight: t.active ? 800 : 600, fontSize:'0.9rem',
              cursor:'pointer', whiteSpace:'nowrap', transition:'color 0.15s',
            }}>{t.label}</button>
          ))}
        </nav>

        {/* ── Section label ──────────────────────────────── */}
        <div style={{ padding:'1rem 1.5rem 0', display:'flex', alignItems:'center',
          gap:10, borderBottom:'1px solid #1E3A5F' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#0D9488',
            letterSpacing:1, textTransform:'uppercase' }}>
            📊 Camp Overview & Resource Prediction
          </span>
          <span style={{ fontSize:11, color:'#64748B' }}>
            · Data received from field device via EMQX broker
          </span>
        </div>

        {/* ── Cloud overview panel ───────────────────────── */}
        <main style={{ maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
          <OverviewPanel />
        </main>

        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    </>
  )
}
