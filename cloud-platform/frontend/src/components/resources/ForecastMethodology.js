'use client'

/**
 * Where every number on this page comes from — collapsed by default.
 *
 * This content used to sit permanently at the foot of the dashboard as a
 * ~120-word paragraph. It is the page's technical transparency and deleting it
 * would be a real loss: the alias list is curated rather than measured, the
 * food basis is raw-as-acquired rather than cooked, and reorder dates assume a
 * lead time. Someone auditing a date needs all three.
 *
 * But nobody deciding what to order this morning needs to read it, so it opens
 * on request instead of by default.
 *
 * Every value is read from the response's `provenance` block rather than
 * restated here, so this section cannot drift from what the API actually used.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'

function Entry({ T, term, children }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: T.textPrimary }}>
        {term}
      </p>
      <p style={{ margin: '0.15rem 0 0', fontSize: '0.76rem', color: T.muted, lineHeight: 1.6 }}>
        {children}
      </p>
    </div>
  )
}

export default function ForecastMethodology({ provenance = {}, population = {}, leadTimeDays }) {
  const { T } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <section style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: '0.9rem', overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.9rem 1.15rem', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', color: T.textPrimary,
          fontSize: '0.84rem', fontWeight: 700,
        }}
      >
        {open ? <ChevronDown size={15} style={{ color: T.muted }} /> : <ChevronRight size={15} style={{ color: T.muted }} />}
        Forecast methodology
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, color: T.dim }}>
          {open ? 'Hide' : 'View details'}
        </span>
      </button>

      {open && (
        <div style={{
          borderTop: `1px solid ${T.border}`, padding: '1.05rem 1.15rem',
          display: 'grid', gap: '0.9rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        }}>
          <Entry T={T} term="Population forecast">
            Projected from live check-in history using a robust trend method
            {population.method === 'theil_sen_with_band' ? ' (Theil-Sen)' : ''}, which resists
            one-off spikes in arrivals. The shaded range comes from how far recent days scattered
            around that trend, so a short history gives a wide range.
            {population.observations != null && population.trend_window != null
              ? ` Currently fitted on the last ${population.trend_window} of ${population.observations} days.`
              : null}
          </Entry>

          <Entry T={T} term="Food demand">{provenance.food_rates}</Entry>

          <Entry T={T} term="Water demand">{provenance.water_rates}</Entry>

          <Entry T={T} term="Commodity matching">
            Store names are standardised and matched against a curated commodity alias list before
            each item is given its share of the basket. That list decides which commodity a line
            refers to, never how much of it is consumed — every quantity still comes from a
            measured source
            {provenance.commodity_shares ? ` (${provenance.commodity_shares})` : ''}.
          </Entry>

          {provenance.basis_note && <Entry T={T} term="Demand basis">{provenance.basis_note}</Entry>}

          <Entry T={T} term="Reorder calculation">
            Order-by dates assume a {leadTimeDays}-day resupply lead time. An item is Critical
            below {leadTimeDays} days of cover and Warning below {leadTimeDays * 2}, so the status
            reflects whether a resupply ordered today would arrive in time.
          </Entry>

          {provenance.matching_note && <Entry T={T} term="Matching notes">{provenance.matching_note}</Entry>}
        </div>
      )}
    </section>
  )
}
