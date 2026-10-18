'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, CheckCircle2, Circle, HeartHandshake, LoaderCircle, PackageOpen,
  RefreshCw, Store, Truck, Wallet,
} from 'lucide-react'
import { API_BASE } from '@/lib/apiBase'
import { readJson } from '@/lib/apiJson'

const ORDER_STEPS = [
  { key: 'CREATED', label: 'Order created' },
  { key: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  { key: 'PAID', label: 'Payment verified' },
  { key: 'CONFIRMED_WITH_PARTNER', label: 'Confirmed with partner' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'RECEIVED', label: 'Received into camp stock' },
]

const TERMINAL = { CANCELLED: 'Order cancelled', EXPIRED: 'Payment window expired' }

function formatLkr(value) {
  return `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function stepIndex(status) {
  return ORDER_STEPS.findIndex((step) => step.key === status)
}

export default function ReliefTrack({ reference }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/relief/orders/${encodeURIComponent(reference)}`)
      const body = await readJson(res)
      if (!res.ok) throw new Error(body?.error?.message || body?.error || 'Order not found')
      setData(body)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [reference])

  useEffect(() => { load() }, [load])

  const order = data?.order
  const isTerminal = order && Object.hasOwn(TERMINAL, order.status)
  const activeIndex = order ? stepIndex(order.status) : -1

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <Link href="/relief" style={styles.brand}>
          <span style={styles.mark}><HeartHandshake size={20} /></span>
          <span>SmartCamp <b>Relief</b></span>
        </Link>
        <button style={styles.refresh} onClick={load}><RefreshCw size={15} /> Refresh</button>
      </header>

      <div style={styles.wrap}>
        {loading && <p style={styles.muted}><LoaderCircle size={16} /> Loading order…</p>}
        {error && (
          <div style={styles.error}><AlertTriangle size={17} /> {error}</div>
        )}

        {order && (
          <>
            <div style={styles.titleRow}>
              <div>
                <span style={styles.kicker}>Order tracking</span>
                <h1 style={styles.h1}>{order.reference}</h1>
                <p style={styles.muted}>
                  {order.kind === 'MONEY_DONATION'
                    ? 'Money donation to the relief campaign'
                    : `Supplies from ${order.partner_code} for ${order.destination_name}`}
                </p>
              </div>
              <span style={{ ...styles.statusPill, ...(isTerminal ? styles.statusTerminal : styles.statusActive) }}>
                {TERMINAL[order.status] || order.status.replaceAll('_', ' ')}
              </span>
            </div>

            {!isTerminal && (
              <ol style={styles.timeline}>
                {ORDER_STEPS.map((step, index) => {
                  const done = index < activeIndex
                  const current = index === activeIndex
                  return (
                    <li key={step.key} style={styles.step}>
                      <span style={{ ...styles.dot, ...(done ? styles.dotDone : {}), ...(current ? styles.dotCurrent : {}) }}>
                        {done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                      </span>
                      <span style={{ ...styles.stepLabel, ...(done || current ? styles.stepLabelActive : {}) }}>{step.label}</span>
                    </li>
                  )
                })}
              </ol>
            )}

            <div style={styles.cols}>
              <section style={styles.card}>
                <h2 style={styles.cardTitle}><Store size={17} /> Order details</h2>
                <Row label="Amount" value={formatLkr(order.total_lkr)} />
                <Row label="Destination" value={order.destination_name || '—'} />
                <Row label="Created" value={new Date(order.created_at).toLocaleString('en-LK')} />
                {order.message && <Row label="Message" value={order.message} />}
                {order.items?.length > 0 && (
                  <div style={styles.items}>
                    {order.items.map((item) => (
                      <div key={item.sku} style={styles.item}>
                        <span>{item.name} × {item.quantity} {item.unit}</span>
                        <b>{formatLkr(item.line_total_lkr)}</b>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={styles.card}>
                <h2 style={styles.cardTitle}><Wallet size={17} /> Payments</h2>
                {data.payments.length === 0 && <p style={styles.muted}>No payment started yet.</p>}
                {data.payments.map((payment, index) => (
                  <div key={index} style={styles.eventRow}>
                    <span>
                      <b>{payment.provider}</b>
                      <small style={styles.eventMeta}>
                        {payment.payer_reference ? `Ref ${payment.payer_reference} · ` : ''}
                        {new Date(payment.created_at).toLocaleString('en-LK')}
                      </small>
                    </span>
                    <span style={{ ...styles.badge, ...badgeStyle(payment.status) }}>{payment.status}</span>
                  </div>
                ))}
              </section>
            </div>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}><Truck size={17} /> Delivery &amp; receipt</h2>
              {data.deliveries.length === 0 && <p style={styles.muted}>Delivery has not been booked yet.</p>}
              {data.deliveries.map((delivery) => (
                <div key={delivery.id} style={styles.eventRow}>
                  <span>
                    <b>{delivery.provider} · {delivery.status.replaceAll('_', ' ')}</b>
                    <small style={styles.eventMeta}>
                      {delivery.manual_reference || delivery.provider_reference || 'Awaiting provider reference'}
                      {delivery.quote_estimate_lkr != null ? ` · est. ${formatLkr(delivery.quote_estimate_lkr)}` : ''}
                    </small>
                  </span>
                </div>
              ))}
              {data.receipt ? (
                <div style={{ ...styles.receipt, ...styles.receiptOk }}>
                  <PackageOpen size={16} />
                  <span>
                    Received into camp stock ({data.receipt.condition})
                    {data.receipt.inventory_applied ? ' · inventory updated' : ''}
                  </span>
                </div>
              ) : (
                data.deliveries.length > 0 && (
                  <div style={{ ...styles.receipt, ...styles.receiptPending }}>
                    <PackageOpen size={16} />
                    <span>Camp inventory changes only once staff confirm receipt.</span>
                  </div>
                )
              )}
            </section>
          </>
        )}

        <Link href="/relief" style={styles.back}>← Back to the relief portal</Link>
      </div>
    </main>
  )
}

function Row({ label, value }) {
  return (
    <div style={styles.row}><span>{label}</span><b>{value}</b></div>
  )
}

function badgeStyle(status) {
  if (status === 'VERIFIED') return { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }
  if (status === 'AWAITING_CONFIRMATION' || status === 'PENDING') return { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }
  if (status === 'FAILED' || status === 'REJECTED') return { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
  return { background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }
}

const styles = {
  page: { minHeight: '100svh', background: '#F8FAFC', color: '#0F172A', fontFamily: "'Inter',sans-serif" },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem clamp(1rem,4vw,3rem)', background: '#fff', borderBottom: '1px solid #E2E8F0' },
  brand: { display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', textDecoration: 'none' },
  mark: { width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#16A34A,#0D9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  refresh: { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', background: '#fff', borderRadius: 999, padding: '0.5rem 0.9rem', cursor: 'pointer', fontWeight: 700 },
  wrap: { maxWidth: 980, margin: '0 auto', padding: 'clamp(1.25rem,4vw,2.5rem) clamp(1rem,4vw,2rem)', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' },
  kicker: { fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0D9488' },
  h1: { fontSize: 'clamp(1.4rem,3vw,2rem)', margin: '0.3rem 0' },
  statusPill: { padding: '0.4rem 0.9rem', borderRadius: 999, fontWeight: 800, fontSize: '0.78rem' },
  statusActive: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' },
  statusTerminal: { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' },
  timeline: { listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', padding: '1rem', margin: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16 },
  step: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' },
  dot: { display: 'inline-flex', color: '#CBD5E1' },
  dotDone: { color: '#16A34A' },
  dotCurrent: { color: '#0D9488' },
  stepLabel: { color: '#94A3B8', fontWeight: 600 },
  stepLabelActive: { color: '#0F172A' },
  cols: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1.25rem' },
  card: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '1.1rem' },
  cardTitle: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '1rem', margin: '0 0 0.75rem' },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0.45rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.85rem' },
  items: { marginTop: '0.5rem' },
  item: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0.3rem 0', fontSize: '0.83rem' },
  eventRow: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.85rem' },
  eventMeta: { display: 'block', color: '#64748B', fontSize: '0.75rem', marginTop: 2 },
  badge: { padding: '0.25rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800 },
  receipt: { display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.75rem', padding: '0.7rem 0.85rem', borderRadius: 12, fontSize: '0.82rem' },
  receiptOk: { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' },
  receiptPending: { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' },
  error: { display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 12, padding: '0.75rem 1rem', fontWeight: 600 },
  muted: { color: '#64748B', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 },
  back: { color: '#0D9488', fontWeight: 700, textDecoration: 'none', fontSize: '0.85rem' },
}
