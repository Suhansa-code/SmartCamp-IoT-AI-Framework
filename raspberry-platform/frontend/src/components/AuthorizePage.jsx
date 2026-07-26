import { useState, useRef } from 'react'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/AuthContext'

export default function AuthorizePage() {
  const { navigate } = useRouter()
  const { isAuthenticated, login, logout } = useAuth()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const inputRefs = useRef([])

  const handleChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[idx] = val
    setDigits(next)
    setError('')
    if (val && idx < 5) {
      inputRefs.current[idx + 1]?.focus()
    }
  }

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length !== 6) {
      setError('Enter all 6 digits')
      return
    }
    if (login(code)) {
      navigate('/registration')
    } else {
      setError('Invalid code')
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">&#x1F510;</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Already Authorized</h2>
          <p className="text-gray-500 text-sm mb-6">Session active until auto-expiry</p>
          <button
            onClick={() => { logout(); navigate('/authorize') }}
            className="w-full py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition"
          >
            Deauthorize
          </button>
          <button
            onClick={() => navigate('/registration')}
            className="w-full py-3 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition mt-2"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">&#x1F512;</div>
          <h2 className="text-xl font-bold text-gray-900">Staff Authorization</h2>
          <p className="text-gray-500 text-sm mt-1">Enter your 6-digit access code</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-2 justify-center mb-6">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none transition
                  ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-blue-500'}
                `}
              />
            ))}
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center mb-4">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition shadow-lg"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  )
}
