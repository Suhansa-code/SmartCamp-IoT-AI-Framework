'use client'

/**
 * How each store line was read — the standardisation and matching step, shown.
 *
 * This is the layer that decides WHICH survey commodity a store line refers to,
 * and therefore what fraction of the camp's daily food demand draws it down.
 * It was previously invisible: the table showed "matched: White rice" in small
 * grey text and nothing else, so a wrong share and a right one looked the same.
 *
 * That mattered, because the old substring matcher failed in both directions.
 * "Milk Powder" matched nothing and was quietly handed a slice of the leftover
 * basket; "Ice" matched "White r-ICE" and was handed 23.5 % of the entire food
 * basket. Neither said anything was unusual.
 *
 * So this panel shows the chain end to end for every item:
 *
 *     raw store name  ->  canonical key  ->  matching stage  ->  commodities  ->  share
 *
 * and colours the stage by how much evidence it rests on. An operator seeing
 * "unallocated remainder" in amber knows the number is a placeholder; seeing
 * "exact" in green knows it is the survey's own name. That distinction is the
 * whole reason the layer exists, and it belongs on screen rather than in a log.
 *
 * Data: the `allocation` block and each item's `standardisation` from
 * GET /api/resources/stock/outlook.
 */
import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronRight, Info, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'

/** Hex accent -> low-alpha background that reads on either ground. */
function tint(hex, alpha = 0.15) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex))
  if (!m) return 'transparent'
  const [r, g, b] = m.slice(1).map((v) => parseInt(v, 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const pct = (v) => `${((v ?? 0) * 100).toFixed(1)} %`

/**
 * How each matching stage is presented.
 *
 * Colour tracks evidence, not severity: green where a name or a curated
 * mapping states the answer, blue where words merely line up, amber where the
 * number is a placeholder, grey where the item is legitimately not in the
 * basket. An operator should be able to tell a measured share from a guessed
 * one at a glance, which is precisely what the old UI could not do.
 */
const RULES = (T) => ({
  exact:            { fg: T.green, label: 'Exact',       hint: "The survey's own commodity name, after normalisation." },
  alias:            { fg: T.green, label: 'Alias',       hint: 'A curated mapping in commodity_aliases.json names this commodity outright.' },
  token_subset:     { fg: T.blue,  label: 'Word match',  hint: 'Every word of the store name appears in the commodity name. A good guess, not a stated mapping.' },
  token_superset:   { fg: T.blue,  label: 'Word match',  hint: 'Every word of the commodity name appears in the store name. A good guess, not a stated mapping.' },
  remainder:        { fg: T.amber, label: 'Remainder',   hint: 'Nothing matched. This item is using an even split of the unallocated basket share — a placeholder, not a measurement.' },
  water:            { fg: T.blue,  label: 'Water',       hint: 'Priced from the drinking-water rate in ration_rates.json, not from the food basket.' },
  non_food:         { fg: T.dim,   label: 'Non-food',    hint: 'A known non-consumable. No daily per-person draw rate applies.' },
  beverage:         { fg: T.dim,   label: 'Beverage',    hint: 'Excluded from the food basket by construction, because drinking water is provisioned separately.' },
  unknown:          { fg: T.amber, label: 'Unrecognised', hint: 'Nothing recognises this name. Set a category, or add an alias.' },
})

/** Collapse an item's standardisation into one presentational rule key. */
function ruleKey(item) {
  const s = item.standardisation ?? {}
  if (s.match_rule) return s.match_rule
  if (item.kind === 'water') return 'water'
  if (item.kind === 'food') return 'remainder'
  if (s.classified_as === 'non_food') return 'non_food'
  if (s.classified_as === 'beverage') return 'beverage'
  return 'unknown'
}

function Badge({ T, rule }) {
  const r = RULES(T)[rule] ?? RULES(T).unknown
  return (
    <span title={r.hint} style={{
      background: tint(r.fg), color: r.fg, borderRadius: '9999px',
      padding: '2px 9px', fontSize: '0.68rem', fontWeight: 800,
      whiteSpace: 'nowrap', cursor: 'help',
    }}>{r.label}</span>
  )
}

/**
 * The basket, divided. One bar showing what share of measured daily food demand
 * is claimed by named commodities versus what is left over — the single best
 * health check on the matching layer.
 */
function AllocationBar({ T, allocation }) {
  const claimed = allocation.claimed_share ?? 0
  const unallocated = allocation.unallocated_share ?? 0
  const split = (allocation.unmatched_food ?? 0) > 0

  return (
    <div>
      <div style={{
        display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden',
        border: `1px solid ${T.border}`, background: T.bar,
      }}>
        <div title={`${pct(claimed)} matched to named survey commodities`}
             style={{ width: `${claimed * 100}%`, background: T.teal }} />
        <div title={split
              ? `${pct(unallocated)} split evenly across ${allocation.unmatched_food} unmatched food item(s)`
              : `${pct(unallocated)} of the measured basket is not stocked by any line in this store`}
             style={{ width: `${unallocated * 100}%`, background: split ? T.amber : T.border }} />
      </div>
      <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.45rem', flexWrap: 'wrap', fontSize: '0.74rem' }}>
        <span style={{ color: T.muted }}>
          <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: T.teal, marginRight: 6 }} />
          <strong style={{ color: T.textPrimary }}>{pct(claimed)}</strong> matched
          <span style={{ color: T.dim }}> · {allocation.commodities_claimed} of {allocation.commodities_available} commodities</span>
        </span>
        <span style={{ color: T.muted }}>
          <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: split ? T.amber : T.border, marginRight: 6 }} />
          <strong style={{ color: T.textPrimary }}>{pct(unallocated)}</strong>{' '}
          {split ? `split across ${allocation.unmatched_food} unmatched item(s)` : 'not stocked here'}
        </span>
      </div>
    </div>
  )
}

