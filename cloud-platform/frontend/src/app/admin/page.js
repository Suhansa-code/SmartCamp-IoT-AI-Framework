'use client'

// ─────────────────────────────────────────────────────────────────────────────
// app/admin/page.jsx — PAGES Admin: All Camps Overview
// Dark navy bg #0A2540 · Cognito-guarded (middleware)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Campoverview from '@/components/psychoedu/dashboard/Campoverview'

export default function AdminPage() {
  const router     = useRouter()
  const [camps, setCamps]     = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [adminName, setAdminName] = useState('Admin')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('alertsDesc')

  async function loadCamps(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const r = await fetch('/api/admin/camps')
      const payload = r.ok ? await r.json() : []
      setCamps(Array.isArray(payload) ? payload : [])
    } catch {
      setCamps([])
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    loadCamps(false)

    // Stub Cognito name — replace with actual Amplify call
    setAdminName('Dr. Perera')
  }, [])

  const normalizedCamps = useMemo(() => {
    return camps.map((camp) => {
      const alertCount = camp.alerts?.length ?? 0
      const status = alertCount === 0 ? 'clear' : alertCount <= 2 ? 'watch' : 'urgent'
      return {
        ...camp,
        alertCount,
        status,
        childCount: Number(camp.childCount ?? 0),
        sessionCount: Number(camp.sessionCount ?? 0),
      }
    })
  }, [camps])

  const stats = useMemo(() => {
    const totalCamps = normalizedCamps.length
    const totalChildren = normalizedCamps.reduce((s, c) => s + c.childCount, 0)
    const totalSessions = normalizedCamps.reduce((s, c) => s + c.sessionCount, 0)
    const totalAlerts = normalizedCamps.reduce((s, c) => s + c.alertCount, 0)
    return { totalCamps, totalChildren, totalSessions, totalAlerts }
  }, [normalizedCamps])

  const filteredCamps = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    let list = normalizedCamps.filter((camp) => {
      const matchesText = !q
        || camp.name?.toLowerCase().includes(q)
        || camp.code?.toLowerCase().includes(q)
        || camp.location?.toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'all' || camp.status === statusFilter
      return matchesText && matchesStatus
    })

    list = [...list].sort((a, b) => {
      if (sortBy === 'nameAsc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'sessionsDesc') return b.sessionCount - a.sessionCount
      if (sortBy === 'childrenDesc') return b.childCount - a.childCount
      return b.alertCount - a.alertCount
    })

    return list
  }, [normalizedCamps, searchText, statusFilter, sortBy])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800;900&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: #071B30; }
        ::-webkit-scrollbar-thumb { background: #2D4A70; border-radius:9999px; }
      `}</style>

      <div style={{ minHeight: '100svh', background: '#0A2540', fontFamily: "'Nunito',sans-serif", color: 'white' }}>

        {/* Header */}
        <header style={{
          background: '#071B30',
          borderBottom: '1px solid #2D4A70',
          padding: '0 1.5rem',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width:34, height:34, borderRadius:'0.6rem', background:'#0D9488', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Baloo 2',cursive", fontWeight:900, fontSize:'1rem', color:'white' }}>P</div>
            <span style={{ fontFamily:"'Baloo 2',cursive", fontWeight:800, fontSize:'1.15rem' }}>PAGES <span style={{ fontSize:'0.72rem', color:'#94A3B8', fontWeight:600 }}>Admin Console</span></span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <div style={{ textAlign:'right' }}>
              <p style={{ fontSize:'0.85rem', fontWeight:700 }}>{adminName}</p>
              <p style={{ fontSize:'0.72rem', color:'#94A3B8' }}>Administrator</p>
            </div>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'#1E3A5F', border:'2px solid #0D9488', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>👤</div>
          </div>
        </header>

        {/* Nav tabs */}
        <nav style={{ background:'#071B30', borderBottom:'1px solid #2D4A70', padding:'0 1.5rem', display:'flex', gap:'0' }}>
          {[
            { label:'All Camps', path:'/admin', active: true },
            { label:'Alerts',    path:'/admin/alert', active: false },
            { label:'Analytics', path:'/admin/analytics', active: false },
          ].map(tab => (
            <button key={tab.path} onClick={() => router.push(tab.path)} style={{
              padding:'0.75rem 1.25rem',
              background:'transparent',
              border:'none',
              borderBottom: tab.active ? '3px solid #0D9488' : '3px solid transparent',
              color: tab.active ? 'white' : '#94A3B8',
              fontWeight: tab.active ? 800 : 600,
              fontSize:'0.9rem',
              cursor:'pointer',
              transition:'color 0.15s',
            }}>
              {tab.label}
            </button>
          ))}
        </nav>

        <main style={{ padding:'1.5rem', maxWidth:'1200px', margin:'0 auto' }}>
          <div style={{ marginBottom:'1.5rem' }}>
            <h1 style={{ fontFamily:"'Baloo 2',cursive", fontSize:'1.6rem', fontWeight:900 }}>🏕️ All Camps Overview</h1>
            <p style={{ color:'#94A3B8', fontSize:'0.85rem', marginTop:'2px', fontWeight:600 }}>
              {loading ? 'Loading…' : `${filteredCamps.length} of ${stats.totalCamps} camp${stats.totalCamps !== 1 ? 's' : ''} shown`}
            </p>
          </div>

          {/* KPI row */}
          {!loading && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'0.75rem', marginBottom:'1rem' }}>
              {[
                { label:'Total Camps', value:stats.totalCamps, icon:'🏕️', color:'#60A5FA' },
                { label:'Children', value:stats.totalChildren, icon:'🧒', color:'#4ADE80' },
                { label:'Sessions', value:stats.totalSessions, icon:'📋', color:'#FACC15' },
                { label:'Alerts', value:stats.totalAlerts, icon:'⚠️', color:'#F87171' },
              ].map((kpi) => (
                <div key={kpi.label} style={{ background:'#102E4D', border:'1px solid #2D4A70', borderRadius:'0.9rem', padding:'0.85rem 1rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ color:'#94A3B8', fontSize:'0.78rem', fontWeight:700 }}>{kpi.label}</span>
                    <span>{kpi.icon}</span>
                  </div>
                  <p style={{ marginTop:'0.35rem', fontSize:'1.5rem', fontWeight:900, color:kpi.color }}>{kpi.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          {!loading && (
            <div style={{ marginBottom:'1rem', display:'grid', gap:'0.75rem', gridTemplateColumns:'2fr 1fr auto', alignItems:'center' }}>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by camp name, code, or location"
                style={{
                  width:'100%', border:'1px solid #2D4A70', background:'#102E4D', color:'white',
                  borderRadius:'0.75rem', padding:'0.65rem 0.85rem', outline:'none',
                }}
              />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width:'100%', border:'1px solid #2D4A70', background:'#102E4D', color:'white',
                  borderRadius:'0.75rem', padding:'0.65rem 0.85rem', outline:'none',
                }}
              >
                <option value="alertsDesc">Sort: Alerts (high to low)</option>
                <option value="sessionsDesc">Sort: Sessions (high to low)</option>
                <option value="childrenDesc">Sort: Children (high to low)</option>
                <option value="nameAsc">Sort: Name (A-Z)</option>
              </select>

              <button
                onClick={() => loadCamps(true)}
                disabled={refreshing}
                style={{
                  border:'1px solid #0D9488', background: refreshing ? '#115E59' : '#0D9488', color:'white',
                  borderRadius:'0.75rem', padding:'0.65rem 0.95rem', fontWeight:800, cursor:'pointer',
                }}
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          )}

          {/* Status quick filters */}
          {!loading && (
            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1rem' }}>
              {[
                { key:'all', label:'All' },
                { key:'urgent', label:'Urgent' },
                { key:'watch', label:'Watch' },
                { key:'clear', label:'Clear' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  style={{
                    border:'1px solid #2D4A70',
                    background: statusFilter === f.key ? '#0D9488' : '#102E4D',
                    color:'white',
                    borderRadius:'9999px',
                    padding:'0.35rem 0.8rem',
                    fontWeight:700,
                    fontSize:'0.82rem',
                    cursor:'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ background:'#1E3A5F', borderRadius:'1rem', height:220, animation:'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : filteredCamps.length === 0 ? (
            <div style={{ background:'#1E3A5F', borderRadius:'1.25rem', padding:'3rem', textAlign:'center' }}>
              <p style={{ fontSize:'3rem' }}>🏕️</p>
              <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'1.4rem', fontWeight:800, marginTop:'0.75rem' }}>No camps match the current filters</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
              {filteredCamps.map(camp => <Campoverview key={camp.id} camp={camp} darkMode />)}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
