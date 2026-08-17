'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Bell, GraduationCap, Droplets, Activity,
  Package, ChevronsLeft, ChevronsRight, Menu, X, Sun, Moon, TriangleAlert,
} from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { P } from '@/components/alert/alertPalette'

export const RAIL_EXPANDED = 236
export const RAIL_COLLAPSED = 68

const STORAGE_KEY = 'smartcamp.rail'
const MOBILE_BREAKPOINT = 768
const DEFAULT_RAIL_WIDTH = `${RAIL_EXPANDED}px`

const SideNavContext = createContext({ collapsed: false, toggle: () => {}, isMobile: false, mobileOpen: false, openMobile: () => {} })

export function SideNavProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Detect small screens (off-canvas drawer instead of a fixed rail).
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Restore the saved collapse state after mount (avoids hydration mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved !== null) setCollapsed(saved === '1')
    } catch {}
  }, [])

  // Publish the rail width as a CSS variable + persist the choice.
  useEffect(() => {
    const width = isMobile ? '0px' : (collapsed ? `${RAIL_COLLAPSED}px` : `${RAIL_EXPANDED}px`)
    document.documentElement.style.setProperty('--rail-width', width)
    try { window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0') } catch {}
  }, [collapsed, isMobile])

  // Close the drawer when resizing back to desktop.
  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  const toggle = useCallback(() => setCollapsed((value) => !value), [])
  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <SideNavContext.Provider value={{ collapsed, toggle, isMobile, mobileOpen, openMobile, closeMobile }}>
      {children}
    </SideNavContext.Provider>
  )
}

export function useSideNav() {
  return useContext(SideNavContext)
}

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/',          icon: LayoutDashboard },
  { label: 'Alerts',    path: '/alert',     icon: Bell },
  { label: 'Education', path: '/education', icon: GraduationCap },
  { label: 'Disaster',  path: '/disaster',  icon: Droplets },
  { label: 'Network',   path: '/network',   icon: Activity },
  { label: 'Resources', path: '/resources', icon: Package },
]

