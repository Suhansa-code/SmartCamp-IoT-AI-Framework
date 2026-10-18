'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, Check, ChevronDown, CreditCard, Droplets, HandHeart, HeartHandshake,
  Landmark, LoaderCircle, LockKeyhole, LogOut, MapPin, PackageOpen, ShieldCheck, Sparkles, Utensils, X,
} from 'lucide-react'
import { API_BASE } from '@/lib/apiBase'
import styles from './DonationPortal.module.css'

const FALLBACK_RESOURCES = [
  { id: 'water', resource_name: 'Drinking water', category: 'water', unit: 'L', available_quantity: 420, minimum_threshold: 1200, status: 'CRITICAL' },
  { id: 'rice', resource_name: 'Rice', category: 'food', unit: 'kg', available_quantity: 680, minimum_threshold: 1000, status: 'LOW' },
  { id: 'hygiene', resource_name: 'Hygiene kits', category: 'hygiene', unit: 'kits', available_quantity: 90, minimum_threshold: 300, status: 'CRITICAL' },
  { id: 'blankets', resource_name: 'Blankets', category: 'shelter', unit: 'items', available_quantity: 540, minimum_threshold: 400, status: 'AVAILABLE' },
]

const QUICK_AMOUNTS = [500, 1000, 2500, 5000]

function resourceIcon(category) {
  if (category === 'water') return Droplets
  if (category === 'food') return Utensils
  return PackageOpen
}

function shortage(resource) {
  const available = Number(resource.available_quantity) || 0
  const target = Number(resource.minimum_threshold) || 0
  return target > 0 ? Math.max(0, Math.round((1 - available / target) * 100)) : 0
}

function errorMessage(payload, fallback) {
  return payload?.error?.message || payload?.error || fallback
}

