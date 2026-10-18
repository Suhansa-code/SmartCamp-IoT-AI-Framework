'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, Check, ChevronRight, Copy, CreditCard, HeartHandshake,
  Landmark, LoaderCircle, LockKeyhole, Minus, PackageOpen, Plus, QrCode,
  ShieldCheck, ShoppingCart, Sparkles, Store, Truck, X,
} from 'lucide-react'
import { API_BASE } from '@/lib/apiBase'
import { readJson } from '@/lib/apiJson'

const CATEGORY_LABELS = {
  food: 'Food', water: 'Water', medicine: 'Medicine', hygiene: 'Hygiene', shelter: 'Shelter', other: 'Other',
}

const GUEST_ID_KEY = 'smartcamp.relief.guest'
let fallbackGuestId = null

function errorMessage(payload, fallback) {
  return payload?.error?.message || payload?.error || fallback
}

function formatLkr(value) {
  return `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STOCK_BADGES = {
  IN_STOCK: { label: 'In stock', color: '#15803D' },
  LOW_STOCK: { label: 'Low stock', color: '#B45309' },
  OUT_OF_STOCK: { label: 'Out of stock', color: '#B91C1C' },
  UNKNOWN: { label: 'Stock unverified', color: '#64748B' },
}

function stockBadge(product) {
  return STOCK_BADGES[product?.stock_status] || { label: 'Availability unknown', color: '#64748B' }
}

function guestHeaders() {
  if (typeof window === 'undefined') return {}

  let guestId = null
  try {
    guestId = window.localStorage.getItem(GUEST_ID_KEY)
  } catch { /* use the in-memory fallback */ }

  if (!guestId) {
    const randomId = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    guestId = fallbackGuestId || `guest-${randomId}`
    fallbackGuestId = guestId
    try { window.localStorage.setItem(GUEST_ID_KEY, guestId) } catch { /* keep the in-memory value */ }
  }

  return { 'X-Relief-Guest': guestId }
}

export default function ReliefPortal() {
  const [config, setConfig] = useState(null)
  const [catalogues, setCatalogues] = useState([])
  const [activePartner, setActivePartner] = useState(null)
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState({}) // sku -> { product, quantity }
  const [cartOpen, setCartOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)

  // checkout state
  const [destinationType, setDestinationType] = useState('COLLECTION_CENTRE')
  const [destinationCode, setDestinationCode] = useState('')
  const [message, setMessage] = useState('')
  const [method, setMethod] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [placed, setPlaced] = useState(null) // { order, payment, checkout }

  // money donation
  const [donationAmount, setDonationAmount] = useState(2500)
  const [donationMessage, setDonationMessage] = useState('')
  const [donating, setDonating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [configRes, catalogueRes] = await Promise.all([
        fetch(`${API_BASE}/api/relief/config`),
        fetch(`${API_BASE}/api/relief/catalogue`),
      ])
      const configBody = await readJson(configRes)
      const catalogueBody = await readJson(catalogueRes)
      if (!configRes.ok) throw new Error(errorMessage(configBody, 'Could not load relief portal'))
      if (!catalogueRes.ok) throw new Error(errorMessage(catalogueBody, 'Could not load catalogue'))
      setConfig(configBody)
      setCatalogues(catalogueBody.catalogues || [])
      setActivePartner(catalogueBody.catalogues?.[0]?.partner_code || null)
      setDestinationCode(configBody.destinations?.COLLECTION_CENTRE?.[0]?.code || '')
      setMethod(configBody.payment_methods?.find((m) => m.key === 'PAYHERE')?.key || configBody.payment_methods?.[0]?.key || '')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const catalogue = useMemo(
    () => catalogues.find((c) => c.partner_code === activePartner) || null,
    [catalogues, activePartner],
  )

  const visibleProducts = useMemo(() => {
    if (!catalogue) return []
    return catalogue.products.filter((p) => category === 'all' || p.category === category)
  }, [catalogue, category])

  const cartLines = useMemo(() => Object.values(cart), [cart])
  const subtotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + Number(line.product.unit_price_lkr) * line.quantity, 0),
    [cartLines],
  )
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0)

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev[product.sku]
      return { ...prev, [product.sku]: { product, quantity: (existing?.quantity || 0) + 1 } }
    })
    setNotice(null)
  }

  function changeQuantity(sku, delta) {
    setCart((prev) => {
      const line = prev[sku]
      if (!line) return prev
      const next = { ...prev }
      const quantity = line.quantity + delta
      if (quantity <= 0) delete next[sku]
      else next[sku] = { ...line, quantity }
      return next
    })
  }

  async function placeOrder() {
    if (!cartLines.length) return
    setSubmitting(true)
    setNotice(null)
    try {
      const idempotencyKey = `${activePartner}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const orderRes = await fetch(`${API_BASE}/api/relief/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': idempotencyKey, ...guestHeaders() },
        body: JSON.stringify({
          kind: 'RESOURCE_PURCHASE',
          items: cartLines.map((line) => ({ partner_code: line.product.partner_code, sku: line.product.sku, quantity: line.quantity })),
          destination_type: destinationType,
          destination_code: destinationCode,
          message,
        }),
      })
      const orderBody = await readJson(orderRes)
      if (!orderRes.ok) throw new Error(errorMessage(orderBody, 'Could not create your order'))

      const orderId = orderBody.order.id
      const payRes = await fetch(`${API_BASE}/api/relief/orders/${orderId}/payment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...guestHeaders() },
        body: JSON.stringify({ provider: method }),
      })
      const payBody = await readJson(payRes)
      if (!payRes.ok) throw new Error(errorMessage(payBody, 'Could not start payment'))
      setPlaced({ order: orderBody.order, payment: payBody.payment, checkout: payBody.checkout, orderId })
      setCart({})
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  // Completes a gateway checkout in one step when the portal is not running
  // against live gateway credentials; live checkouts redirect to the provider.
  async function completePayment() {
    if (!placed?.orderId) return
    setSubmitting(true)
    setNotice(null)
    try {
      const res = await fetch(`${API_BASE}/api/relief/orders/${placed.orderId}/sandbox/pay`, {
        method: 'POST',
        headers: { ...guestHeaders() },
      })
      const body = await readJson(res)
      if (!res.ok) throw new Error(errorMessage(body, 'The payment could not be completed'))
      const settled = body.duplicate || ['order_paid', 'already_verified'].includes(body.processed)
      if (!settled) throw new Error('The payment was received but is still awaiting verification')
      window.location.href = `/relief/checkout/result?reference=${encodeURIComponent(placed.order.reference)}&status=success`
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      setSubmitting(false)
    }
  }

  async function donateMoney() {
    setDonating(true)
    setNotice(null)
    try {
      const idempotencyKey = `don-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const orderRes = await fetch(`${API_BASE}/api/relief/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': idempotencyKey, ...guestHeaders() },
        body: JSON.stringify({ kind: 'MONEY_DONATION', amount_lkr: Number(donationAmount), message: donationMessage, idempotency_key: idempotencyKey }),
      })
      const orderBody = await readJson(orderRes)
      if (!orderRes.ok) throw new Error(errorMessage(orderBody, 'Could not create your donation'))
      const payRes = await fetch(`${API_BASE}/api/relief/orders/${orderBody.order.id}/payment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...guestHeaders() },
        body: JSON.stringify({ provider: method }),
      })
      const payBody = await readJson(payRes)
      if (!payRes.ok) throw new Error(errorMessage(payBody, 'Could not start payment'))
      setPlaced({ order: orderBody.order, payment: payBody.payment, checkout: payBody.checkout, orderId: orderBody.order.id })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setDonating(false)
    }
  }

  const transparency = config?.transparency

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <Link href="/relief" style={styles.brand}>
          <span style={styles.mark}><HeartHandshake size={20} /></span>
          <span>SmartCamp <b>Relief</b></span>
        </Link>
        <nav style={styles.nav}>
          <a href="#campaign">Campaign</a>
          <a href="#shop">Shop for camps</a>
          <a href="#donate">Donate money</a>
          <Link href="/relief/manage">Staff console</Link>
        </nav>
        <button style={styles.cartButton} onClick={() => setCartOpen(true)}>
          <ShoppingCart size={17} /> {cartCount > 0 && <span style={styles.cartCount}>{cartCount}</span>}
        </button>
      </header>

      {notice && (
        <div style={{ ...styles.notice, ...styles[notice.type] }}>
          {notice.type === 'success' ? <Check size={17} /> : <AlertTriangle size={17} />} {notice.text}
        </div>
      )}

      <section style={styles.hero} id="campaign">
        <div style={styles.heroCopy}>
          <span style={styles.eyebrow}><Sparkles size={14} /> Verified relief, end to end</span>
          <h1 style={styles.h1}>Buy the supplies a camp needs.<br /><em style={styles.em}>We deliver and prove it arrived.</em></h1>
          <p style={styles.heroText}>
            Choose essentials from partner supermarkets, pay securely, and track the delivery to a
            collection centre or disaster camp. Inventory only changes once staff confirm receipt.
          </p>
          <div style={styles.heroActions}>
            <a href="#shop" style={styles.primaryBtn}>Shop for a camp <ChevronRight size={17} /></a>
            <a href="#donate" style={styles.secondaryBtn}>Donate money</a>
          </div>
        </div>
        <div style={styles.campaignCard}>
          {config?.campaigns?.[0] ? (
            <>
              <span style={styles.campaignTag}>ACTIVE CAMPAIGN</span>
              <h3 style={styles.campaignTitle}>{config.campaigns[0].title}</h3>
              <p style={styles.campaignDesc}>{config.campaigns[0].description}</p>
              <ProgressBar
                raised={Number(transparency?.verified_donations_lkr || 0)}
                goal={Number(config.campaigns[0].goal_amount_lkr || 0)}
              />
            </>
          ) : (
            <p style={styles.muted}>No active campaign.</p>
          )}
          <div style={styles.statGrid}>
            <Stat label="Verified funds" value={formatLkr(transparency?.verified_donations_lkr)} />
            <Stat label="Verified payments" value={transparency?.verified_payment_count ?? 0} />
            <Stat label="Orders delivered" value={transparency?.orders_delivered ?? 0} />
            <Stat label="Receipts posted" value={transparency?.orders_received ?? 0} />
          </div>
        </div>
      </section>

      <section style={styles.shop} id="shop">
        <div style={styles.sectionHead}>
          <div>
            <span style={styles.kicker}>Supermarket partners</span>
            <h2 style={styles.h2}>Pick supplies, we handle the rest</h2>
          </div>
          <div style={styles.partnerTabs}>
            {catalogues.map((c) => (
              <button
                key={c.partner_code}
                onClick={() => setActivePartner(c.partner_code)}
                style={{ ...styles.partnerTab, ...(c.partner_code === activePartner ? styles.partnerTabActive : {}) }}
              >
                <PartnerLogo partnerCode={c.partner_code} size={18} active={c.partner_code === activePartner} /> {c.partner_name}
              </button>
            ))}
          </div>
        </div>

        {catalogue && (
          <div style={styles.partnerBanner}>
            <PartnerLogo partnerCode={catalogue.partner_code} size={56} />
            <div>
              <h3 style={styles.partnerBannerName}>{catalogue.partner_name}</h3>
              <p style={styles.partnerBannerMeta}>
                {catalogue.products.length} supplies · {catalogue.is_live ? 'Live partner feed' : 'Sample catalogue'}
              </p>
            </div>
          </div>
        )}

        {catalogue?.is_live && (
          <div style={{ ...styles.dataNotice, border: '1px solid #16A34A55', background: '#16A34A12' }}>
            <Check size={16} /><span><b>Live partner feed.</b> Prices and stock are current partner API data.</span>
          </div>
        )}

        <div style={styles.categoryRow}>
          {['all', 'food', 'water', 'medicine', 'hygiene', 'shelter'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{ ...styles.categoryPill, ...(category === cat ? styles.categoryPillActive : {}) }}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={styles.muted}><LoaderCircle size={16} /> Loading catalogue…</p>
        ) : (
          <div style={styles.grid}>
            {visibleProducts.map((product) => {
              const badge = stockBadge(product)
              const inCart = cart[product.sku]?.quantity || 0
              return (
                <article key={product.sku} style={styles.productCard}>
                  <div style={styles.productTop}>
                    <span style={{ ...styles.stockBadge, color: badge.color, border: `1px solid ${badge.color}55`, background: `${badge.color}14` }}>
                      {badge.label}
                    </span>
                    <span style={styles.categoryTag}>{CATEGORY_LABELS[product.category]}</span>
                  </div>
                  <h3 style={styles.productName}>{product.name}</h3>
                  <p style={styles.productMeta}>
                    {formatLkr(product.unit_price_lkr)} / {product.unit}
                    {product.stock_quantity != null ? ` · ${product.stock_quantity} available` : ' · stock unknown'}
                  </p>
                  <div style={styles.productFoot}>
                    {inCart > 0 ? (
                      <div style={styles.stepper}>
                        <button style={styles.stepBtn} onClick={() => changeQuantity(product.sku, -1)}><Minus size={14} /></button>
                        <span style={styles.stepValue}>{inCart}</span>
                        <button style={styles.stepBtn} onClick={() => changeQuantity(product.sku, 1)}><Plus size={14} /></button>
                      </div>
                    ) : (
                      <button
                        style={{ ...styles.addBtn, opacity: product.is_orderable ? 1 : 0.5, cursor: product.is_orderable ? 'pointer' : 'not-allowed' }}
                        disabled={!product.is_orderable}
                        onClick={() => addToCart(product)}
                      >
                        <Plus size={15} /> Add
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section style={styles.donateSection} id="donate">
        <div>
          <span style={styles.kicker}>Prefer cash?</span>
          <h2 style={styles.h2}>Donate money to the campaign</h2>
          <p style={styles.muted}>
            Funds are pooled to buy the most urgent camp requests. Every payment is verified before it
            counts toward campaign progress.
          </p>
          <MethodPicker methods={config?.payment_methods} value={method} onChange={setMethod} tone="light" />
        </div>
        <div style={styles.donateCard}>
          <label style={styles.label}>Amount (LKR)</label>
          <div style={styles.quickAmounts}>
            {[500, 1000, 2500, 5000].map((amount) => (
              <button key={amount} style={{ ...styles.quickAmount, ...(Number(donationAmount) === amount ? styles.quickAmountActive : {}) }} onClick={() => setDonationAmount(amount)}>
                {amount.toLocaleString('en-LK')}
              </button>
            ))}
          </div>
          <input type="number" min="100" max="10000000" value={donationAmount} onChange={(e) => setDonationAmount(e.target.value)} style={styles.input} />
          <label style={styles.label}>Message (optional)</label>
          <textarea rows="2" maxLength="500" value={donationMessage} onChange={(e) => setDonationMessage(e.target.value)} style={styles.input} />
          <button style={styles.primaryBtnFull} disabled={donating} onClick={donateMoney}>
            {donating ? <LoaderCircle size={17} /> : <LockKeyhole size={17} />} Continue to payment
          </button>
        </div>
      </section>

      <section style={styles.trust}>
        <TrustCard icon={<LockKeyhole size={18} />} title="Payments are verified" text="Orders are only marked paid after a signed gateway webhook or staff-verified bank transfer / LankaQR payment." />
        <TrustCard icon={<Truck size={18} />} title="Delivery is tracked" text="Uber, PickMe, or a manual courier booking keeps a reference and a status history for every leg." />
        <TrustCard icon={<PackageOpen size={18} />} title="Stock changes on receipt only" text="Camp inventory is credited only when a collection centre or camp manager confirms the goods arrived." />
      </section>

      {cartOpen && (
        <CartDrawer
          cartLines={cartLines}
          subtotal={subtotal}
          onClose={() => setCartOpen(false)}
          changeQuantity={changeQuantity}
          destinationType={destinationType}
          setDestinationType={setDestinationType}
          destinationCode={destinationCode}
          setDestinationCode={setDestinationCode}
          destinations={config?.destinations}
          message={message}
          setMessage={setMessage}
          method={method}
          setMethod={setMethod}
          methods={config?.payment_methods}
          submitting={submitting}
          onPlace={placeOrder}
        />
      )}

      {placed && <PaymentPanel placed={placed} onClose={() => setPlaced(null)} onPay={completePayment} submitting={submitting} />}

      <footer style={styles.footer}>
        <span>SmartCamp Relief — connecting Sri Lankan communities with verified supplies.</span>
        <Link href="/" style={styles.footerLink}>Operations console</Link>
      </footer>
    </main>
  )
}

const PARTNER_LOGO_EXTENSIONS = ['png', 'svg', 'jpg', 'jpeg', 'webp']

/**
 * Files already present in public/markets, tried after the clean <partner>.<ext>
 * name. Drop a keells.png / cargills.png / arpico.png / spar.png in /markets and
 * it wins automatically; until then these existing assets are used.
 */
const KNOWN_PARTNER_LOGOS = {
  keells: [
    '/markets/keells-vector-logo-seeklogo/keells-seeklogo.png',
    '/markets/keells-vector-logo-seeklogo/keells-seeklogo.svg',
  ],
  cargills: ['/markets/Frame-261-1.png'],
  arpico: ['/markets/ar.jpg'],
  spar: ['/markets/spar-vector-logo-seeklogo/spar-seeklogo.png'],
}

/**
 * Partner logos live in public/markets as <partner>.png (e.g. /markets/keells.png).
 * Each candidate path is tried in order; if none load we fall back to the
 * generic shop icon so a missing file never breaks the partner tab.
 */
function partnerLogoCandidates(partnerCode) {
  const code = String(partnerCode || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!code) return []
  const canonical = PARTNER_LOGO_EXTENSIONS.map((ext) => `/markets/${code}.${ext}`)
  return [...canonical, ...(KNOWN_PARTNER_LOGOS[code] || [])]
}

function PartnerLogo({ partnerCode, size = 24, active = false }) {
  const [candidate, setCandidate] = useState(0)
  const candidates = useMemo(() => partnerLogoCandidates(partnerCode), [partnerCode])

  if (candidate >= candidates.length) {
    return <Store size={Math.round(size * 0.7)} />
  }
  return (
    <img
      key={partnerCode}
      src={candidates[candidate]}
      alt=""
      width={size}
      height={size}
      onError={() => setCandidate((index) => index + 1)}
      style={{
        ...styles.logo,
        width: size,
        height: size,
        padding: Math.max(2, Math.round(size * 0.12)),
        background: active ? '#fff' : '#F8FAFC',
      }}
    />
  )
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  )
}

function TrustCard({ icon, title, text }) {
  return (
    <article style={styles.trustCard}>
      <span style={styles.trustIcon}>{icon}</span>
      <h4 style={styles.trustTitle}>{title}</h4>
      <p style={styles.muted}>{text}</p>
    </article>
  )
}

function ProgressBar({ raised, goal }) {
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
        <span>{formatLkr(raised)} raised</span>
        <span>{goal > 0 ? `of ${formatLkr(goal)}` : ''}</span>
      </div>
      <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${pct}%` }} /></div>
      <span style={styles.progressPct}>{pct}% funded</span>
    </div>
  )
}

