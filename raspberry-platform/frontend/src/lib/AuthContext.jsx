import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AUTH_KEY = 'scamp_auth'
const HARDCODED_CODE = '123456'
const EXPIRY_HOURS = 4

function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(AUTH_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(getStoredAuth)

  useEffect(() => {
    const check = setInterval(() => {
      const stored = getStoredAuth()
      if (!stored && auth) setAuth(null)
      if (stored && !auth) setAuth(stored)
    }, 30000)
    return () => clearInterval(check)
  }, [auth])

  const login = useCallback((code) => {
    if (code !== HARDCODED_CODE) return false
    const raw = JSON.stringify({ code, loggedInAt: Date.now() })
    const token = btoa(raw)
    const expiresAt = Date.now() + EXPIRY_HOURS * 60 * 60 * 1000
    const data = { token, expiresAt }
    localStorage.setItem(AUTH_KEY, JSON.stringify(data))
    setAuth(data)
    return true
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY)
    setAuth(null)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!auth, login, logout, token: auth?.token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
