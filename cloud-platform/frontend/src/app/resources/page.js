'use client'

import PageHeader from '@/components/common/PageHeader'
import SideNav from '@/components/common/SideNav'
import OverviewPanel from '@/components/resources/OverviewPanel'

// Cloud-side resources page.
// Registration and wristband scanning run on the Pi at the camp (raspberry-platform/backend/server.js, port 5000).
// This page shows the cloud dashboard: live camp stats + resource prediction.
// Data arrives via EMQX → CampDataService → /api/resources/overview

const LiveBadge = (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6,
    background: '#0A1A2E', border: '1px solid #1E3A5F',
    borderRadius: 99, padding: '4px 12px', fontSize: 11 }}>
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E',
      boxShadow: '0 0 6px #22C55E', animation: 'pulse 2s infinite' }} />
    <span style={{ color: '#94A3B8', fontWeight: 700 }}>LIVE via EMQX</span>
  </div>
)

export default function ResourcesPage() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: #071B30; }
        ::-webkit-scrollbar-thumb { background: #2D4A70; border-radius:9999px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ minHeight: '100svh', background: '#0A2540', fontFamily: "'Inter',sans-serif", color: 'white', paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>

        <SideNav />

        <PageHeader logoText="R" title="Smart Camp" subtitle="Resources · Cloud Dashboard" right={LiveBadge} />

        {/* ── Section label ──────────────────────────────── */}
        <div style={{ padding: '1rem 1.5rem 0', display: 'flex', alignItems: 'center',
          gap: 10, borderBottom: '1px solid #1E3A5F' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0D9488',
            letterSpacing: 1, textTransform: 'uppercase' }}>
            📊 Camp Overview & Resource Prediction
          </span>
          <span style={{ fontSize: 11, color: '#64748B' }}>
            · Data received from field device via EMQX broker
          </span>
        </div>

        {/* ── Cloud overview panel ───────────────────────── */}
        <main style={{ width: '100%' }}>
          <OverviewPanel />
        </main>
      </div>
    </>
  )
}