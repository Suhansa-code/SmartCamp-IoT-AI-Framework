import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useRouter } from '../lib/router'
import { useAuth } from '../lib/AuthContext'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'registration', label: 'Registration', path: '/registration' },
  { id: 'wristband', label: 'Wristband', path: '/wristband' },
  { id: 'prediction', label: 'AI Predictions', path: '/prediction' },
  { id: 'network', label: 'Network QoS', path: '/network' },
  { id: 'disaster', label: 'Disaster', path: '/disaster' },
]

function NavLink({ tab, active, onNav }) {
  return (
    <Link
      to={tab.path}
      aria-label={`Navigate to ${tab.label}`}
      className={`relative px-3.5 py-2 text-sm font-medium rounded-xl transition-all duration-200 outline-none
        ${active
          ? 'text-white'
          : 'text-gray-400 hover:text-gray-100'
        }`}
      onMouseEnter={e => e.currentTarget.focus()}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/25"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      {!active && (
        <motion.span
          className="absolute inset-0 rounded-xl bg-white/5 opacity-0"
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
      <span className="relative z-10">{tab.label}</span>
    </Link>
  )
}

function MobileNavLink({ tab, active, onClick }) {
  return (
    <motion.div variants={itemVariants}>
      <Link
        to={tab.path}
        onClick={onClick}
        aria-label={`Navigate to ${tab.label}`}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 outline-none
          ${active
            ? 'bg-gradient-to-r from-blue-600/20 to-indigo-500/20 text-white border border-blue-500/20'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-blue-400' : 'bg-gray-600'}`} />
        {tab.label}
        {active && (
          <span className="ml-auto text-[10px] font-bold text-blue-400 tracking-wider">ACTIVE</span>
        )}
      </Link>
    </motion.div>
  )
}

const itemVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
}

function MenuIcon({ open }) {
  return (
    <div className="w-5 h-5 relative flex flex-col justify-center gap-[5px]">
      <motion.span
        animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
        className="block h-[2px] w-full bg-gray-400 rounded-full origin-center"
        transition={{ duration: 0.25 }}
      />
      <motion.span
        animate={open ? { opacity: 0, x: 6 } : { opacity: 1, x: 0 }}
        className="block h-[2px] w-full bg-gray-400 rounded-full"
        transition={{ duration: 0.2 }}
      />
      <motion.span
        animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
        className="block h-[2px] w-full bg-gray-400 rounded-full origin-center"
        transition={{ duration: 0.25 }}
      />
    </div>
  )
}

export default function Navbar() {
  const { path, navigate } = useRouter()
  const { isAuthenticated } = useAuth()
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
        className="bg-gray-900/70 backdrop-blur-xl border-b border-white/5 shadow-xl shadow-black/10"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex items-center gap-2.5"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-white text-sm font-black">SC</span>
              </div>
              <span className="text-base font-bold text-white tracking-tight">SmartCamp</span>
            </motion.div>

            <div className="hidden lg:flex items-center gap-1">
              {tabs.map((tab) => (
                <NavLink key={tab.id} tab={tab} active={path === tab.path} />
              ))}

              <div className="w-px h-6 mx-2 bg-white/10" />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <Link
                  to="/authorize"
                  aria-label={isAuthenticated ? 'Deauthorize' : 'Authorize'}
                  className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl transition-all duration-200 outline-none
                    ${isAuthenticated
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-gray-200'
                    }`}
                >
                  <motion.span
                    animate={isAuthenticated ? { rotate: [0, -10, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className="text-sm"
                  >
                    {isAuthenticated ? '\u{1F510}' : '\u{1F512}'}
                  </motion.span>
                  <span>{isAuthenticated ? 'Authorized' : 'Authorize'}</span>
                </Link>
              </motion.div>
            </div>

            <button
              onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              <MenuIcon open={mobileOpen} />
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
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              aria-hidden="true"
            />
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-gray-900/95 backdrop-blur-2xl border-l border-white/5 z-50 lg:hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="flex flex-col h-full p-6 pt-20">
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

                <div className="mt-auto pt-6 border-t border-white/5">
                  <motion.div variants={itemVariants}>
                    <Link
                      to="/authorize"
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                        ${isAuthenticated
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'
                        }`}
                    >
                      <span className="text-base">{isAuthenticated ? '\u{1F510}' : '\u{1F512}'}</span>
                      <span>{isAuthenticated ? 'Authorized Session' : 'Authorize Access'}</span>
                    </Link>
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
