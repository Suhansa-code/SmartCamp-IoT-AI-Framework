'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, TriangleAlert } from 'lucide-react'
import { P } from '@/components/alert/alertPalette'
import SearchBar from '@/components/common/SearchBar'
import Button from '@/components/common/Button'

// Shared app header — logo · search · alert icons · profile avatar.
// Mirrors the alert page header exactly; no border (sits directly on the page background).
// Props:
//   search          { value, onChange, placeholder, onRefresh, refreshing } — omit to hide the search bar
//   pendingCount    number   — bell badge (hidden when omitted or 0)
//   escalatedCount  number   — escalated badge (hidden when omitted or 0)
//   onBellClick     fn       — default: navigate to /alert
//   onEscalatedClick fn      — default: navigate to /alert

// Shared header wrapper — standardizes the header offset so it never shifts
// between pages (verified: top 26px, left 262px, full width).
export const HEADER_PADDING = 'clamp(1rem, 2vw, 1.75rem) clamp(1rem, 2vw, 1.75rem) 0'

export function HeaderShell({ children, style }) {
  return (
    <div style={{ width: '100%', padding: HEADER_PADDING, ...style }}>
      {children}
    </div>
  )
}

export default function PageHeader({
  search,
  pendingCount,
  escalatedCount,
  onBellClick,
  onEscalatedClick,
}) {
  const router = useRouter()
  const goToAlerts = () => router.push('/alert')

  return (
    <>
      <style>{`
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .smartcamp-page-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
      `}</style>

      <div className="smartcamp-page-header">
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '0.7rem',
              background: P.dark,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <TriangleAlert size={18} />
          </div>
          <span style={{ fontSize: '1.02rem', fontWeight: 800, color: P.ink }}>smartcamp.</span>
        </Link>

        {search && <SearchBar {...search} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Button
            variant="circleOutline"
            size={40}
            onClick={onBellClick || goToAlerts}
            aria-label="Alerts"
          >
            <Bell size={17} />
            {typeof pendingCount === 'number' && pendingCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: P.amber,
                  color: '#fff',
                  borderRadius: '9999px',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                }}
              >
                {pendingCount}
              </span>
            )}
          </Button>

          <Button
            variant="circleOutline"
            size={40}
            onClick={onEscalatedClick || goToAlerts}
            aria-label="Escalated alerts"
          >
            <TriangleAlert size={17} />
            {typeof escalatedCount === 'number' && escalatedCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: P.purple,
                  color: '#fff',
                  borderRadius: '9999px',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                }}
              >
                {escalatedCount}
              </span>
            )}
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.3rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: P.ink }}>Dr. Perera</span>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #14B8A6, #0D9488)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                }}
              >
                DP
              </div>
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: P.lime,
                  border: '2px solid #fff',
                  boxShadow: `0 0 6px ${P.lime}`,
                  animation: 'floatY 3s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}