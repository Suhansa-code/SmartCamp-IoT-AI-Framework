import { useState, useRef } from 'react'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/AuthContext'
import Button from './ui/base/Button'
import { COLORS } from '../lib/tokens'

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
    } else if (!val && digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  const handleKeyDown = (idx, e) => {
    if (e.key !== 'Backspace') return
    if (e.currentTarget.value !== '') return
    if (idx === 0) return
    e.preventDefault()
    const next = [...digits]
    next[idx - 1] = ''
    setDigits(next)
    inputRefs.current[idx - 1]?.focus()
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
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: COLORS.grid }}>
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">&#x1F510;</span>
          </div>
          <h2 className="text-lg font-medium mb-1" style={{ color: COLORS.ink }}>Already Authorized</h2>
          <p className="text-sm mb-6" style={{ color: COLORS.muted }}>Session active until auto-expiry</p>
          <Button
            variant="danger"
            onClick={() => { logout(); navigate('/authorize') }}
            className="w-full"
          >
            Deauthorize
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/registration')}
            className="w-full mt-2"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: COLORS.grid }}>
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">&#x1F512;</span>
          </div>
          <h2 className="text-lg font-medium" style={{ color: COLORS.ink }}>Staff Authorization</h2>
          <p className="text-sm mt-1" style={{ color: COLORS.muted }}>Enter your 6-digit access code</p>
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
                className={`w-11 h-13 text-center text-xl font-bold rounded-lg border outline-none transition
                  ${error ? 'border-red-400 bg-red-50' : 'focus:border-blue-500'}
                `}
                style={{ borderColor: error ? undefined : COLORS.subtle }}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-center mb-4" style={{ color: COLORS.danger }}>{error}</p>
          )}

          <Button type="submit" className="w-full">
            Authenticate
          </Button>
        </form>
      </div>
    </div>
  )
}
