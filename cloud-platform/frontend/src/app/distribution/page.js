'use client'

import SideNav from '@/components/common/SideNav'
import PageHeader from '@/components/common/PageHeader'
import DistributionPanel from '@/components/distribution/DistributionPanel'
import { useTheme } from '@/components/common/ThemeProvider'

export default function DistributionPage() {
  const { T } = useTheme()

  return (
    <div style={{ minHeight: '100vh', paddingLeft: 'var(--rail-width, 236px)', transition: 'padding-left 0.2s ease' }}>
      <SideNav />

      <main style={{ background: T.panel, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <PageHeader
          title="Distribution Operations"
          subtitle="Live distribution records from the Cloud Database"
        />

        <div style={{ padding: '0 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <DistributionPanel />
        </div>
      </main>
    </div>
  )
}