export default function SideNav() {
  const { collapsed, toggle, isMobile, mobileOpen, openMobile, closeMobile } = useSideNav()
  const { mode, toggle: toggleTheme } = useTheme()
  const pathname = usePathname()

  const isActive = (path) => {
    if (path === '/disaster') return pathname?.startsWith('/disaster')
    if (path === '/') return pathname === '/' || pathname === '/camps'
    return pathname === path
  }

  const railWidth = isMobile ? RAIL_EXPANDED : (collapsed ? RAIL_COLLAPSED : RAIL_EXPANDED)
  const drawerOpen = isMobile ? mobileOpen : true
  const centered = collapsed && !isMobile

  return (
    <>
      <style>{`
        @keyframes navPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .smartcamp-navlink { transition: background 0.15s ease, color 0.15s ease; }
        .smartcamp-navlink:hover { background: ${P.cardSoft}; }
        .smartcamp-navlink:hover span { color: ${P.ink}; }
      `}</style>

      {/* Mobile hamburger — only on small screens when the drawer is closed */}
      {isMobile && !mobileOpen && (
        <button
          onClick={openMobile}
          aria-label="Open navigation"
          style={{
            position: 'fixed', top: 12, left: 12, zIndex: 600,
            width: 42, height: 42, borderRadius: '0.8rem',
            background: P.card, border: `1px solid ${P.border}`,
            color: P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(15,23,42,0.14)',
            cursor: 'pointer',
          }}
        >
          <Menu size={20} />
        </button>
      )}

      {/* Backdrop when the mobile drawer is open */}
      {isMobile && mobileOpen && (
        <div
          onClick={closeMobile}
          aria-hidden="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 398,
            background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(3px)',
          }}
        />
      )}

      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: railWidth,
        background: P.card,
        borderRight: `1px solid ${P.border}`,
        zIndex: 400,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'width 0.2s ease, transform 0.25s ease',
        boxShadow: isMobile && mobileOpen ? '0 24px 60px rgba(15,23,42,0.35)' : '0 0 0 0 transparent',
      }}>
        {/* Brand */}
        <div style={{
          height: 60, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : (centered ? 'center' : 'flex-start'),
          gap: 10, padding: isMobile ? '0 14px' : (centered ? 0 : '0 16px'),
          borderBottom: `1px solid ${P.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '0.7rem', flexShrink: 0,
              background: P.dark, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TriangleAlert size={18} />
            </div>
            {(!collapsed || isMobile) && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '1.02rem', fontWeight: 800, color: P.ink, lineHeight: 1.1, whiteSpace: 'nowrap' }}>smartcamp.</div>
                <div style={{ fontSize: '0.6rem', color: P.muted, letterSpacing: '0.14em', fontWeight: 700, whiteSpace: 'nowrap' }}>SMART CAMP CLOUD</div>
              </div>
            )}
          </div>
          {isMobile && (
            <button onClick={closeMobile} aria-label="Close navigation" style={{
              background: P.cardSoft, border: `1px solid ${P.border}`, borderRadius: '0.7rem',
              color: P.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, padding: 0,
            }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {(!collapsed || isMobile) && (
            <p style={{
              fontSize: '0.62rem', fontWeight: 800, color: P.muted,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '6px 10px 6px', whiteSpace: 'nowrap',
            }}>
              Navigation
            </p>
          )}

          {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
            const active = isActive(path)
            const showLabel = !collapsed || isMobile
            return (
              <Link
                key={path}
                href={path}
                title={showLabel ? undefined : label}
                onClick={() => { if (isMobile) closeMobile() }}
                className="smartcamp-navlink"
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 12,
                  justifyContent: showLabel ? 'flex-start' : 'center',
                  padding: showLabel ? '10px 14px' : '10px 0',
                  borderRadius: '9999px',
                  background: active ? P.dark : 'transparent',
                  color: active ? '#fff' : P.muted,
                  fontWeight: active ? 700 : 600,
                  fontSize: '0.84rem',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: active ? '0 6px 16px rgba(15,23,42,0.18)' : 'none',
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.8}
                  color={active ? P.lime : P.muted}
                  style={{ flexShrink: 0 }}
                />
                {showLabel && (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: active ? '#fff' : P.muted, transition: 'color 0.15s ease' }}>{label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer: theme toggle · collapse (before profile) · profile */}
        <div style={{ borderTop: `1px solid ${P.border}`, padding: 10, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center',
              justifyContent: centered ? 'center' : 'flex-start',
              gap: 12,
              padding: centered ? '9px 0' : '9px 14px',
              background: 'transparent', border: 'none', borderRadius: '9999px',
              color: P.muted, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600,
              whiteSpace: 'nowrap', transition: 'background 0.15s, color 0.15s',
            }}
          >
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {(!collapsed || isMobile) && <span>{mode === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {/* Collapse / expand toggle (desktop only) — placed before profile */}
          {!isMobile && (
            <button
              onClick={toggle}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 12,
                padding: collapsed ? '9px 0' : '9px 14px',
                background: 'transparent', border: 'none', borderRadius: '9999px',
                color: P.muted, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600,
                whiteSpace: 'nowrap', transition: 'background 0.15s, color 0.15s',
              }}
            >
              {collapsed
                ? <ChevronsRight size={18} />
                : <><ChevronsLeft size={18} /><span>Collapse</span></>}
            </button>
          )}

          {/* Profile avatar */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: centered ? 'center' : 'flex-start',
            gap: 10, padding: centered ? '8px 0' : '8px 12px',
            borderRadius: '9999px',
            background: P.cardSoft, border: `1px solid ${P.border}`,
            marginTop: 4,
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, #14B8A6, #0D9488)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.78rem', boxShadow: '0 4px 12px rgba(13,148,136,0.35)',
              }}>
                DP
              </div>
              <span style={{
                position: 'absolute', bottom: 0, right: 0, width: 11, height: 11,
                borderRadius: '50%', background: P.lime,
                border: `2px solid ${P.cardSoft}`,
                boxShadow: `0 0 6px ${P.lime}`,
                animation: 'navPulse 2.4s ease-in-out infinite',
              }} />
            </div>
            {(!collapsed || isMobile) && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Dr. Perera</div>
                <div style={{ fontSize: '0.6rem', color: P.muted, letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Administrator</div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

export { DEFAULT_RAIL_WIDTH }