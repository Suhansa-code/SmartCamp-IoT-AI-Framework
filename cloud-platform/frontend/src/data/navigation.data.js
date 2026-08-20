// Navigation rail constants + main nav items for the sidebar.
import { LayoutDashboard, Bell, GraduationCap, Droplets, Activity, Package } from 'lucide-react'

export const RAIL_EXPANDED = 236
export const RAIL_COLLAPSED = 68

export const STORAGE_KEY = 'smartcamp.rail'
export const MOBILE_BREAKPOINT = 768
export const DEFAULT_RAIL_WIDTH = `${RAIL_EXPANDED}px`

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/',          icon: LayoutDashboard },
  { label: 'Alerts',    path: '/alert',     icon: Bell },
  { label: 'Education', path: '/education', icon: GraduationCap },
  { label: 'Disaster',  path: '/disaster',  icon: Droplets },
  { label: 'Network',   path: '/network',   icon: Activity },
  { label: 'Resources', path: '/resources', icon: Package },
]