export default function CommodityMatchPanel({ items = [], allocation, provenance }) {
  const { T } = useTheme()
  const [open, setOpen] = useState(false)
  if (!allocation) return null

  const alias = provenance?.commodity_aliases
  const weak = items.filter((i) => ['token_subset', 'token_superset', 'remainder', 'unknown'].includes(ruleKey(i)))

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '0.9rem', overflow: 'hidden' }}>

      {/* ── header ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.95rem 1.1rem', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', color: T.textPrimary,
        }}
      >
        {open ? <ChevronDown size={16} style={{ color: T.muted }} /> : <ChevronRight size={16} style={{ color: T.muted }} />}
        <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>How each store line was matched</span>
        {weak.length > 0 && (
          <span style={{
            background: tint(T.amber), color: T.amber, borderRadius: '9999px',
            padding: '2px 9px', fontSize: '0.68rem', fontWeight: 800,
          }}>
            {weak.length} need{weak.length === 1 ? 's' : ''} review
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: T.dim }}>
          {pct(allocation.claimed_share)} of the basket matched
        </span>
      </button>

      <div style={{ padding: '0 1.1rem 1.1rem' }}>
        <AllocationBar T={T} allocation={allocation} />

        {/* The one figure that changes every runout date if the modelling
            assumption behind it is revisited. Stated, not buried. */}
        {allocation.unstocked_share_note && (
          <div style={{
            marginTop: '0.85rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
            background: T.cardSoft, border: `1px solid ${T.border}`,
            borderRadius: '0.6rem', padding: '0.7rem 0.85rem',
          }}>
            <Info size={15} style={{ color: T.muted, flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: '0.75rem', color: T.muted, lineHeight: 1.55 }}>
              {allocation.unstocked_share_note}
            </p>
          </div>
        )}
      </div>

      {/* ── the chain, per item ────────────────────────────────────────── */}
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 720 }}>
              <thead>
                <tr style={{ background: T.bar }}>
                  {['Store name', 'Standardised to', 'Stage', 'Survey commodity', 'Share of basket'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i === 4 ? 'right' : 'left', padding: '0.6rem 0.9rem',
                      fontSize: '0.66rem', fontWeight: 800, color: T.muted,
                      textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const s = it.standardisation ?? {}
                  const rule = ruleKey(it)
                  const names = it.commodities_matched ?? (it.commodity_matched ? [it.commodity_matched] : [])
                  return (
                    <tr key={it.id} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: '0.6rem 0.9rem', color: T.textPrimary, fontWeight: 600 }}>
                        {it.resource_name}
                        {it.category && (
                          <span style={{ color: T.dim, fontWeight: 400, fontSize: '0.72rem' }}> · {it.category}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', color: T.muted }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <ArrowRight size={12} style={{ color: T.dim, flexShrink: 0 }} />
                          <code style={{
                            fontFamily: 'ui-monospace, monospace', fontSize: '0.76rem',
                            background: T.bar, padding: '1px 6px', borderRadius: 4, color: T.ink,
                          }}>{s.canonical_name ?? '—'}</code>
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem' }}><Badge T={T} rule={rule} /></td>
                      <td style={{ padding: '0.6rem 0.9rem', color: T.ink }}>
                        {names.length === 0 ? (
                          <span style={{ color: T.dim }}>—</span>
                        ) : (
                          <>
                            {names[0]}
                            {names.length > 1 && (
                              <span title={names.join(', ')} style={{ color: T.dim, cursor: 'help' }}>
                                {' '}+{names.length - 1} more
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td style={{
                        padding: '0.6rem 0.9rem', textAlign: 'right', color: T.ink,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {it.basket_share != null ? pct(it.basket_share) : <span style={{ color: T.dim }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Any item whose share rests on a guess rather than a stated mapping. */}
          {weak.length > 0 && (
            <div style={{
              display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
              padding: '0.85rem 1.1rem', borderTop: `1px solid ${T.border}`, background: tint(T.amber, 0.06),
            }}>
              <AlertTriangle size={15} style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: '0.75rem', color: T.muted, lineHeight: 1.55 }}>
                <strong style={{ color: T.textPrimary }}>{weak.length} item{weak.length === 1 ? '' : 's'} matched on words or not at all.</strong>{' '}
                Their draw rates are inferred, not stated. Adding an entry to{' '}
                <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem' }}>commodity_aliases.json</code>{' '}
                for each turns a guess into a curated mapping.
              </p>
            </div>
          )}

          {/* Provenance for the curated layer — the one artifact here that is
              not measured, so it says so explicitly. */}
          {alias && (
            <div style={{
              padding: '0.85rem 1.1rem', borderTop: `1px solid ${T.border}`,
              fontSize: '0.74rem', color: T.muted, lineHeight: 1.55,
            }}>
              <strong style={{ color: T.textPrimary }}>Alias table.</strong>{' '}
              {alias.counts.aliases} aliases, {alias.counts.non_food} non-food and{' '}
              {alias.counts.beverage_excluded} excluded-beverage names ({alias.artifact_id} v{alias.schema_version}).{' '}
              Evidence: <strong style={{ color: T.amber }}>{alias.evidence}</strong> — {alias.evidence_note}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
