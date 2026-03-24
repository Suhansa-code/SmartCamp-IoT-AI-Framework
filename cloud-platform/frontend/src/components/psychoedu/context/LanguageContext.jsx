'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY  = 'pages_lang'
const VALID_LANGS  = ['si', 'ta', 'en']
const DEFAULT_LANG = 'si'

const LanguageContext = createContext({
  lang:    DEFAULT_LANG,
  setLang: () => {},
})

export function LanguageProvider({ children }) {
  const [lang,  setLangState] = useState(DEFAULT_LANG)
  const [ready, setReady]     = useState(false)

  // Hydrate from localStorage + URL param (client only)
  useEffect(() => {
    const urlParam = new URLSearchParams(window.location.search).get('lang')
    const stored   = localStorage.getItem(STORAGE_KEY)
    const resolved = VALID_LANGS.includes(urlParam)
      ? urlParam
      : VALID_LANGS.includes(stored)
        ? stored
        : DEFAULT_LANG
    setLangState(resolved)
    setReady(true)
  }, [])

  function setLang(code) {
    if (!VALID_LANGS.includes(code)) return
    setLangState(code)
    try { localStorage.setItem(STORAGE_KEY, code) } catch { /* private mode */ }
  }

  // Don't render until hydrated — avoids flash of wrong language
  if (!ready) return null

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

/** Hook — call inside any child component */
export function useLang() {
  return useContext(LanguageContext)
}
