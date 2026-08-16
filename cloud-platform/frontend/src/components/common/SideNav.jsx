'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Bell, GraduationCap, Droplets, Activity,
  Package, HeartHandshake, ChevronsLeft, ChevronsRight, Menu, X,
} from 'lucide-react'
import { C } from './theme'

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
  { label: 'All Camps', path: '/',          icon: LayoutDashboard },
  { label: 'Alerts',    path: '/alert',     icon: Bell },
  { label: 'Education', path: '/education', icon: GraduationCap },
  { label: 'Disaster',  path: '/disaster',  icon: Droplets },
  { label: 'Network',   path: '/network',   icon: Activity },
  { label: 'Resources', path: '/resources', icon: Package },
  { label: 'Welfare',   path: '/welfare',   icon: HeartHandshake },
]

export default function SideNav() {
  const { collapsed, toggle, isMobile, mobileOpen, openMobile, closeMobile } = useSideNav()
  const pathname = usePathname()

  const isActive = (path) => {
    if (path === '/disaster') return pathname?.startsWith('/disaster')
    if (path === '/') return pathname === '/' || pathname === '/camps'
    return pathname === path
  }

  const railWidth = isMobile ? RAIL_EXPANDED : (collapsed ? RAIL_COLLAPSED : RAIL_EXPANDED)
  const drawerOpen = isMobile ? mobileOpen : true

  return (
    <>
      {/* Mobile hamburger — only on small screens when the drawer is closed */}
      {isMobile && !mobileOpen && (
        <button
          onClick={openMobile}
          aria-label="Open navigation"
          style={{
            position: 'fixed', top: 12, left: 12, zIndex: 600,
            width: 40, height: 40, borderRadius: '0.6rem',
            background: C.navyDeep, border: `1px solid ${C.border}`,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
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
            background: 'rgba(2, 10, 20, 0.55)', backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: railWidth,
        background: C.navyDeep,
        borderRight: `1px solid ${C.border}`,
        zIndex: 400,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'width 0.2s ease, transform 0.25s ease',
        boxShadow: isMobile && mobileOpen ? '0 24px 60px rgba(0,0,0,0.5)' : 'none',
      }}>
        {/* Brand */}
        <div style={{
          height: 60, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : (collapsed ? 'center' : 'flex-start'),
          gap: 10, padding: isMobile ? '0 14px' : (collapsed ? 0 : '0 14px'),
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '0.6rem',
              background: C.teal, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '1rem', flexShrink: 0,
            }}>
              P
            </div>
            {(!collapsed || isMobile) && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.1, whiteSpace: 'nowrap' }}>PAGES</div>
                <div style={{ fontSize: '0.6rem', color: C.muted, letterSpacing: '0.14em', fontWeight: 700, whiteSpace: 'nowrap' }}>SMART CAMP CLOUD</div>
              </div>
            )}
          </div>
          {isMobile && (
            <button onClick={closeMobile} aria-label="Close navigation" style={{
              background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4,
            }}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {(!collapsed || isMobile) && (
            <p style={{
              fontSize: '0.62rem', fontWeight: 800, color: C.muted,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '6px 10px 4px', whiteSpace: 'nowrap',
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
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 12,
                  justifyContent: showLabel ? 'flex-start' : 'center',
                  padding: showLabel ? '10px 12px' : '10px 0',
                  borderRadius: '0.6rem',
                  background: active ? C.navyCard : 'transparent',
                  color: active ? '#fff' : C.muted,
                  fontWeight: active ? 700 : 600,
                  fontSize: '0.88rem',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.8}
                  color={active ? C.teal : C.muted}
                  style={{ flexShrink: 0 }}
                />
                {showLabel && (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Collapse / expand toggle (desktop only) */}
        {!isMobile && (
          <div style={{ borderTop: `1px solid ${C.border}`, padding: 8, flexShrink: 0 }}>
            <button
              onClick={toggle}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 12,
                padding: collapsed ? '10px 0' : '10px 12px',
                background: 'transparent', border: 'none', borderRadius: '0.6rem',
                color: C.muted, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {collapsed
                ? <ChevronsRight size={18} />
                : <><ChevronsLeft size={18} /><span>Collapse</span></>}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

export { DEFAULT_RAIL_WIDTH }