'use client'

/**
 * How much of the measured food basket this store actually stocks.
 *
 * This replaces the old "How each store line was matched" panel, which put the
 * standardisation pipeline — canonical keys, token subsets, alias-table counts,
 * evidence notes — on the main dashboard. That detail decides how much to trust
 * a share, so it is kept; it just belongs behind a disclosure rather than
 * between the forecast and the reorder dates.
 *
 * What stays on the surface is the one number an operator can act on: the share
 * of measured demand that any stocked line accounts for. A low figure does not
 * mean the forecast is wrong — it means the store does not carry most of what
 * the survey measured, so per-item demand is correspondingly smaller.
 *
 * Per-item match evidence now lives in the inventory table's expandable row,
 * next to the numbers it explains.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'
import InfoHint from './InfoHint'

const pct1 = (v) => `${((v ?? 0) * 100).toFixed(1)}%`

function tint(hex, alpha = 0.15) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex))
  if (!m) return 'transparent'
  const [r, g, b] = m.slice(1).map((v) => parseInt(v, 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Items whose share rests on a guess rather than a stated mapping. */
export function weakMatches(items = []) {
  return items.filter((i) => {
    const rule = i.standardisation?.match_rule
    if (rule === 'token_subset' || rule === 'token_superset') return true
    // A forecastable food line with no matched commodity is on the remainder.
    return i.forecastable && i.kind === 'food' && !i.commodity_matched
  })
}

export default function BasketCoverageCard({ items = [], allocation, provenance }) {
  const { T } = useTheme()
  const [open, setOpen] = useState(false)
  if (!allocation) return null

  const claimed = allocation.claimed_share ?? 0
  const alias = provenance?.commodity_aliases
  const weak = weakMatches(items)

  return (
    <section style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: '0.9rem', overflow: 'hidden',
    }}>
      <div style={{ padding: '1.05rem 1.15rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
          <h2 style={{
            margin: 0, fontSize: '0.7rem', fontWeight: 800, color: T.muted,
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Basket coverage
          </h2>
          <InfoHint
            align="left"
            text="Only stocked commodities are included in item-level demand. Unstocked commodities are not redistributed across other items."
          />
          {weak.length > 0 && (
            <span style={{
              marginLeft: 'auto', background: tint(T.amber), color: T.amber,
              borderRadius: '9999px', padding: '2px 9px', fontSize: '0.68rem', fontWeight: 800,
            }}>
              {weak.length} to review
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', margin: '0.6rem 0 0' }}>
          <span style={{
            fontSize: '1.9rem', fontWeight: 800, color: T.textPrimary,
            lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {pct1(claimed)}
          </span>
          <span style={{ fontSize: '0.8rem', color: T.muted }}>of measured food basket stocked</span>
        </div>

        <div style={{
          marginTop: '0.7rem', height: 8, borderRadius: 9999,
          background: T.bar, overflow: 'hidden', border: `1px solid ${T.border}`,
        }}>
          <div style={{
            width: `${Math.max(0, Math.min(1, claimed)) * 100}%`, height: '100%',
            background: T.teal, borderRadius: 9999,
          }} />
        </div>

        <p style={{ margin: '0.45rem 0 0', fontSize: '0.74rem', color: T.dim, fontVariantNumeric: 'tabular-nums' }}>
          {allocation.commodities_claimed} / {allocation.commodities_available} commodities
        </p>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.45rem',
          padding: '0.7rem 1.15rem', background: 'transparent',
          border: 'none', borderTop: `1px solid ${T.border}`,
          cursor: 'pointer', textAlign: 'left', color: T.muted,
          fontSize: '0.76rem', fontWeight: 700,
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Matching details
      </button>

      {open && (
        <div style={{
          borderTop: `1px solid ${T.border}`, padding: '0.95rem 1.15rem',
          fontSize: '0.76rem', color: T.muted, lineHeight: 1.6,
          display: 'flex', flexDirection: 'column', gap: '0.7rem',
        }}>
          {allocation.unstocked_share_note && <p style={{ margin: 0 }}>{allocation.unstocked_share_note}</p>}
          {allocation.note && <p style={{ margin: 0 }}>{allocation.note}</p>}

          {weak.length > 0 && (
            <div style={{
              display: 'flex', gap: '0.55rem', alignItems: 'flex-start',
              background: tint(T.amber, 0.07), border: `1px solid ${tint(T.amber, 0.35)}`,
              borderRadius: '0.6rem', padding: '0.65rem 0.8rem',
            }}>
              <AlertTriangle size={14} style={{ color: T.amber, flexShrink: 0, marginTop: 3 }} />
              <p style={{ margin: 0 }}>
                <strong style={{ color: T.textPrimary }}>
                  {weak.length} item{weak.length === 1 ? '' : 's'} matched on words or not at all.
                </strong>{' '}
                Their draw rates are inferred rather than stated. Adding an entry to the alias list
                for each turns a guess into a curated mapping.
              </p>
            </div>
          )}

          {alias && (
            <p style={{ margin: 0 }}>
              <strong style={{ color: T.textPrimary }}>Alias list.</strong>{' '}
              {alias.counts?.aliases} aliases, {alias.counts?.non_food} non-food and{' '}
              {alias.counts?.beverage_excluded} excluded-beverage names.{' '}
              This is the one input here that is curated rather than measured: it decides which
              commodity a store line refers to, never how much of it is consumed.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
