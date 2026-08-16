'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { DARK, LIGHT } from './theme'

const STORAGE_KEY = 'smartcamp.theme'

const ThemeContext = createContext({ mode: 'dark', T: DARK, toggle: () => {} })

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('dark')

  // Restore the saved theme after mount (avoids hydration mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === 'light' || saved === 'dark') setMode(saved)
    } catch {}
  }, [])

  const apply = useCallback((next) => {
    document.documentElement.setAttribute('data-theme', next)
    const bg = next === 'dark' ? DARK.bg : LIGHT.bg
    document.documentElement.style.backgroundColor = bg
    document.body.style.backgroundColor = bg
  }, [])

  useEffect(() => {
    apply(mode)
  }, [mode, apply])

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark'
      try { window.localStorage.setItem(STORAGE_KEY, next) } catch {}
      apply(next)
      return next
    })
  }, [apply])

  return (
    <ThemeContext.Provider value={{ mode, T: mode === 'dark' ? DARK : LIGHT, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}