function CartDrawer({ cartLines, subtotal, onClose, changeQuantity, destinationType, setDestinationType, destinationCode, setDestinationCode, destinations, message, setMessage, method, setMethod, methods, submitting, onPlace }) {
  const options = destinations?.[destinationType] || []
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.drawerHead}>
          <h3 style={styles.drawerTitle}><ShoppingCart size={18} /> Your relief cart</h3>
          <button style={styles.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>
        {cartLines.length === 0 ? (
          <p style={styles.muted}>Your cart is empty. Add supplies from the catalogue.</p>
        ) : (
          <div style={styles.drawerBody}>
            {cartLines.map((line) => (
              <div key={line.product.sku} style={styles.cartLine}>
                <div>
                  <b style={{ fontSize: '0.86rem' }}>{line.product.name}</b>
                  <div style={styles.muted}>{formatLkr(line.product.unit_price_lkr)} / {line.product.unit}</div>
                </div>
                <div style={styles.stepper}>
                  <button style={styles.stepBtn} onClick={() => changeQuantity(line.product.sku, -1)}><Minus size={13} /></button>
                  <span style={styles.stepValue}>{line.quantity}</span>
                  <button style={styles.stepBtn} onClick={() => changeQuantity(line.product.sku, 1)}><Plus size={13} /></button>
                </div>
              </div>
            ))}

            <label style={styles.label}>Deliver to</label>
            <select value={destinationType} onChange={(e) => { setDestinationType(e.target.value); setDestinationCode((destinations?.[e.target.value] || [])[0]?.code || '') }} style={styles.input}>
              <option value="COLLECTION_CENTRE">Collection centre</option>
              <option value="CAMP">Disaster camp</option>
            </select>
            <select value={destinationCode} onChange={(e) => setDestinationCode(e.target.value)} style={styles.input}>
              {options.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>

            <label style={styles.label}>Payment method</label>
            <MethodPicker methods={methods} value={method} onChange={setMethod} tone="light" />

            <label style={styles.label}>Note (optional)</label>
            <textarea rows="2" maxLength="500" value={message} onChange={(e) => setMessage(e.target.value)} style={styles.input} />

            <div style={styles.totalRow}><span>Subtotal</span><b>{formatLkr(subtotal)}</b></div>
            <button style={styles.primaryBtnFull} disabled={submitting} onClick={onPlace}>
              {submitting ? <LoaderCircle size={17} /> : <LockKeyhole size={17} />} Place order &amp; pay
            </button>
            <p style={styles.fineprint}>You will be shown the gateway or transfer instructions next. No card details are stored on this server.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Presentation for each payment method — accent, icon and headline copy. */
const PAYMENT_BRANDS = {
  PAYHERE: { name: 'PayHere', hint: 'Visa, Mastercard, eZ Cash, Genie and e-banking', accent: '#1D4ED8', soft: '#EFF6FF', icon: 'card', cards: true },
  STRIPE: { name: 'Stripe', hint: 'Visa and Mastercard, processed by Stripe', accent: '#635BFF', soft: '#F5F3FF', icon: 'card', cards: true },
  BANK_TRANSFER: { name: 'Bank transfer', hint: 'Verified against the bank statement', accent: '#0F766E', soft: '#F0FDFA', icon: 'bank' },
  LANKAQR: { name: 'LankaQR', hint: 'Any LankaQR-enabled bank app', accent: '#0D9488', soft: '#CCFBF1', icon: 'qr' },
}

function paymentBrand(key) {
  const brand = PAYMENT_BRANDS[key]
  if (brand) return brand
  return { name: key || 'Payment', hint: '', accent: '#0F172A', soft: '#F1F5F9', icon: 'card' }
}

function brandGlyph(icon) {
  if (icon === 'bank') return <Landmark size={16} />
  if (icon === 'qr') return <QrCode size={16} />
  return <CreditCard size={16} />
}

/** Visa / Mastercard badges shown next to card-based methods. */
function CardNetworks() {
  return (
    <span style={styles.networks} aria-label="Visa and Mastercard accepted">
      <span style={styles.visaMark}>VISA</span>
      <span style={styles.mcMark}><i style={styles.mcDotA} /><i style={styles.mcDotB} /></span>
    </span>
  )
}

function MethodPicker({ methods, value, onChange, tone = 'dark' }) {
  const light = tone === 'light'
  return (
    <div style={styles.methodList}>
      {(methods || []).map((m) => {
        const brand = paymentBrand(m.key)
        const active = value === m.key
        return (
          <label
            key={m.key}
            style={{
              ...(light ? styles.methodRowLight : styles.methodRow),
              ...(active ? (light ? styles.methodRowLightActive : styles.methodRowActive) : {}),
            }}
          >
            <input type="radio" name="relief-method" value={m.key} checked={active} onChange={() => onChange(m.key)} />
            <span style={{ ...styles.methodIcon, color: brand.accent, background: light ? brand.soft : `${brand.accent}33` }}>
              {brandGlyph(brand.icon)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: '0.86rem' }}>{m.label}</b>
              <small style={{ ...(light ? styles.methodNoteLight : styles.methodNote) }}>{m.note || brand.hint}</small>
            </span>
            {brand.cards && <CardNetworks />}
          </label>
        )
      })}
    </div>
  )
}

function PaymentPanel({ placed, onClose, onPay, submitting }) {
  const { checkout, payment } = placed
  const brand = paymentBrand(payment?.provider)
  const manual = Boolean(checkout?.instructions)
  const hosted = checkout?.mode === 'live'
  const [copied, setCopied] = useState('')

  function copyValue(slot, value) {
    if (!value) return
    const done = () => { setCopied(slot); setTimeout(() => setCopied(''), 1800) }
    Promise.resolve(navigator.clipboard?.writeText(String(value))).then(done, done)
  }

  const instructionRows = !checkout?.instructions ? [] : Object.entries({
    Bank: checkout.instructions.bank,
    'Account name': checkout.instructions.accountName,
    'Account no.': checkout.instructions.accountNumber,
    Merchant: checkout.instructions.merchantName,
    'QR payload': checkout.instructions.qrPayload,
  }).filter(([, value]) => value)

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.drawer, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...styles.payHead, background: brand.soft, border: `1px solid ${brand.accent}33` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ ...styles.brandChip, color: '#fff', background: brand.accent }}>{brandGlyph(brand.icon)}</span>
            <span style={{ minWidth: 0 }}>
              <b style={styles.brandName}>{brand.name}</b>
              <small style={styles.brandHint}>{brand.hint}</small>
            </span>
            {brand.cards && <CardNetworks />}
          </div>
          <button style={styles.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={styles.drawerBody}>
          <div style={styles.payHero}>
            <span style={styles.payAmount}>{formatLkr(placed.order.total_lkr)}</span>
            <span style={styles.payOrder}>Order {placed.order.reference}</span>
          </div>

          {checkout?.notice && <p style={styles.payNotice}>{checkout.notice}</p>}

          {instructionRows.length > 0 && (
            <div style={styles.instructions}>
              {instructionRows.map(([label, value]) => (
                <div key={label} style={styles.instructionRow}>
                  <span>{label}</span>
                  <b style={label === 'QR payload' ? { wordBreak: 'break-all', textAlign: 'right' } : undefined}>{value}</b>
                </div>
              ))}
              <div style={styles.instructionRow}>
                <span>Reference</span>
                <b>{checkout.instructions.reference}</b>
                <button style={styles.copyBtn} onClick={() => copyValue('ref', checkout.instructions.reference)}>
                  {copied === 'ref' ? <Check size={13} /> : <Copy size={13} />} {copied === 'ref' ? 'Copied' : 'Copy'}
                </button>
              </div>
              {checkout.instructions.note && <p style={styles.fineprint}>{checkout.instructions.note}</p>}
            </div>
          )}

          {manual && (
            <button style={styles.primaryBtnFull} onClick={() => { window.location.href = `/relief/track/${placed.order.reference}` }}>
              <Truck size={17} /> View order status
            </button>
          )}

          {!manual && hosted && (
            <a href={checkout.redirectUrl} style={styles.primaryBtnFull}>
              <LockKeyhole size={17} /> Pay {formatLkr(placed.order.total_lkr)}
            </a>
          )}

          {!manual && !hosted && (
            <button style={styles.primaryBtnFull} disabled={submitting} onClick={onPay}>
              {submitting
                ? <><LoaderCircle size={17} /> Processing payment…</>
                : <><LockKeyhole size={17} /> Pay {formatLkr(placed.order.total_lkr)}</>}
            </button>
          )}

          <p style={styles.paySecure}>
            <ShieldCheck size={14} />
            {manual
              ? ' Quote the reference above so our team can match your payment to this order.'
              : ` Secure checkout with ${brand.name}. Card details are entered on the gateway and are never stored on our servers.`}
          </p>

          <Link href={`/relief/track/${placed.order.reference}`} style={styles.trackLink} onClick={onClose}>
            <Truck size={15} /> Track this order
          </Link>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100svh', background: '#F8FAFC', color: '#0F172A', fontFamily: "'Inter',sans-serif" },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem clamp(1rem,4vw,3rem)', background: '#fff', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 50, flexWrap: 'wrap' },
  brand: { display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', textDecoration: 'none' },
  mark: { width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#16A34A,#0D9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nav: { display: 'flex', gap: '1.1rem', fontSize: '0.85rem', fontWeight: 600 },
  cartButton: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', background: '#fff', borderRadius: 999, padding: '0.5rem 0.9rem', cursor: 'pointer', fontWeight: 700, color: '#0F172A' },
  cartCount: { background: '#16A34A', color: '#fff', borderRadius: 999, fontSize: '0.68rem', padding: '1px 7px', fontWeight: 800 },
  notice: { margin: '1rem clamp(1rem,4vw,3rem) 0', padding: '0.75rem 1rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.85rem' },
  error: { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' },
  success: { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' },
  hero: { display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,0.95fr)', gap: '2rem', padding: 'clamp(1.5rem,4vw,3.5rem) clamp(1rem,4vw,3rem)', alignItems: 'center', maxWidth: 1280, margin: '0 auto' },
  heroCopy: { maxWidth: 620 },
  eyebrow: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0D9488' },
  h1: { fontSize: 'clamp(1.8rem,3.4vw,2.6rem)', lineHeight: 1.15, margin: '0.8rem 0' },
  em: { color: '#16A34A', fontStyle: 'normal' },
  heroText: { color: '#475569', fontSize: '1rem', lineHeight: 1.6 },
  heroActions: { display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 12, padding: '0.75rem 1.2rem', fontWeight: 700, textDecoration: 'none', cursor: 'pointer' },
  primaryBtnFull: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 12, padding: '0.8rem 1.2rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', marginTop: '0.5rem' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', background: '#fff', color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: 12, padding: '0.75rem 1.2rem', fontWeight: 700, textDecoration: 'none', cursor: 'pointer' },
  campaignCard: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 22, padding: '1.5rem', boxShadow: '0 20px 50px rgba(15,23,42,0.06)' },
  campaignTag: { fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.12em', color: '#0D9488' },
  campaignTitle: { margin: '0.5rem 0', fontSize: '1.25rem' },
  campaignDesc: { color: '#475569', fontSize: '0.88rem', lineHeight: 1.55 },
  progressTrack: { height: 8, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', background: 'linear-gradient(90deg,#22C55E,#0D9488)', borderRadius: 99, transition: 'width 0.6s ease' },
  progressPct: { fontSize: '0.72rem', color: '#64748B', fontWeight: 700 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: '1.1rem' },
  stat: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.7rem 0.8rem' },
  statValue: { display: 'block', fontSize: '1.02rem', fontWeight: 800 },
  statLabel: { fontSize: '0.68rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  shop: { padding: 'clamp(1rem,4vw,2.5rem) clamp(1rem,4vw,3rem)', maxWidth: 1280, margin: '0 auto' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' },
  kicker: { fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0D9488' },
  h2: { fontSize: 'clamp(1.4rem,2.6vw,1.9rem)', margin: '0.4rem 0' },
  partnerTabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  partnerTab: { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', background: '#fff', borderRadius: 999, padding: '0.45rem 0.85rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', color: '#0F172A' },
  partnerTabActive: { background: '#0F172A', color: '#fff', border: '1px solid #0F172A' },
  logo: { display: 'block', objectFit: 'contain', objectPosition: 'center', borderRadius: 8, border: '1px solid #E2E8F0', flexShrink: 0 },
  partnerBanner: { display: 'flex', alignItems: 'center', gap: 16, margin: '1rem 0', padding: '1rem 1.25rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16 },
  partnerBannerName: { margin: 0, fontSize: '1.15rem', fontWeight: 800 },
  partnerBannerMeta: { margin: '0.25rem 0 0', color: '#64748B', fontSize: '0.82rem' },
  dataNotice: { display: 'flex', gap: 8, alignItems: 'flex-start', margin: '1rem 0', padding: '0.8rem 1rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, color: '#92400E', fontSize: '0.82rem' },
  categoryRow: { display: 'flex', gap: 8, margin: '0.75rem 0 1rem', flexWrap: 'wrap' },
  categoryPill: { border: '1px solid #E2E8F0', background: '#fff', borderRadius: 999, padding: '0.4rem 0.9rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' },
  categoryPillActive: { background: '#16A34A', color: '#fff', border: '1px solid #16A34A' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 },
  productCard: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '1rem' },
  productTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  stockBadge: { fontSize: '0.66rem', fontWeight: 800, border: '1px solid #E2E8F0', borderRadius: 999, padding: '2px 8px' },
  categoryTag: { fontSize: '0.66rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' },
  productName: { fontSize: '0.95rem', margin: '0.6rem 0 0.3rem' },
  productMeta: { fontSize: '0.78rem', color: '#475569', margin: 0 },
  productFoot: { marginTop: '0.9rem' },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#ECFDF5', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 10, padding: '0.45rem 0.85rem', fontWeight: 700, fontSize: '0.8rem' },
  stepper: { display: 'inline-flex', alignItems: 'center', gap: 10, border: '1px solid #E2E8F0', borderRadius: 10, padding: '0.25rem 0.45rem' },
  stepBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, border: 'none', background: '#F1F5F9', borderRadius: 7, cursor: 'pointer' },
  stepValue: { fontWeight: 800, minWidth: 18, textAlign: 'center' },
  donateSection: { display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: '2rem', padding: 'clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,3rem)', background: '#fff', color: '#0F172A', maxWidth: '100%' },
  methodList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: '1rem' },
  methodRow: { display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid #334155', borderRadius: 12, padding: '0.7rem 0.9rem', cursor: 'pointer', background: '#1E293B' },
  methodRowActive: { border: '1px solid #16A34A', background: '#14532D' },
  methodNote: { display: 'block', fontSize: '0.72rem', color: '#94A3B8', marginTop: 3 },
  donateCard: { background: '#fff', color: '#0F172A', borderRadius: 20, padding: '1.25rem' },
  label: { display: 'block', fontSize: '0.76rem', fontWeight: 700, margin: '0.75rem 0 0.35rem' },
  input: { width: '100%', border: '1px solid #CBD5E1', borderRadius: 10, padding: '0.6rem 0.75rem', fontSize: '0.86rem', fontFamily: 'inherit', background: '#fff', color: '#0F172A' },
  quickAmounts: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  quickAmount: { border: '1px solid #CBD5E1', background: '#fff', borderRadius: 10, padding: '0.45rem 0.8rem', fontWeight: 700, cursor: 'pointer' },
  quickAmountActive: { background: '#16A34A', color: '#fff', border: '1px solid #16A34A' },
  trust: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, padding: 'clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,3rem)', maxWidth: 1280, margin: '0 auto' },
  trustCard: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: '1.1rem' },
  trustIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: '#ECFDF5', color: '#15803D' },
  trustTitle: { margin: '0.7rem 0 0.3rem', fontSize: '0.95rem' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', justifyContent: 'flex-end', zIndex: 100, padding: 0 },
  drawer: { width: '100%', maxWidth: 440, background: '#fff', height: '100%', overflowY: 'auto', padding: '1.25rem' },
  drawerHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  drawerTitle: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', margin: 0 },
  drawerBody: { display: 'flex', flexDirection: 'column' },
  iconBtn: { border: '1px solid #E2E8F0', background: '#fff', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  cartLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '0.6rem 0', borderBottom: '1px solid #F1F5F9' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '2px solid #0F172A', fontSize: '1.05rem' },
  fineprint: { fontSize: '0.72rem', color: '#64748B', marginTop: '0.6rem', lineHeight: 1.5 },
  orderRefRow: { display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.86rem' },
  instructions: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.85rem', marginTop: '0.75rem', fontSize: '0.82rem' },
  trackLink: { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: '0.9rem', color: '#0D9488', fontWeight: 700, textDecoration: 'none', fontSize: '0.85rem' },
  muted: { color: '#64748B', fontSize: '0.85rem' },
  methodIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, flexShrink: 0 },
  methodRowLight: { display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.65rem 0.85rem', cursor: 'pointer', background: '#fff' },
  methodRowLightActive: { border: '1px solid #16A34A', background: '#F0FDF4' },
  methodNoteLight: { display: 'block', fontSize: '0.72rem', color: '#64748B', marginTop: 3 },
  networks: { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  visaMark: { fontSize: '0.68rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '0.04em', color: '#1A1F71', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 5, padding: '2px 5px' },
  mcMark: { position: 'relative', display: 'inline-flex', width: 30, height: 18, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 5 },
  mcDotA: { position: 'absolute', left: 5, top: 3, width: 12, height: 12, borderRadius: '50%', background: '#EB001B', opacity: 0.9 },
  mcDotB: { position: 'absolute', right: 5, top: 3, width: 12, height: 12, borderRadius: '50%', background: '#F79E1B', opacity: 0.9 },
  payHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0.75rem 0.9rem', border: '1px solid', borderRadius: 14, marginBottom: '0.9rem' },
  brandChip: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, flexShrink: 0 },
  brandName: { display: 'block', fontSize: '0.95rem', lineHeight: 1.2 },
  brandHint: { display: 'block', fontSize: '0.7rem', color: '#475569', marginTop: 2 },
  payHero: { display: 'flex', flexDirection: 'column', gap: 4, padding: '0.9rem 1rem', background: '#0F172A', color: '#fff', borderRadius: 14 },
  payAmount: { fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' },
  payOrder: { fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  payNotice: { fontSize: '0.82rem', color: '#334155', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.7rem 0.85rem', lineHeight: 1.55, marginTop: '0.75rem' },
  instructionRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0.3rem 0', fontSize: '0.82rem' },
  copyBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #CBD5E1', background: '#fff', borderRadius: 8, padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', color: '#0F172A', flexShrink: 0 },
  paySecure: { display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.72rem', color: '#64748B', marginTop: '0.8rem', lineHeight: 1.5 },
  footer: { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '1.5rem clamp(1rem,4vw,3rem)', borderTop: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.8rem' },
  footerLink: { color: '#0D9488', fontWeight: 700, textDecoration: 'none' },
}
