import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useRouter } from '../../../lib/router'
import { useAuth } from '../../../lib/AuthContext'
import {
  LayoutDashboard,
  Fingerprint,
  ScanBarcode,
  BrainCircuit,
  Activity,
  Map,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Radar,
  Layers,
  Cpu,
} from 'lucide-react'
import { COLORS, SHADOW_CARD } from '../../../lib/tokens'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { id: 'registration', label: 'Registration', path: '/registration', icon: Fingerprint },
  { id: 'wristband', label: 'Distribution', path: '/wristband', icon: ScanBarcode },
  { id: 'wristbands', label: 'Wristbands', path: '/wristbands', icon: Layers },
  { id: 'educationscreen', label: 'Education', path: '/educationscreen', icon: BrainCircuit },
  { id: 'network', label: 'Network', path: '/network', icon: Activity },
  { id: 'devices', label: 'Devices', path: '/devices', icon: Cpu },
  { id: 'disaster', label: 'Disaster', path: '/disaster', icon: Map },
]

const itemVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0 },
}

/* ------------------------------------------------------------------ */
/*  DESKTOP NAV LINK — bordered brand-tint pill, mirrors Chip/TabSwitch */
/* ------------------------------------------------------------------ */

function NavLink({ tab, active }) {
  const Icon = tab.icon
  return (
    <Link
      to={tab.path}
      aria-label={`Navigate to ${tab.label}`}
      className="relative flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-semibold rounded-lg outline-none transition-colors duration-200"
      style={{ color: active ? COLORS.brand : COLORS.muted }}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-lg"
          style={{ backgroundColor: `${COLORS.brand}12`, border: `1px solid ${COLORS.brand}33` }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <Icon className="w-3.5 h-3.5 relative z-10" strokeWidth={1.8} />
      <span className="relative z-10">{tab.label}</span>
    </Link>
  )
}

function MobileNavLink({ tab, active, onClick }) {
  const Icon = tab.icon
  return (
    <motion.div variants={itemVariants}>
      <Link
        to={tab.path}
        onClick={onClick}
        aria-label={`Navigate to ${tab.label}`}
        className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors duration-200 outline-none border"
        style={active
          ? { backgroundColor: `${COLORS.brand}0F`, color: COLORS.brand, borderColor: `${COLORS.brand}33` }
          : { backgroundColor: 'transparent', color: COLORS.body, borderColor: 'transparent' }}
      >
        <Icon className="w-4 h-4" style={{ color: active ? COLORS.brand : COLORS.muted }} strokeWidth={1.8} />
        {tab.label}
      </Link>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  NAVBAR                                                              */
/* ------------------------------------------------------------------ */

export default function Navbar() {
  const { path, navigate } = useRouter()
  const { isAuthenticated, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    setMobileOpen(false)
  }, [path])

  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mobileOpen])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <header className="sticky top-0 z-50 w-full font-sans">
      <nav
        className="bg-white/85 backdrop-blur-xl border-b"
        style={{ borderColor: COLORS.line }}
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex items-center gap-2.5"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: COLORS.brand }}>
                <Radar className="w-4 h-4 text-white" strokeWidth={1.8} />
              </div>
              <span className="font-serif font-medium text-[16px] tracking-tight" style={{ color: COLORS.ink }}>
                SmartCamp
              </span>
            </motion.div>

            <div className="hidden lg:flex items-center gap-0.5">
              {tabs.map((tab) => (
                <NavLink key={tab.id} tab={tab} active={path === tab.path} />
              ))}

              <div className="w-px h-5 mx-2" style={{ backgroundColor: COLORS.line }} />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                {isAuthenticated ? (
                  <button
                    onClick={() => { logout(); navigate('/authorize') }}
                    aria-label="Deauthorize session"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-lg border outline-none transition-colors duration-200"
                    style={{ color: COLORS.brand, backgroundColor: `${COLORS.brand}0F`, borderColor: `${COLORS.brand}33` }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.8} />
                    <span>Authorized</span>
                  </button>
                ) : (
                  <Link
                    to="/authorize"
                    aria-label="Authorize access"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-lg border outline-none transition-colors duration-200"
                    style={{ color: COLORS.muted, borderColor: COLORS.line }}
                  >
                    <LogOut className="w-3.5 h-3.5" strokeWidth={1.8} />
                    <span>Authorize</span>
                  </Link>
                )}
              </motion.div>
            </div>

            <button
              onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg border transition-colors"
              style={{ borderColor: COLORS.line, color: COLORS.body }}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-4 h-4" strokeWidth={1.8} /> : <Menu className="w-4 h-4" strokeWidth={1.8} />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              aria-hidden="true"
            />
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-white z-50 lg:hidden"
              style={{ boxShadow: '-24px 0 48px -12px rgba(15,23,20,0.18)' }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="flex flex-col h-full p-5 pt-6">
                <div className="flex items-center gap-2.5 px-1 pb-5 mb-5 border-b" style={{ borderColor: COLORS.hairline }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: COLORS.brand }}>
                    <Radar className="w-4 h-4 text-white" strokeWidth={1.8} />
                  </div>
                  <span className="font-serif font-medium text-[16px] tracking-tight" style={{ color: COLORS.ink }}>
                    SmartCamp
                  </span>
                </div>

                <div className="space-y-1">
                  {tabs.map((tab) => (
                    <MobileNavLink
                      key={tab.id}
                      tab={tab}
                      active={path === tab.path}
                      onClick={() => setMobileOpen(false)}
                    />
                  ))}
                </div>

                <div className="mt-auto pt-5 border-t" style={{ borderColor: COLORS.hairline }}>
                  <motion.div variants={itemVariants}>
                    {isAuthenticated ? (
                      <button
                        onClick={() => { logout(); navigate('/authorize'); setMobileOpen(false) }}
                        className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg text-[13px] font-semibold border transition-colors duration-200"
                        style={{ color: COLORS.brand, backgroundColor: `${COLORS.brand}0F`, borderColor: `${COLORS.brand}33` }}
                      >
                        <ShieldCheck className="w-4 h-4" strokeWidth={1.8} />
                        <span>Authorized session</span>
                      </button>
                    ) : (
                      <Link
                        to="/authorize"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg text-[13px] font-semibold border transition-colors duration-200"
                        style={{ color: COLORS.muted, borderColor: COLORS.line }}
                      >
                        <LogOut className="w-4 h-4" strokeWidth={1.8} />
                        <span>Authorize access</span>
                      </Link>
                    )}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}