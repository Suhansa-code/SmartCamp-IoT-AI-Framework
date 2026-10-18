'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, HeartHandshake, Receipt, Truck } from 'lucide-react'

const STATUS_COPY = {
  success: { title: 'Payment submitted', text: 'Your payment was received. It will be marked verified as soon as the gateway or our staff confirm it.' },
  pending: { title: 'Awaiting verification', text: 'Manual payments are confirmed by our team after the transfer clears. Keep your reference safe.' },
  failed: { title: 'Payment failed', text: 'The payment did not complete. You can try again from the relief portal.' },
}

function ResultContent() {
  const searchParams = useSearchParams()
  // Gateways are configured to return ?order=<reference>; status=success is
  // how PayHere/Stripe mark a completed payment, status=pending a manual one.
  const reference = searchParams.get('reference') || searchParams.get('order') || ''
  const rawStatus = searchParams.get('status')
    || (searchParams.get('payment') === 'success' ? 'success' : 'pending')
  const status = STATUS_COPY[rawStatus] ? rawStatus : 'pending'
  const copy = STATUS_COPY[status]

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <Link href="/relief" style={styles.brand}>
          <span style={styles.mark}><HeartHandshake size={20} /></span>
          <span>SmartCamp <b>Relief</b></span>
        </Link>
      </header>
      <div style={styles.card}>
        <span style={{ ...styles.icon, ...(status === 'failed' ? styles.iconFail : styles.iconOk) }}>
          <CheckCircle2 size={28} />
        </span>
        <h1 style={styles.h1}>{copy.title}</h1>
        <p style={styles.text}>{copy.text}</p>
        {reference && (
          <div style={styles.refRow}><Receipt size={16} /><span>Order reference</span><b>{reference}</b></div>
        )}
        <div style={styles.actions}>
          {reference && <Link href={`/relief/track/${reference}`} style={styles.primary}><Truck size={16} /> Track this order</Link>}
          <Link href="/relief" style={styles.secondary}>Back to the relief portal</Link>
        </div>
      </div>
    </main>
  )
}

export default function ReliefCheckoutResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultContent />
    </Suspense>
  )
}

const styles = {
  page: { minHeight: '100svh', background: '#F8FAFC', fontFamily: "'Inter',sans-serif", color: '#0F172A' },
  header: { display: 'flex', alignItems: 'center', padding: '1rem clamp(1rem,4vw,3rem)', background: '#fff', borderBottom: '1px solid #E2E8F0' },
  brand: { display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', textDecoration: 'none' },
  mark: { width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#16A34A,#0D9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { maxWidth: 520, margin: 'clamp(2rem,8vw,5rem) auto', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 20, padding: '2rem', textAlign: 'center' },
  icon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 999 },
  iconOk: { background: '#ECFDF5', color: '#16A34A' },
  iconFail: { background: '#FEF2F2', color: '#DC2626' },
  h1: { fontSize: '1.35rem', margin: '1rem 0 0.5rem' },
  text: { color: '#475569', fontSize: '0.9rem', lineHeight: 1.6 },
  refRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: '1.25rem', padding: '0.75rem 1rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: '0.85rem' },
  actions: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: '1.5rem' },
  primary: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#16A34A', color: '#fff', borderRadius: 12, padding: '0.8rem 1.2rem', fontWeight: 700, textDecoration: 'none' },
  secondary: { color: '#0D9488', fontWeight: 700, textDecoration: 'none', fontSize: '0.85rem' },
}
