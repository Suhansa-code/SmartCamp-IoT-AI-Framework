'use client'

import { usePathname } from 'next/navigation'
import { SideNavProvider } from '@/components/common/SideNav'
import { ThemeProvider } from '@/components/common/ThemeProvider'
import { NotificationsProvider } from '@/components/common/NotificationsContext'

export default function AppProviders({ children }) {
  const pathname = usePathname()
  // Public, chrome-free surfaces: the donation page and the relief portal's
  // public journey. The relief back-office (/relief/manage) keeps the console.
  if (pathname.startsWith('/donate')) return children
  if (pathname === '/relief' || pathname.startsWith('/relief/track') || pathname.startsWith('/relief/checkout')) return children

  return (
    <ThemeProvider>
      <NotificationsProvider>
        <SideNavProvider>{children}</SideNavProvider>
      </NotificationsProvider>
    </ThemeProvider>
  )
}
