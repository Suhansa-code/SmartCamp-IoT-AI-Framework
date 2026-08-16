'use client'

// Welfare Anomalies Dashboard — data-focused behavioral and performance anomalies

import { useState, useEffect, useCallback } from 'react'
import PageHeader from '@/components/common/PageHeader'
import CampSidebar from '@/components/common/CampSidebar'
import SkeletonCard from '@/components/common/SkeletonCard'
import SideNav from '@/components/common/SideNav'
import { C } from '@/components/common/theme'
import { daysSince } from '@/components/common/utils'

// ── Mock camp list ────────────────────────────────────────────────────────────
const MOCK_CAMPS = [
  { id: 'all',   name: 'All Camps',        code: 'ALL' },
  { id: 'hmg',   name: 'Homagama',  code: 'HMG' },
  { id: 'gal',   name: 'Galle',      code: 'GAL' },
  { id: 'rtp',   name: 'Rathnapura',      code: 'RTP' },
  { id: 'mat',   name: 'Matara',      code: 'MAT' },
  { id: 'kal',   name: 'Kalutara',   code: 'KAL' },
]

// ── Mock welfare anomaly data ─────────────────────────────────────────────────
function mockWelfareAnomalies() {
  return [
    {
      id: 'w1', childId: 'TEST-CHILD-000200', campId: 'hmg', campName: 'Homagama ',
      anomalies: [
        { type: 'Engagement Drop', metric: 'Session engagement', baseline: 78, current: 42, unit: '%', threshold: 60 },
        { type: 'RT Spike', metric: 'Avg reaction time', baseline: 450, current: 892, unit: 'ms', threshold: 700 },
        { type: 'Attendance', metric: 'Session participation', baseline: 95, current: 45, unit: '%', threshold: 70 },
      ],
      riskLevel: 'HIGH',
      lastSession: Date.now() - 86400000 * 1,
    },
    {
      id: 'w2', childId: 'TEST-CHILD-000199', campId: 'gal', campName: 'Galle',
      anomalies: [
        { type: 'Error Rate Jump', metric: 'False tap rate', baseline: 12, current: 38, unit: '%', threshold: 25 },
        { type: 'Variability', metric: 'RT std deviation', baseline: 120, current: 280, unit: 'ms', threshold: 200 },
      ],
      riskLevel: 'MEDIUM',
      lastSession: Date.now() - 86400000 * 0.5,
    },
    {
      id: 'w3', childId: 'TEST-CHILD-000198', campId: 'rtp', campName: 'Rathnapura',
      anomalies: [
        { type: 'Incomplete Sessions', metric: 'Task abandonment', baseline: 5, current: 75, unit: '%', threshold: 20 },
        { type: 'Score Decline', metric: 'Composite score', baseline: 68, current: 38, unit: 'pts', threshold: 50 },
        { type: 'Distraction Pattern', metric: 'Idle time ratio', baseline: 15, current: 52, unit: '%', threshold: 30 },
      ],
      riskLevel: 'HIGH',
      lastSession: Date.now() - 86400000 * 2,
    },
    {
      id: 'w5', childId: 'TEST-CHILD-000180', campId: 'mat', campName: 'Matara East',
      anomalies: [
        { type: 'Stress Response', metric: 'Rapid click count', baseline: 8, current: 42, unit: 'clicks', threshold: 20 },
        { type: 'Slow Initiation', metric: 'Time to first response', baseline: 800, current: 2100, unit: 'ms', threshold: 1500 },
      ],
      riskLevel: 'MEDIUM',
      lastSession: Date.now() - 86400000 * 0.2,
    },
    {
      id: 'w6', childId: 'TEST-CHILD-000191', campId: 'kal', campName: 'Kalutara South',
      anomalies: [
        { type: 'Dropout Pattern', metric: 'Sessions completed', baseline: 8, current: 2, unit: 'of 10', threshold: 5 },
        { type: 'Consistency Issue', metric: 'Score volatility', baseline: 45, current: 18, unit: 'pts range', threshold: 30 },
        { type: 'Engagement Gap', metric: 'Avg session duration', baseline: 12, current: 4, unit: 'min', threshold: 8 },
      ],
      riskLevel: 'HIGH',
      lastSession: Date.now() - 86400000 * 5,
    },
  ]
}

// ── Risk level badge ──────────────────────────────────────────────────────────
function RiskBadge({ level }) {
  const map = {
    HIGH:    { bg: '#450A0A', color: '#FCA5A5', label: '🔴 HIGH RISK' },
    MEDIUM:  { bg: '#451A03', color: '#FCD34D', label: '🟡 MEDIUM' },
    GOOD:    { bg: '#022C22', color: '#6EE7B7', label: '🟢 GOOD' },
  }
  const s = map[level] ?? map.GOOD
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      borderRadius: '9999px',
      padding: '4px 12px',
      fontSize: '0.75rem',
      fontWeight: 700,
    }}>
      {s.label}
    </span>
  )
}

