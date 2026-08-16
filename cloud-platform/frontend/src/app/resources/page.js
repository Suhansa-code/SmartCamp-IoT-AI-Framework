'use client'

import SideNav from '@/components/common/SideNav'
import OverviewPanel from '@/components/resources/OverviewPanel'
import { useTheme } from '@/components/common/ThemeProvider'

// Cloud-side resources page.
// Registration and wristband scanning run on the Pi at the camp (raspberry-platform/backend/server.js, port 5000).
// This page shows the cloud dashboard: live camp stats + resource prediction.
// Data arrives via EMQX → CampDataService → /api/resources/overview

export default function ResourcesPage() {
  const { T } = useTheme()

  const LiveBadge = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6,
      background: T.bgSoft, border: `1px solid ${T.border}`,
      borderRadius: 999, padding: '4px 12px', fontSize: 11 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green,
        boxShadow: `0 0 6px ${T.green}`, animation: 'pulse 2s infinite' }} />
      <span style={{ color: T.muted, fontWeight: 700 }}>LIVE via EMQX</span>
    </div>
  )

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: #071B30; }
        ::-webkit-scrollbar-thumb { background: #2D4A70; border-radius:9999px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ minHeight: '100svh', background: T.bg, fontFamily: "'Inter',sans-serif", color: T.text, paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>

        <SideNav />

        {/* ── Section label ──────────────────────────────── */}
        <div style={{ padding: '1.25rem 2rem 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          gap: 10, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.tealMid,
              letterSpacing: 1, textTransform: 'uppercase' }}>
              📊 Camp Overview & Resource Prediction
            </div>
            <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.45rem', fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.01em', color: T.textPrimary }}>
              Resources Cloud Dashboard
            </h1>
            <span style={{ fontSize: 11, color: T.muted }}>
              · Data received from field device via EMQX broker
            </span>
          </div>
          {LiveBadge}
        </div>

        {/* ── Cloud overview panel ───────────────────────── */}
        <main style={{ width: '100%' }}>
          <OverviewPanel />
        </main>
      </div>
    </>
  )
}