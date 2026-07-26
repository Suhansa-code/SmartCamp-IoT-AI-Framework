import React from 'react'
import { Link, useRouter } from '../lib/router'
import { useAuth } from '../lib/AuthContext'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'registration', label: 'Registration', path: '/registration' },
  { id: 'wristband', label: 'Wristband Distribution', path: '/wristband' },
  { id: 'prediction', label: 'AI Predictions', path: '/prediction' },
  { id: 'network', label: 'Network QoS', path: '/network' },
]

function Navbar() {
  const { path } = useRouter()
  const { isAuthenticated } = useAuth()

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-gray-900 tracking-tight">SmartCamp</span>
          </div>

          <div className="flex items-center gap-1">
            {tabs.map((tab) => {
              const active = path === tab.path
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200
                    ${active
                      ? 'text-blue-700 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                    }`}
                >
                  {tab.label}
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </Link>
              )
            })}

            <div className="w-px h-5 mx-2 bg-gray-200" />

            <Link
              to="/authorize"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200
                ${isAuthenticated
                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
            >
              <span className="text-sm">{isAuthenticated ? '\u{1F510}' : '\u{1F512}'}</span>
              <span>{isAuthenticated ? 'Authorized' : 'Authorize'}</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
