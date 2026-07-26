import React from 'react'
import { Link, useRouter } from '../lib/router'
import { useAuth } from '../lib/AuthContext'

const tabs = [
  { id: 'registration', label: 'Registration', path: '/registration' },
  { id: 'wristband', label: 'Wristband Distribution', path: '/wristband' },
  { id: 'prediction', label: 'AI Predictions', path: '/prediction' },
  { id: 'network', label: 'Network QoS', path: '/network' },
]

function Navbar() {
  const { path } = useRouter()
  const { isAuthenticated } = useAuth()

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900">SmartCamp</span>
          </div>

          <div className="flex items-center gap-3">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                to={tab.path}
                className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200
                  ${path === tab.path
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {tab.label}
              </Link>
            ))}

            <div className="w-px h-8 bg-gray-300" />

            <Link
              to="/authorize"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold transition-all duration-200 border-2
                ${isAuthenticated
                  ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100'
                  : 'border-red-300 text-red-600 bg-red-50 hover:bg-red-100'
                }`}
            >
              <span className="text-lg">{isAuthenticated ? '\u{1F510}' : '\u{1F512}'}</span>
              <span className="text-sm">{isAuthenticated ? 'Authorized' : 'Authorize'}</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
