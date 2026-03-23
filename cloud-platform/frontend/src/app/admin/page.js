'use client'

// ─────────────────────────────────────────────────────────────────────────────
// app/admin/page.jsx — PAGES Admin: All Camps Overview
// Dark navy bg #0A2540 · Cognito-guarded (middleware)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CampOverview from '@/components/psychoedu/dashboard/CampOverview'

export default function AdminPage() {
  const router     = useRouter()
  const [camps, setCamps]     = useState([])
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('Admin')

  useEffect(() => {
    fetch('/api/admin/camps')
      .then(r => r.ok ? r.json() : [])
      .then(setCamps)
      .catch(() => setCamps([]))
      .finally(() => setLoading(false))

    // Stub Cognito name — replace with actual Amplify call
    setAdminName('Dr. Perera')
  }, [])

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
            { label:'Alerts',    path:'/admin/alerts', active: false },
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
              {loading ? 'Loading…' : `${camps.length} camp${camps.length !== 1 ? 's' : ''} registered`}
            </p>
          </div>

          {loading ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ background:'#1E3A5F', borderRadius:'1rem', height:220, animation:'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : camps.length === 0 ? (
            <div style={{ background:'#1E3A5F', borderRadius:'1.25rem', padding:'3rem', textAlign:'center' }}>
              <p style={{ fontSize:'3rem' }}>🏕️</p>
              <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'1.4rem', fontWeight:800, marginTop:'0.75rem' }}>No camps registered</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
              {camps.map(camp => <CampOverview key={camp.id} camp={camp} darkMode />)}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
