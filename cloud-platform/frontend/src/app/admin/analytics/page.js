// Admin analytics — score trends and session data
// Renders ScoreChart components for each camp
// Calls /api/admin/analytics

'use client'

import { useState, useEffect } from 'react'
import ScoreChart from '@/components/psychoedu/dashboard/ScoreChart'

export default function AnalyticsPage() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: '#F0F9FF' }}>
      <div className="max-w-7xl mx-auto">
        <h1
          className="text-3xl font-extrabold mb-2"
          style={{ fontFamily: "'Baloo 2', cursive", color: '#1E3A5F' }}
        >
          📊 Analytics · Score Trends
        </h1>
        <p className="font-semibold mb-8" style={{ color: '#0D9488' }}>
          ලකුණු ප්‍රවණතා සහ සැසි දත්ත
        </p>

        {loading ? (
          <div className="text-center py-20">
            <div
              className="w-12 h-12 rounded-full border-4 border-t-transparent mx-auto animate-spin"
              style={{ borderColor: '#0D9488', borderTopColor: 'transparent' }}
            />
          </div>
        ) : data ? (
          <div className="flex flex-col gap-8">
            {data.camps?.map(camp => (
              <div key={camp.id} className="card-soft">
                <h2
                  className="text-xl font-bold mb-4"
                  style={{ fontFamily: "'Baloo 2', cursive", color: '#1E3A5F' }}
                >
                  🏕️ {camp.name}
                </h2>
                <ScoreChart data={camp.scores} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card-soft text-center py-12">
            <p className="text-xl font-bold" style={{ color: '#1E3A5F' }}>
              No data available · දත්ත නොමැත
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
