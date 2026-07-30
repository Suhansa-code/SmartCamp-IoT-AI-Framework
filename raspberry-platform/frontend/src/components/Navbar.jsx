import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useRouter } from '../lib/router'
import { useAuth } from '../lib/AuthContext'
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
} from 'lucide-react'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { id: 'registration', label: 'Registration', path: '/registration', icon: Fingerprint },
  { id: 'wristband', label: 'Distribution', path: '/wristband', icon: ScanBarcode },
  { id: 'prediction', label: 'AI Predictions', path: '/prediction', icon: BrainCircuit },
  { id: 'network', label: 'Network', path: '/network', icon: Activity },
  { id: 'disaster', label: 'Disaster', path: '/disaster', icon: Map },
]

function NavLink({ tab, active }) {
  const Icon = tab.icon
  return (
    <Link
      to={tab.path}
      aria-label={`Navigate to ${tab.label}`}
      className={`relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg outline-none transition-all duration-200
        ${active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 bg-blue-50 rounded-lg"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <Icon className="w-4 h-4 relative z-10" />
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
        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none
          ${active
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-500 hover:text-slate-800'
          }`}
      >
        <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
        {tab.label}
      </Link>
    </motion.div>
  )
}

const itemVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0 },
}

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
    <header className="sticky top-0 z-50 w-full">
      <nav
        className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 shadow-[0_1px_4px_0_rgba(0,0,0,0.04)]"
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
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
                <span className="text-white text-xs font-black tracking-tight">SC</span>
              </div>
              <span className="text-sm font-semibold text-slate-800 tracking-tight">SmartCamp</span>
            </motion.div>

            <div className="hidden lg:flex items-center gap-0.5">
              {tabs.map((tab) => (
                <NavLink key={tab.id} tab={tab} active={path === tab.path} />
              ))}

              <div className="w-px h-5 mx-2 bg-slate-200" />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                {isAuthenticated ? (
                  <button
                    onClick={() => { logout(); navigate('/authorize') }}
                    aria-label="Deauthorize session"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg outline-none transition-all duration-200
                      text-emerald-600 hover:text-emerald-700"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Authorized</span>
                  </button>
                ) : (
                  <Link
                    to="/authorize"
                    aria-label="Authorize access"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg outline-none transition-all duration-200
                      text-slate-400 hover:text-slate-600"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Authorize</span>
                  </Link>
                )}
              </motion.div>
            </div>

            <button
              onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-4 h-4 text-slate-400" /> : <Menu className="w-4 h-4 text-slate-400" />}
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
              className="fixed top-0 right-0 bottom-0 w-64 max-w-[85vw] bg-white z-50 lg:hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="flex flex-col h-full p-5 pt-20">
                <div className="space-y-0.5">
                  {tabs.map((tab) => (
                    <MobileNavLink
                      key={tab.id}
                      tab={tab}
                      active={path === tab.path}
                      onClick={() => setMobileOpen(false)}
                    />
                  ))}
                </div>

                <div className="mt-auto pt-5 border-t border-slate-100">
                  <motion.div variants={itemVariants}>
                    {isAuthenticated ? (
                      <button
                        onClick={() => { logout(); navigate('/authorize'); setMobileOpen(false) }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                          text-emerald-600 hover:text-emerald-700"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Authorized Session</span>
                      </button>
                    ) : (
                      <Link
                        to="/authorize"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                          text-slate-400 hover:text-slate-600"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Authorize Access</span>
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
