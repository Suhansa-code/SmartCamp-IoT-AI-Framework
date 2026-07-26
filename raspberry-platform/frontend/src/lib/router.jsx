import { useState, useEffect, useCallback, createContext, useContext } from 'react'

const RouterContext = createContext()

function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return null
  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i])
    } else if (patternParts[i] !== pathParts[i]) {
      return null
    }
  }
  return params
}

export function RouterProvider({ children }) {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to)
    setPath(to)
  }, [])

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter() {
  return useContext(RouterContext)
}

export function Link({ to, children, className, style }) {
  const { navigate } = useRouter()
  return (
    <button
      onClick={() => navigate(to)}
      className={className}
      style={style}
    >
      {children}
    </button>
  )
}

export function Routes({ children }) {
  const { path } = useRouter()
  for (const child of children) {
    const { path: pattern, element, redirect } = child.props
    if (redirect && (path === pattern || pattern === '*')) {
      const matched = pattern !== '*' ? matchPath(pattern, path) : {}
      if (matched !== null) return element
    }
    if (pattern === '*') continue
    const params = matchPath(pattern, path)
    if (params !== null) {
      return element
    }
  }
  return null
}

export function Route({ path, element, redirect }) {
  return null
}