export default function DonationPortal() {
  const googleButton = useRef(null)
  const [config, setConfig] = useState(null)
  const [resources, setResources] = useState(FALLBACK_RESOURCES)
  const [liveResources, setLiveResources] = useState(false)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [mode, setMode] = useState('money')
  const [amount, setAmount] = useState(2500)
  const [selectedResource, setSelectedResource] = useState(FALLBACK_RESOURCES[0])
  const [quantity, setQuantity] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState(null)
  const [gatewayOpen, setGatewayOpen] = useState(false)
  const [gatewayStep, setGatewayStep] = useState('form')
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvv: '', email: '' })

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/donations/config`).then((response) => response.ok ? response.json() : null),
      fetch(`${API_BASE}/api/donations/needs`).then((response) => response.ok ? response.json() : null),
      fetch(`${API_BASE}/api/donations/auth/me`).then((response) => response.ok ? response.json() : null),
    ]).then(([configData, needsData, authData]) => {
      setConfig(configData)
      if (needsData?.resources?.length) {
        setResources(needsData.resources)
        setSelectedResource(needsData.resources[0])
        setLiveResources(Boolean(needsData.live))
      }
      setUser(authData?.user || null)
    }).catch(() => setNotice({ type: 'error', text: 'Live updates are temporarily unavailable. Showing the latest relief list.' }))
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    if (!config?.googleClientId || user) return

    const renderButton = () => {
      if (!window.google?.accounts?.id || !googleButton.current) return
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async ({ credential }) => {
          setAuthLoading(true)
          setNotice(null)
          try {
            const response = await fetch(`${API_BASE}/api/donations/auth/google`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ credential }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(errorMessage(payload, 'Google sign-in failed'))
            setUser(payload.user)
          } catch (error) {
            setNotice({ type: 'error', text: error.message })
          } finally {
            setAuthLoading(false)
          }
        },
      })
      googleButton.current.replaceChildren()
      window.google.accounts.id.renderButton(googleButton.current, {
        theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 260,
      })
    }

    const existing = document.querySelector('script[data-google-identity]')
    if (existing) {
      if (window.google) renderButton()
      else existing.addEventListener('load', renderButton, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.dataset.googleIdentity = 'true'
    script.onload = renderButton
    document.head.appendChild(script)
  }, [config, user])

  const signOut = async () => {
    await fetch(`${API_BASE}/api/donations/auth/logout`, { method: 'POST' })
    setUser(null)
    setNotice(null)
  }

  const submitMoney = async (event) => {
    event.preventDefault()
    if (!Number.isFinite(Number(amount)) || Number(amount) < 100) {
      setNotice({ type: 'error', text: 'Enter a donation of at least LKR 100.' })
      return
    }
    setNotice(null)
    setGatewayStep('form')
    setGatewayOpen(true)
  }

  const formatCardNumber = (value) => value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  const formatExpiry = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
  }

  const completeDemoPayment = (event) => {
    event.preventDefault()
    setGatewayStep('processing')
    window.setTimeout(() => {
      setGatewayStep('success')
      setSubmitting(false)
    }, 1400)
  }

  const closeGateway = () => {
    const completed = gatewayStep === 'success'
    setGatewayOpen(false)
    setGatewayStep('form')
    setCard({ name: '', number: '', expiry: '', cvv: '', email: '' })
    if (completed) setNotice({ type: 'success', text: `Demo payment of LKR ${Number(amount).toLocaleString('en-LK')} completed. Thank you for supporting Sri Lankan relief centers.` })
  }

  const submitGoods = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setNotice(null)
    try {
      const response = await fetch(`${API_BASE}/api/donations/in-kind`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resource_name: selectedResource.resource_name, category: selectedResource.category,
          unit: selectedResource.unit, quantity: Number(quantity), country: 'Sri Lanka', message,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(errorMessage(payload, 'Could not record your resource offer'))
      setQuantity('')
      setMessage('')
      setNotice({ type: 'success', text: payload.message })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="SmartCamp Relief home">
          <span className={styles.mark}><HeartHandshake size={21} /></span>
          <span>SmartCamp <b>Relief</b></span>
        </a>
        <nav className={styles.nav} aria-label="Donation page navigation">
          <a href="#needs">Urgent needs</a>
          <a href="#donate">Donate</a>
          <a href="#trust">How it works</a>
        </nav>
        <a className={styles.headerCta} href="#donate">Help now <ArrowRight size={16} /></a>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroGlow} />
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span /> Human support, directed by live needs</div>
          <h1>Help reaches the camp<br /><em>where it matters most.</em></h1>
          <p>Support emergency response centers across Sri Lanka with funding or pledge essential supplies such as drinking water, rice, hygiene kits, and shelter materials.</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryAction} href="#donate">Make a donation <ArrowRight size={18} /></a>
            <a className={styles.textAction} href="#needs">View resource needs <ChevronDown size={17} /></a>
          </div>
          <div className={styles.trustRow}>
            <span><ShieldCheck size={17} /> Verified account</span>
            <span><LockKeyhole size={17} /> Secure checkout</span>
            <span><MapPin size={17} /> Sri Lanka relief</span>
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.orbit}><span /><span /><span /></div>
          <div className={styles.visualCard}>
            <span className={styles.liveDot} /> LIVE RESOURCE SIGNAL
            <strong>{resources.filter((item) => item.status === 'CRITICAL').length}</strong>
            <p>critical resources need support</p>
            <div className={styles.miniBars}>{resources.slice(0, 4).map((resource) => <i key={resource.id} style={{ height: `${Math.max(20, shortage(resource))}%` }} />)}</div>
          </div>
          <div className={styles.floatTag}><Sparkles size={15} /> Every contribution counts</div>
        </div>
      </section>

      <section className={styles.needs} id="needs">
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>Resource center</span><h2>See what is needed right now</h2></div>
          <div className={styles.dataStatus}><span className={liveResources ? styles.online : styles.sample} /> {liveResources ? 'Live center inventory' : 'Prepared needs preview'}</div>
        </div>
        <div className={styles.resourceGrid}>
          {resources.slice(0, 8).map((resource) => {
            const Icon = resourceIcon(resource.category)
            const gap = shortage(resource)
            return (
              <button key={resource.id} className={`${styles.resourceCard} ${selectedResource?.id === resource.id ? styles.selectedCard : ''}`} onClick={() => { setSelectedResource(resource); setMode('goods'); document.getElementById('donate')?.scrollIntoView({ behavior: 'smooth' }) }}>
                <div className={styles.resourceTop}><span className={styles.resourceIcon}><Icon size={20} /></span><span className={`${styles.status} ${styles[resource.status?.toLowerCase()]}`}>{resource.status}</span></div>
                <h3>{resource.resource_name}</h3>
                <p><strong>{Number(resource.available_quantity).toLocaleString()}</strong> {resource.unit} available</p>
                <div className={styles.progress}><span style={{ width: `${Math.min(100, Math.max(5, 100 - gap))}%` }} /></div>
                <div className={styles.resourceFoot}><span>{gap ? `${gap}% below target` : 'Target covered'}</span><span>Offer this <ArrowRight size={13} /></span></div>
              </button>
            )
          })}
        </div>
      </section>

      <section className={styles.donateSection} id="donate">
        <div className={styles.donateIntro}>
          <span className={styles.kicker}>Choose your impact</span>
          <h2>Give in the way<br />that works for you.</h2>
          <p>Fund the most urgent purchases or offer goods already available in your region. Physical donations are reviewed before they are added to camp stock.</p>
          <div className={styles.steps}>
            <div><span>01</span><p><b>Identify yourself</b><br />Google sign-in is available but optional for this demo.</p></div>
            <div><span>02</span><p><b>Choose money or goods</b><br />Respond to current center needs.</p></div>
            <div><span>03</span><p><b>Track a real commitment</b><br />Payments and pledges are recorded.</p></div>
          </div>
        </div>

        <div className={styles.donationCard}>
          <div className={styles.modeTabs}>
            <button className={mode === 'money' ? styles.activeTab : ''} onClick={() => setMode('money')}>Donate money</button>
            <button className={mode === 'goods' ? styles.activeTab : ''} onClick={() => setMode('goods')}>Offer resources</button>
          </div>

          {notice && <div className={`${styles.notice} ${styles[notice.type]}`} role="status">{notice.type === 'success' && <Check size={18} />}{notice.text}</div>}

          <div className={styles.account} id="account">
            <div><span>DONOR ACCOUNT · OPTIONAL</span><p>{user ? `Signed in as ${user.name}` : 'You can use Google or continue with the payment demo.'}</p></div>
            {user ? <button className={styles.userButton} onClick={signOut}>{user.picture && <img src={user.picture} alt="" referrerPolicy="no-referrer" />}<LogOut size={16} /><span>Sign out</span></button>
              : config?.googleClientId ? <div ref={googleButton} className={styles.googleButton}>{authLoading && <LoaderCircle className={styles.spin} />}</div>
                : <span className={styles.setupBadge}>Setup required</span>}
          </div>

          {mode === 'money' ? (
            <form onSubmit={submitMoney} className={styles.form}>
              <label className={styles.label}>Donation amount</label>
              <div className={styles.amounts}>{QUICK_AMOUNTS.map((value) => <button type="button" key={value} className={Number(amount) === value ? styles.activeAmount : ''} onClick={() => setAmount(value)}>LKR {value.toLocaleString('en-LK')}</button>)}</div>
              <div className={styles.moneyInput}><span>LKR</span><input aria-label="Custom donation amount in Sri Lankan rupees" type="number" min="100" max="1000000" step="100" required value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
              <label className={styles.fieldLabel}>Message (optional)<textarea rows="2" maxLength="200" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="A short note of support" /></label>
              <button className={styles.submit} disabled={submitting || authLoading}>{submitting ? <LoaderCircle className={styles.spin} /> : <LockKeyhole size={18} />} Continue to secure payment</button>
              <p className={styles.formNote}>Demonstration payment gateway for the SmartCamp project. No real charge is made.</p>
            </form>
          ) : (
            <form onSubmit={submitGoods} className={styles.form}>
              <label className={styles.fieldLabel}>Resource<select value={selectedResource?.id} onChange={(event) => setSelectedResource(resources.find((item) => String(item.id) === event.target.value) || resources[0])}>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.resource_name} · {resource.status}</option>)}</select></label>
              <div className={styles.twoFields}>
                <label className={styles.fieldLabel}>Quantity<input type="number" min="0.001" max="1000000" step="any" required value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="e.g. 100" /></label>
                <label className={styles.fieldLabel}>Unit<input value={selectedResource?.unit || ''} readOnly /></label>
              </div>
              <label className={styles.fieldLabel}>Donation country<input value="Sri Lanka" readOnly /></label>
              <label className={styles.fieldLabel}>Delivery details (optional)<textarea rows="2" maxLength="500" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Availability, packaging, or delivery notes" /></label>
              <button className={styles.submit} disabled={submitting || authLoading}>{submitting ? <LoaderCircle className={styles.spin} /> : <HandHeart size={19} />} Pledge these resources</button>
              <p className={styles.formNote}>A coordinator will contact you before shipping. Please do not send goods until delivery is confirmed.</p>
            </form>
          )}
        </div>
      </section>

      <section className={styles.trustSection} id="trust">
        <p>BUILT FOR ACCOUNTABLE RELIEF</p>
        <div><article><span>01</span><h3>Needs before noise</h3><p>Critical and low-stock resources are surfaced from Sri Lankan response center inventory.</p></article><article><span>02</span><h3>Simple demonstration</h3><p>The realistic checkout demonstrates the donor journey without making a real card charge.</p></article><article><span>03</span><h3>Stock stays accurate</h3><p>Offers remain pledges until response staff physically receive and verify the goods.</p></article></div>
      </section>

      {gatewayOpen && (
        <div className={styles.gatewayBackdrop} role="dialog" aria-modal="true" aria-labelledby="gateway-title">
          <div className={styles.gateway}>
            <div className={styles.gatewayHeader}>
              <div className={styles.gatewayBrand}><span><Landmark size={20} /></span><div><b>SmartCamp Pay</b><small>SRI LANKA PAYMENT GATEWAY</small></div></div>
              <button type="button" onClick={closeGateway} aria-label="Close payment gateway"><X size={19} /></button>
            </div>
            {gatewayStep === 'form' && (
              <form className={styles.gatewayBody} onSubmit={completeDemoPayment}>
                <div className={styles.demoBanner}><Sparkles size={15} /><span><b>Demonstration checkout</b>No real payment will be processed.</span></div>
                <div className={styles.orderLine}><div><span>Donation to</span><b>SmartCamp Sri Lanka Relief</b></div><strong>LKR {Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</strong></div>
                <div className={styles.paymentMethods}><button type="button" className={styles.methodActive}><CreditCard size={17} /> Card</button><button type="button"><Landmark size={17} /> Bank</button></div>
                <label className={styles.gatewayLabel}>Cardholder name<input required autoComplete="cc-name" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} placeholder="Name on card" /></label>
                <label className={styles.gatewayLabel}>Card number<div className={styles.cardNumber}><input required inputMode="numeric" autoComplete="cc-number" minLength="19" value={card.number} onChange={(event) => setCard({ ...card, number: formatCardNumber(event.target.value) })} placeholder="4242 4242 4242 4242" /><span>VISA</span></div></label>
                <div className={styles.gatewayFields}><label className={styles.gatewayLabel}>Expiry<input required inputMode="numeric" autoComplete="cc-exp" minLength="5" value={card.expiry} onChange={(event) => setCard({ ...card, expiry: formatExpiry(event.target.value) })} placeholder="MM/YY" /></label><label className={styles.gatewayLabel}>CVV<input required inputMode="numeric" autoComplete="cc-csc" minLength="3" maxLength="4" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="123" /></label></div>
                <label className={styles.gatewayLabel}>Email for receipt<input required type="email" autoComplete="email" value={card.email} onChange={(event) => setCard({ ...card, email: event.target.value })} placeholder="donor@example.lk" /></label>
                <button className={styles.payButton} type="submit"><LockKeyhole size={17} /> Pay LKR {Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</button>
                <p className={styles.gatewayFoot}><ShieldCheck size={14} /> Demo interface · Card details stay in this browser and are discarded.</p>
              </form>
            )}
            {gatewayStep === 'processing' && <div className={styles.gatewayState}><span className={styles.processingRing}><LoaderCircle /></span><h3>Processing payment</h3><p>Connecting to the Sri Lanka payment network...</p></div>}
            {gatewayStep === 'success' && <div className={styles.gatewayState}><span className={styles.successRing}><Check /></span><small>PAYMENT SUCCESSFUL</small><h3>Thank you for your donation</h3><p>LKR {Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })} has been approved in this demonstration.</p><div className={styles.receipt}><span>Reference</span><b>SC-{Date.now().toString().slice(-8)}</b><span>Status</span><b>Approved</b></div><button className={styles.payButton} type="button" onClick={closeGateway}>Return to donation page</button></div>}
          </div>
        </div>
      )}

      <footer className={styles.footer}><span className={styles.brand}><span className={styles.mark}><HeartHandshake size={19} /></span> SmartCamp <b>Relief</b></span><p>Connecting Sri Lankan communities with urgent local needs.</p><a href="/">Operations console</a></footer>
    </main>
  )
}