// ── Anomaly metric row ────────────────────────────────────────────────────────
function AnomalyMetric({ anomaly }) {
  const isAboveThreshold = anomaly.current > anomaly.threshold
  const isPositive = anomaly.type.includes('Positive') || anomaly.type.includes('Improvement')
  const isConcern = isAboveThreshold && !isPositive

  const change = Math.abs(((anomaly.current - anomaly.baseline) / anomaly.baseline) * 100).toFixed(0)
  const direction = anomaly.current > anomaly.baseline ? '↑' : '↓'

  const metricColor = isPositive ? C.green : isConcern ? C.red : C.amber

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '0.6rem',
      padding: '0.65rem 0.85rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderLeft: `3px solid ${metricColor}`,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.textMuted }}>
          {anomaly.metric}
        </div>
        <div style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: '2px' }}>
          Baseline: {anomaly.baseline}{anomaly.unit}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          color: metricColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
        }}>
          {anomaly.current}{anomaly.unit}
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            {direction}{change}%
          </span>
        </div>
        {isConcern && (
          <div style={{ fontSize: '0.7rem', color: C.red, marginTop: '2px', fontWeight: 600 }}>
            ⚠️ Exceeds threshold ({anomaly.threshold}{anomaly.unit})
          </div>
        )}
      </div>
    </div>
  )
}

// ── Welfare anomaly card ──────────────────────────────────────────────────────
function WelfareCard({ alert }) {
  const borderColor = alert.riskLevel === 'GOOD' ? C.green
    : alert.riskLevel === 'MEDIUM'                ? C.amber
    : C.red

  return (
    <div style={{
      background: C.navyCard,
      borderRadius: '1rem',
      borderLeft: `6px solid ${borderColor}`,
      padding: '1.25rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      boxShadow: `0 4px 24px rgba(0,0,0,0.25)`,
    }}>
      {/* ── Header: Child ID + Risk Badge ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div>
          <span style={{
            fontFamily: "'Inter',sans-serif",
            fontSize: '1.25rem',
            fontWeight: 800,
            color: C.textPrimary,
          }}>
            {alert.childId}
          </span>
          <p style={{ fontSize: '0.82rem', color: C.textMuted, marginTop: '2px', fontWeight: 600 }}>
            {alert.campName}
          </p>
        </div>
        <RiskBadge level={alert.riskLevel} />
      </div>

      {/* ── Last session timestamp ── */}
      <div style={{ fontSize: '0.78rem', color: C.textMuted, fontWeight: 600 }}>
        Last session: {daysSince(alert.lastSession)}
      </div>

      {/* ── Anomaly count badge ── */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '0.6rem',
        padding: '0.5rem 0.8rem',
        fontSize: '0.85rem',
        fontWeight: 700,
        color: borderColor,
      }}>
        📊 {alert.anomalies.length} anomal{alert.anomalies.length === 1 ? 'y' : 'ies'} detected
      </div>

      {/* ── Metrics list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {alert.anomalies.map((anom, i) => (
          <AnomalyMetric key={i} anomaly={anom} />
        ))}
      </div>

      {/* ── Action button ── */}
      {alert.riskLevel !== 'GOOD' && (
        <button style={{
          minHeight: '40px',
          background: borderColor,
          color: 'white',
          borderRadius: '0.75rem',
          border: 'none',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => e.target.style.opacity = '0.85'}
        onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          📋 Review & Follow Up
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WelfarePage() {
  const [welfare,     setWelfare]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selectedCamp,setSelectedCamp]= useState('all')
  const [adminName,   setAdminName]   = useState('Admin')

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const fetchWelfare = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/welfare')
      if (res.ok) {
        setWelfare(await res.json())
      } else {
        throw new Error('API error')
      }
    } catch {
      setWelfare(mockWelfareAnomalies())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWelfare() }, [fetchWelfare])

  useEffect(() => {
    setAdminName('Dr. Perera')
  }, [])

  // ── Filter by camp ──────────────────────────────────────────────────────────
  const filteredWelfare = selectedCamp === 'all'
    ? welfare
    : welfare.filter(w => w.campId === selectedCamp)

  // ── Sort by risk level (HIGH → MEDIUM → GOOD) ──────────────────────────────
  const sortedWelfare = [...filteredWelfare].sort((a, b) => {
    const riskMap = { HIGH: 0, MEDIUM: 1, GOOD: 2 }
    return (riskMap[a.riskLevel] ?? 2) - (riskMap[b.riskLevel] ?? 2)
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: #071B30; }
        ::-webkit-scrollbar-thumb { background: #2D4A70; border-radius:9999px; }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

      <div style={{ minHeight: '100svh', background: C.navy, fontFamily: "'Inter',sans-serif", color: 'white', display: 'flex', paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>

        <SideNav />

        <PageHeader title="PAGES" subtitle="Welfare Anomalies" adminName={adminName} fixed />

        {/* Main layout */}
        <div className="dash-body" style={{ marginTop: 60 }}>
          {/* Sidebar */}
          <CampSidebar camps={MOCK_CAMPS} selectedCamp={selectedCamp} onSelect={setSelectedCamp} />

          {/* Main content */}
          <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
            {/* Title & info */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontFamily:"'Inter',sans-serif", fontSize:'1.6rem', fontWeight:800 }}>📊 Behavioral Anomalies</h1>
              <p style={{ color: C.textMuted, fontSize:'0.85rem', marginTop:'2px', fontWeight:600 }}>
                {loading ? 'Loading…' : `${sortedWelfare.length} child${sortedWelfare.length !== 1 ? 'ren' : ''} with anomalies`}
              </p>
            </div>

            {/* Loading skeletons */}
            {loading ? (
              <div className="grid-auto">
                {[1,2,3].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : (
              /* Welfare anomaly cards */
              <div className="grid-auto">
                {sortedWelfare.length > 0 ? (
                  sortedWelfare.map(alert => (
                    <WelfareCard key={alert.id} alert={alert} />
                  ))
                ) : (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem 1rem', color: C.textMuted }}>
                    <p style={{ fontSize: '1rem', fontWeight: 600 }}>No behavioral anomalies detected</p>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}