'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Bell, ChartNoAxesColumn, Droplets, Activity,
  Package, HeartHandshake, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { C } from './theme'

export const RAIL_EXPANDED = 236
export const RAIL_COLLAPSED = 68

const STORAGE_KEY = 'smartcamp.rail'
const DEFAULT_RAIL_WIDTH = `${RAIL_EXPANDED}px`

const SideNavContext = createContext({ collapsed: false, toggle: () => {} })

export function SideNavProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false)

  // Restore the saved collapse state after mount (avoids hydration mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved !== null) setCollapsed(saved === '1')
    } catch {}
  }, [])

  // Publish the rail width as a CSS variable + persist the choice.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--rail-width',
      collapsed ? `${RAIL_COLLAPSED}px` : `${RAIL_EXPANDED}px`,
    )
    try { window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  const toggle = useCallback(() => setCollapsed((value) => !value), [])

  return (
    <SideNavContext.Provider value={{ collapsed, toggle }}>
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
  { label: 'Analytics', path: '/analytics', icon: ChartNoAxesColumn },
  { label: 'Disaster',  path: '/disaster',  icon: Droplets },
  { label: 'Network',   path: '/network',   icon: Activity },
  { label: 'Resources', path: '/resources', icon: Package },
  { label: 'Welfare',   path: '/welfare',   icon: HeartHandshake },
]

export default function SideNav() {
  const { collapsed, toggle } = useSideNav()
  const pathname = usePathname()

  const isActive = (path) => {
    if (path === '/disaster') return pathname?.startsWith('/disaster')
    if (path === '/') return pathname === '/' || pathname === '/camps'
    return pathname === path
  }

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: collapsed ? RAIL_COLLAPSED : RAIL_EXPANDED,
      background: C.navyDeep,
      borderRight: `1px solid ${C.border}`,
      zIndex: 400,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 0.2s ease',
    }}>
      {/* Brand */}
      <div style={{
        height: 60, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10, padding: collapsed ? 0 : '0 14px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '0.6rem',
          background: C.teal, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: '1rem', flexShrink: 0,
        }}>
          P
        </div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.1, whiteSpace: 'nowrap' }}>PAGES</div>
            <div style={{ fontSize: '0.6rem', color: C.muted, letterSpacing: '0.14em', fontWeight: 700, whiteSpace: 'nowrap' }}>SMART CAMP CLOUD</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {!collapsed && (
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
          return (
            <Link
              key={path}
              href={path}
              title={collapsed ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: 12,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '10px 0' : '10px 12px',
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
              {!collapsed && (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Collapse / expand toggle */}
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
    </aside>
  )
}

export { DEFAULT_RAIL_WIDTH }
