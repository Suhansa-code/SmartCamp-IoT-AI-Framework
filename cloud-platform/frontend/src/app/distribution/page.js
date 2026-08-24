'use client'

import PageHeader from '@/components/common/PageHeader'
import SideNav from '@/components/common/SideNav'
import DistributionPanel from '@/components/resources/DistributionPanel'

// Cloud-side distribution planning page.
// Food and drinking water only — shelter and medical staffing are out of scope
// for the Sri Lanka resource model that backs this page.
//
// Rates: prediction-models/models/lka_v2/ration_rates.json
// Data:  EMQX → CampDataService → /api/resources/distribution/*

const ModelBadge = (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6,
    background: '#0A1A2E', border: '1px solid #1E3A5F',
    borderRadius: 99, padding: '4px 12px', fontSize: 11 }}>
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0D9488',
      boxShadow: '0 0 6px #0D9488' }} />
    <span style={{ color: '#94A3B8', fontWeight: 700 }}>LKA RATE TABLE v2</span>
  </div>
)

export default function DistributionPage() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: #F1F3F6; }
        ::-webkit-scrollbar-thumb { background: #C6CDD6; border-radius:9999px; }
      `}</style>

      {/* Chrome stays dark for consistency with the rest of the app; the content
            area is light because the forecast charts are designed for a white surface. */}
      <div style={{ minHeight: '100svh', background: '#F7F8FA', fontFamily: "'Inter',sans-serif", color: '#111827', paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>

        <SideNav />

        <PageHeader logoText="D" title="Smart Camp" subtitle="Distribution · Food & Water" right={ModelBadge} />

        {/* ── Section label ──────────────────────────────── */}
        <div style={{ padding: '0.9rem 1.5rem', display: 'flex', alignItems: 'center',
          gap: 10, background: '#FFFFFF', borderBottom: '1px solid #E3E7EC', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0D9488',
            letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Daily Rations &amp; 7-Day Forecast
          </span>
          <span style={{ fontSize: 11.5, color: '#8A94A3' }}>
            Sri Lanka rate table · population trend fitted on live registrations
          </span>
        </div>

        <main style={{ width: '100%' }}>
          <DistributionPanel />
        </main>
      </div>
    </>
  )
}
