'use client'

import { useState } from 'react'
import { Radio, RefreshCw } from 'lucide-react'
import SideNav from '@/components/common/SideNav'
import PageHeader, { HeaderShell } from '@/components/common/PageHeader'
import Button from '@/components/common/Button'
import OverviewPanel from '@/components/resources/OverviewPanel'
import { P } from '@/components/alert/alertPalette'

// Cloud-side resources page.
// Registration and wristband scanning run on the Pi at the camp (raspberry-platform/backend/server.js, port 5000).
// This page shows the cloud dashboard: live camp stats + resource prediction.
// Data arrives via EMQX → CampDataService → /api/resources/overview

export default function ResourcesPage() {
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${P.border}; border-radius:9999px; }
        @keyframes resPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes resSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ minHeight: '100svh', background: P.outer, fontFamily: "'Inter',sans-serif", color: P.ink, paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>

        <SideNav />

        <div className='header-wrapper'>

        <main style={{ background: P.panel, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── Shared header ──────────────────────────────── */}
        <HeaderShell>
          <PageHeader
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search registrations & events…',
              onRefresh: () => setRefreshKey((k) => k + 1),
              refreshing,
            }}
          />
        </HeaderShell>

        <div style={{ padding: '0rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── Content panel ──────────────────────────────── */}
          <div style={{
            background: P.panel, border: `1px solid ${P.border}`,
            borderRadius: '1.75rem', padding: 'clamp(1.1rem, 2.5vw, 2rem)',
            boxShadow: '0 30px 70px rgba(20,30,40,0.18)',
            display: 'flex', flexDirection: 'column', gap: '1.1rem',
          }}>

            {/* ── Alert-page style title / subtitle ─────────────────── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: P.teal, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
                  Live Field Intelligence
                </div>
                <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', color: P.ink }}>
                  Resources Cloud Dashboard
                </h1>
                <p style={{ color: P.muted, fontSize: '0.82rem', marginTop: 4, fontWeight: 600 }}>
                  {refreshing ? 'Refreshing live overview…' : 'Data received from field device via EMQX broker · unified camp overview'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.78rem', color: P.muted, fontWeight: 600 }}>{today}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: P.cardSoft, border: `1px solid ${P.border}`, borderRadius: 999, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, color: P.green }}>
                  <Radio size={12} />
                  LIVE via EMQX
                </span>
                <Button variant="circle" onClick={() => setRefreshKey((k) => k + 1)} disabled={refreshing} aria-label="Refresh data">
                  <RefreshCw size={16} style={refreshing ? { animation: 'resSpin 0.8s linear infinite' } : undefined} />
                </Button>
              </div>
            </div>

            <OverviewPanel search={search} refreshKey={refreshKey} onLoading={setRefreshing} />
          </div>

          </div>
        </main>
        </div>
      </div>
    </>
  )
}