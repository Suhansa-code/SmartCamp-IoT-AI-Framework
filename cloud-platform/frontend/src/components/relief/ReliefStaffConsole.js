'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, AlertTriangle, BadgeCheck, Check, ClipboardList, HeartHandshake, LoaderCircle,
  LogOut, PackageOpen, RefreshCw, ShieldCheck, Store, Truck, Wallet, X,
} from 'lucide-react'
import { API_BASE } from '@/lib/apiBase'
import { readJson } from '@/lib/apiJson'

const TOKEN_KEY = 'smartcamp.relief.staff'

const ORDER_FLOW = {
  CREATED: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED', 'EXPIRED'],
  PAID: ['CONFIRMED_WITH_PARTNER', 'CANCELLED'],
  CONFIRMED_WITH_PARTNER: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: [],
  EXPIRED: [],
}

const DELIVERY_STATUSES = ['BOOKED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED']

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: Activity, roles: ['ADMIN', 'PARTNER', 'COLLECTION_CENTRE', 'CAMP_MANAGER'] },
  { key: 'orders', label: 'Orders', icon: ClipboardList, roles: ['ADMIN', 'PARTNER'] },
  { key: 'payments', label: 'Payments', icon: Wallet, roles: ['ADMIN'] },
  { key: 'deliveries', label: 'Deliveries', icon: Truck, roles: ['ADMIN', 'PARTNER', 'COLLECTION_CENTRE'] },
  { key: 'receipts', label: 'Receipts', icon: PackageOpen, roles: ['ADMIN', 'COLLECTION_CENTRE', 'CAMP_MANAGER'] },
  { key: 'requests', label: 'Camp requests', icon: HeartHandshake, roles: ['ADMIN', 'CAMP_MANAGER'] },
  { key: 'audit', label: 'Audit log', icon: ShieldCheck, roles: ['ADMIN'] },
]

function errorMessage(payload, fallback) {
  return payload?.error?.message || payload?.error || fallback
}

function formatLkr(value) {
  return `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function storedToken() {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export default function ReliefStaffConsole() {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [tab, setTab] = useState('dashboard')
  const [notice, setNotice] = useState(null)

  const api = useCallback(async (path, { method = 'GET', body } = {}) => {
    const headers = {}
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (token) headers.authorization = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/api/relief${path}`, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const payload = await readJson(res)
    if (!res.ok) throw Object.assign(new Error(errorMessage(payload, 'Request failed')), { status: res.status })
    return payload
  }, [token])

  useEffect(() => {
    const existing = storedToken()
    if (!existing) { setAuthLoading(false); return }
    setToken(existing)
    fetch(`${API_BASE}/api/relief/auth/me`, { headers: { authorization: `Bearer ${existing}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error('expired')
        const payload = await readJson(res)
        setUser(payload.user)
      })
      .catch(() => {
        try { window.localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
        setToken(null)
      })
      .finally(() => setAuthLoading(false))
  }, [])

  const login = async (event) => {
    event.preventDefault()
    setLoggingIn(true)
    setLoginError(null)
    try {
      const res = await fetch(`${API_BASE}/api/relief/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      const payload = await readJson(res)
      if (!res.ok) throw new Error(errorMessage(payload, 'Sign-in failed'))
      try { window.localStorage.setItem(TOKEN_KEY, payload.token) } catch { /* ignore */ }
      setToken(payload.token)
      setUser(payload.user)
      setCredentials({ email: '', password: '' })
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setLoggingIn(false)
    }
  }

  const logout = async () => {
    await fetch(`${API_BASE}/api/relief/auth/logout`, { method: 'POST' }).catch(() => {})
    try { window.localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
    setToken(null)
    setUser(null)
    setTab('dashboard')
  }

  const visibleTabs = useMemo(
    () => TABS.filter((entry) => !user || entry.roles.includes(user.role)),
    [user],
  )

  if (authLoading) {
    return (
      <main style={styles.page}>
        <p style={styles.muted}><LoaderCircle size={16} /> Checking your session…</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main style={styles.page}>
        <div style={styles.loginCard}>
          <span style={styles.mark}><HeartHandshake size={22} /></span>
          <h1 style={styles.loginTitle}>Relief staff console</h1>
          <p style={styles.muted}>Sign in with your SmartCamp relief account.</p>
          <form onSubmit={login} style={styles.loginForm}>
            <label style={styles.label}>Email</label>
            <input type="email" required autoComplete="username" value={credentials.email}
              onChange={(e) => setCredentials({ ...credentials, email: e.target.value })} style={styles.input} />
            <label style={styles.label}>Password</label>
            <input type="password" required autoComplete="current-password" value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} style={styles.input} />
            {loginError && <div style={styles.error}><AlertTriangle size={15} /> {loginError}</div>}
            <button type="submit" style={styles.primaryBtn} disabled={loggingIn}>
              {loggingIn ? <LoaderCircle size={16} /> : <ShieldCheck size={16} />} Sign in
            </button>
          </form>
          <Link href="/relief" style={styles.back}>← Back to the relief portal</Link>
        </div>
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <Link href="/relief" style={styles.brand}>
          <span style={styles.markSm}><HeartHandshake size={18} /></span>
          <span>SmartCamp <b>Relief</b> console</span>
        </Link>
        <div style={styles.userBox}>
          <div style={styles.userMeta}>
            <b>{user.name || user.email}</b>
            <small>{user.role}{user.org_code ? ` · ${user.org_code}` : ''}</small>
          </div>
          <button style={styles.logout} onClick={logout}><LogOut size={15} /> Sign out</button>
        </div>
      </header>

      <div style={styles.shell}>
        <nav style={styles.tabs}>
          {visibleTabs.map((entry) => {
            const Icon = entry.icon
            return (
              <button key={entry.key} onClick={() => { setTab(entry.key); setNotice(null) }}
                style={{ ...styles.tab, ...(tab === entry.key ? styles.tabActive : {}) }}>
                <Icon size={15} /> {entry.label}
              </button>
            )
          })}
        </nav>

        {notice && (
          <div style={{ ...styles.flash, ...(notice.type === 'error' ? styles.flashError : styles.flashOk) }}>
            {notice.type === 'error' ? <AlertTriangle size={16} /> : <Check size={16} />} {notice.text}
          </div>
        )}

        <section style={styles.content}>
          {tab === 'dashboard' && <Dashboard api={api} user={user} />}
          {tab === 'orders' && <Orders api={api} user={user} setNotice={setNotice} />}
          {tab === 'payments' && <Payments api={api} setNotice={setNotice} />}
          {tab === 'deliveries' && <Deliveries api={api} user={user} setNotice={setNotice} />}
          {tab === 'receipts' && <Receipts api={api} setNotice={setNotice} />}
          {tab === 'requests' && <CampRequests api={api} user={user} setNotice={setNotice} />}
          {tab === 'audit' && <AuditLog api={api} />}
        </section>
      </div>
    </main>
  )
}

function useAsync(loader, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    loader()
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((error) => setState({ loading: false, data: null, error: error.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { reload() }, [reload])
  return { ...state, reload }
}

function PanelState({ loading, error, children }) {
  if (loading) return <p style={styles.muted}><LoaderCircle size={15} /> Loading…</p>
  if (error) return <div style={styles.error}><AlertTriangle size={15} /> {error}</div>
  return children
}

function Dashboard({ api, user }) {
  const { loading, error, data, reload } = useAsync(() => api('/staff/dashboard'), [api])
  const t = data?.transparency
  return (
    <PanelState loading={loading} error={error}>
      <div style={styles.panelHead}>
        <h2 style={styles.h2}>Operations overview</h2>
        <button style={styles.ghost} onClick={reload}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div style={styles.statGrid}>
        <Stat label="Orders" value={data?.counts?.orders ?? 0} />
        <Stat label="Awaiting payment" value={data?.counts?.awaiting_payment_orders ?? 0} />
        <Stat label="Payments to confirm" value={data?.counts?.payments_pending_confirmation ?? 0} />
        <Stat label="Deliveries in flight" value={data?.counts?.deliveries_in_flight ?? 0} />
        <Stat label="Open camp requests" value={data?.counts?.open_camp_requests ?? 0} />
      </div>
      <h3 style={styles.h3}>Verified transparency</h3>
      <div style={styles.statGrid}>
        <Stat label="Verified funds" value={formatLkr(t?.verified_donations_lkr)} />
        <Stat label="Verified payments" value={t?.verified_payment_count ?? 0} />
        <Stat label="Orders delivered" value={t?.orders_delivered ?? 0} />
        <Stat label="Receipts posted" value={t?.orders_received ?? 0} />
      </div>
    </PanelState>
  )
}

function Orders({ api, user, setNotice }) {
  const { loading, error, data, reload } = useAsync(() => api('/staff/orders'), [api])
  const [busy, setBusy] = useState(null)

  const advance = async (order, status) => {
    setBusy(order.id)
    try {
      await api(`/staff/orders/${order.id}/status`, { method: 'PATCH', body: { status } })
      setNotice({ type: 'success', text: `Order ${order.reference} → ${status}` })
      reload()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <PanelState loading={loading} error={error}>
      <div style={styles.panelHead}>
        <h2 style={styles.h2}>Orders {user.role === 'PARTNER' ? `· ${user.org_code}` : ''}</h2>
        <button style={styles.ghost} onClick={reload}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div style={styles.table}>
        {data?.orders?.length === 0 && <p style={styles.muted}>No orders yet.</p>}
        {data?.orders?.map((order) => (
          <div key={order.id} style={styles.row}>
            <div style={styles.rowMain}>
              <b>{order.reference}</b>
              <small>{order.kind} · {order.partner_code || '—'} · {formatLkr(order.total_lkr)}</small>
            </div>
            <StatusBadge status={order.status} />
            <select disabled={busy === order.id} value="" style={styles.select}
              onChange={(e) => e.target.value && advance(order, e.target.value)}>
              <option value="">Move to…</option>
              {(ORDER_FLOW[order.status] || []).map((next) => <option key={next} value={next}>{next.replaceAll('_', ' ')}</option>)}
            </select>
          </div>
        ))}
      </div>
    </PanelState>
  )
}

function Payments({ api, setNotice }) {
  const { loading, error, data, reload } = useAsync(() => api('/staff/payments'), [api])
  const [refs, setRefs] = useState({})
  const [busy, setBusy] = useState(null)

  const act = async (payment, action) => {
    setBusy(payment.id)
    try {
      await api(`/staff/payments/${payment.id}/${action}`, {
        method: 'POST',
        body: action === 'confirm' ? { payer_reference: refs[payment.id] || undefined } : { reason: 'Rejected by staff' },
      })
      setNotice({ type: 'success', text: `Payment ${action === 'confirm' ? 'confirmed' : 'rejected'}` })
      reload()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <PanelState loading={loading} error={error}>
      <div style={styles.panelHead}>
        <h2 style={styles.h2}>Payments</h2>
        <button style={styles.ghost} onClick={reload}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div style={styles.table}>
        {data?.payments?.length === 0 && <p style={styles.muted}>No payments yet.</p>}
        {data?.payments?.map((payment) => (
          <div key={payment.id} style={styles.row}>
            <div style={styles.rowMain}>
              <b>{payment.provider} · {formatLkr(payment.amount_lkr)}</b>
              <small>
                {payment.provider_reference ? `Provider ref ${payment.provider_reference}` : ''}
                {payment.payer_reference ? ` · payer ref ${payment.payer_reference}` : ''}
              </small>
            </div>
            <StatusBadge status={payment.status} />
            {payment.status === 'AWAITING_CONFIRMATION' ? (
              <div style={styles.rowActions}>
                <input placeholder="Payer ref" value={refs[payment.id] || ''}
                  onChange={(e) => setRefs({ ...refs, [payment.id]: e.target.value })} style={styles.smallInput} />
                <button style={styles.confirm} disabled={busy === payment.id} onClick={() => act(payment, 'confirm')}><Check size={14} /></button>
                <button style={styles.reject} disabled={busy === payment.id} onClick={() => act(payment, 'reject')}><X size={14} /></button>
              </div>
            ) : <span style={styles.spacer} />}
          </div>
        ))}
      </div>
    </PanelState>
  )
}

function Deliveries({ api, user, setNotice }) {
  const { loading, error, data, reload } = useAsync(() => api('/staff/deliveries'), [api])
  const ordersState = useAsync(() => (user.role === 'ADMIN' || user.role === 'PARTNER' ? api('/staff/orders') : Promise.resolve({ orders: [] })), [api, user.role])
  const [form, setForm] = useState({ order_id: '', provider: 'MANUAL', manual_reference: '', pickup_note: '' })
  const [busy, setBusy] = useState(null)

  const book = async (event) => {
    event.preventDefault()
    setBusy('book')
    try {
      const result = await api('/staff/deliveries', { method: 'POST', body: form })
      setNotice({ type: 'success', text: result.fallbackToManual ? 'Booked (manual fallback)' : 'Delivery booked' })
      setForm({ order_id: '', provider: 'MANUAL', manual_reference: '', pickup_note: '' })
      reload()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  const setStatus = async (delivery, status) => {
    setBusy(delivery.id)
    try {
      await api(`/staff/deliveries/${delivery.id}/status`, { method: 'PATCH', body: { status } })
      setNotice({ type: 'success', text: `Delivery → ${status}` })
      reload()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <PanelState loading={loading || ordersState.loading} error={error || ordersState.error}>
      <div style={styles.panelHead}>
        <h2 style={styles.h2}>Deliveries</h2>
        <button style={styles.ghost} onClick={reload}><RefreshCw size={14} /> Refresh</button>
      </div>

      {(user.role === 'ADMIN' || user.role === 'PARTNER') && (
        <form onSubmit={book} style={styles.bookForm}>
          <select required value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} style={styles.select}>
            <option value="">Select a PAID order…</option>
            {(ordersState.data?.orders || []).filter((o) => o.status === 'PAID').map((o) => (
              <option key={o.id} value={o.id}>{o.reference} · {formatLkr(o.total_lkr)}</option>
            ))}
          </select>
          <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} style={styles.select}>
            <option value="MANUAL">Manual courier</option>
            <option value="UBER">Uber</option>
            <option value="PICKME">PickMe</option>
          </select>
          <input placeholder="Waybill / reference" value={form.manual_reference}
            onChange={(e) => setForm({ ...form, manual_reference: e.target.value })} style={styles.smallInput} />
          <button type="submit" style={styles.primaryBtnSm} disabled={busy === 'book'}>Book</button>
        </form>
      )}

      <div style={styles.table}>
        {data?.deliveries?.length === 0 && <p style={styles.muted}>No deliveries yet.</p>}
        {data?.deliveries?.map((delivery) => (
          <div key={delivery.id} style={styles.row}>
            <div style={styles.rowMain}>
              <b>{delivery.provider} · {delivery.manual_reference || delivery.provider_reference || '—'}</b>
              <small>Order {delivery.order_reference || delivery.order_id}</small>
            </div>
            <StatusBadge status={delivery.status} />
            <select disabled={busy === delivery.id} value="" style={styles.select}
              onChange={(e) => e.target.value && setStatus(delivery, e.target.value)}>
              <option value="">Set status…</option>
              {DELIVERY_STATUSES.filter((s) => s !== delivery.status).map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
            </select>
          </div>
        ))}
      </div>
    </PanelState>
  )
}

function Receipts({ api, setNotice }) {
  const { loading, error, data, reload } = useAsync(() => api('/staff/deliveries'), [api])
  const [busy, setBusy] = useState(null)
  const confirm = async (delivery) => {
    setBusy(delivery.id)
    try {
      const result = await api('/staff/receipts', { method: 'POST', body: { delivery_id: delivery.id, condition: 'INTACT' } })
      setNotice({ type: 'success', text: result.alreadyReceived ? 'Receipt already recorded' : 'Receipt confirmed — inventory updated' })
      reload()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setBusy(null)
    }
  }
  const pending = (data?.deliveries || []).filter((d) => ['DELIVERED', 'BOOKED', 'IN_TRANSIT'].includes(d.status))
  return (
    <PanelState loading={loading} error={error}>
      <div style={styles.panelHead}>
        <h2 style={styles.h2}>Confirm receipt of supplies</h2>
        <button style={styles.ghost} onClick={reload}><RefreshCw size={14} /> Refresh</button>
      </div>
      <p style={styles.muted}>Inventory is credited only when you confirm the goods physically arrived.</p>
      <div style={styles.table}>
        {pending.length === 0 && <p style={styles.muted}>No deliveries awaiting receipt.</p>}
        {pending.map((delivery) => (
          <div key={delivery.id} style={styles.row}>
            <div style={styles.rowMain}>
              <b>{delivery.manual_reference || delivery.provider_reference || delivery.id}</b>
              <small>{delivery.provider} · {delivery.status}</small>
            </div>
            <button style={styles.primaryBtnSm} disabled={busy === delivery.id} onClick={() => confirm(delivery)}>
              {busy === delivery.id ? <LoaderCircle size={14} /> : <BadgeCheck size={14} />} Confirm receipt
            </button>
          </div>
        ))}
      </div>
    </PanelState>
  )
}

function CampRequests({ api, user, setNotice }) {
  const { loading, error, data, reload } = useAsync(() => api('/camp-requests'), [api])
  const [form, setForm] = useState({ resource_name: '', category: 'food', quantity: '', unit: '', priority: 'NORMAL', notes: '' })
  const [busy, setBusy] = useState(null)

  const create = async (event) => {
    event.preventDefault()
    setBusy('create')
    try {
      await api('/camp-requests', { method: 'POST', body: { ...form, quantity: Number(form.quantity), camp_id: user.org_code } })
      setNotice({ type: 'success', text: 'Request raised' })
      setForm({ resource_name: '', category: 'food', quantity: '', unit: '', priority: 'NORMAL', notes: '' })
      reload()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  const update = async (request, status) => {
    setBusy(request.id)
    try {
      await api(`/camp-requests/${request.id}`, { method: 'PATCH', body: { status } })
      reload()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <PanelState loading={loading} error={error}>
      <div style={styles.panelHead}>
        <h2 style={styles.h2}>Camp requests</h2>
        <button style={styles.ghost} onClick={reload}><RefreshCw size={14} /> Refresh</button>
      </div>
      {user.role === 'CAMP_MANAGER' && (
        <form onSubmit={create} style={styles.bookForm}>
          <input required placeholder="Resource (e.g. Drinking water)" value={form.resource_name}
            onChange={(e) => setForm({ ...form, resource_name: e.target.value })} style={styles.smallInput} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={styles.select}>
            {['food', 'water', 'medical', 'hygiene', 'shelter', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input required type="number" min="1" placeholder="Qty" value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })} style={styles.tinyInput} />
          <input required placeholder="Unit" value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })} style={styles.tinyInput} />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={styles.select}>
            {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button type="submit" style={styles.primaryBtnSm} disabled={busy === 'create'}>Raise request</button>
        </form>
      )}
      <div style={styles.table}>
        {data?.requests?.length === 0 && <p style={styles.muted}>No camp requests.</p>}
        {data?.requests?.map((request) => (
          <div key={request.id} style={styles.row}>
            <div style={styles.rowMain}>
              <b>{request.resource_name} · {request.quantity} {request.unit}</b>
              <small>{request.camp_id} · {request.priority} · {request.status}</small>
            </div>
            {user.role === 'ADMIN' ? (
              <select disabled={busy === request.id} value="" style={styles.select}
                onChange={(e) => e.target.value && update(request, e.target.value)}>
                <option value="">Set status…</option>
                {['OPEN', 'APPROVED', 'ORDERED', 'FULFILLED', 'CANCELLED'].filter((s) => s !== request.status).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : <StatusBadge status={request.status} />}
          </div>
        ))}
      </div>
    </PanelState>
  )
}

function AuditLog({ api }) {
  const { loading, error, data, reload } = useAsync(() => api('/staff/audit'), [api])
  return (
    <PanelState loading={loading} error={error}>
      <div style={styles.panelHead}>
        <h2 style={styles.h2}>Audit log</h2>
        <button style={styles.ghost} onClick={reload}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div style={styles.table}>
        {data?.entries?.length === 0 && <p style={styles.muted}>No audit entries.</p>}
        {data?.entries?.map((entry) => (
          <div key={entry.id} style={styles.row}>
            <div style={styles.rowMain}>
              <b>{entry.action}</b>
              <small>{entry.actor || 'system'} · {entry.entity_type} {entry.entity_id || ''}</small>
            </div>
            <small style={styles.muted}>{new Date(entry.created_at).toLocaleString('en-LK')}</small>
          </div>
        ))}
      </div>
    </PanelState>
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

function StatusBadge({ status }) {
  const style = statusStyle(status)
  return <span style={{ ...styles.badge, ...style }}>{String(status || '').replaceAll('_', ' ')}</span>
}

function statusStyle(status) {
  if (['PAID', 'VERIFIED', 'RECEIVED', 'DELIVERED', 'FULFILLED'].includes(status)) return { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }
  if (['AWAITING_PAYMENT', 'AWAITING_CONFIRMATION', 'PENDING', 'BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'OPEN', 'APPROVED', 'ORDERED'].includes(status)) return { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }
  if (['FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(status)) return { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
  return { background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }
}

const styles = {
  page: { minHeight: '100svh', background: '#F8FAFC', color: '#0F172A', fontFamily: "'Inter',sans-serif" },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '1rem clamp(1rem,4vw,3rem)', background: '#fff', borderBottom: '1px solid #E2E8F0' },
  brand: { display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: '1rem', fontWeight: 700, color: '#0F172A', textDecoration: 'none' },
  mark: { width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#16A34A,#0D9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' },
  markSm: { width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#16A34A,#0D9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  userBox: { display: 'flex', alignItems: 'center', gap: 12 },
  userMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 },
  logout: { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', background: '#fff', borderRadius: 10, padding: '0.45rem 0.75rem', cursor: 'pointer', fontWeight: 700, color: '#0F172A' },
  shell: { maxWidth: 1180, margin: '0 auto', padding: 'clamp(1rem,3vw,2rem) clamp(1rem,4vw,2rem)', display: 'flex', flexDirection: 'column', gap: '1rem' },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', background: '#fff', borderRadius: 999, padding: '0.5rem 0.9rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', color: '#0F172A' },
  tabActive: { background: '#0F172A', color: '#fff', border: '1px solid #0F172A' },
  content: { display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  h2: { fontSize: '1.2rem', margin: 0 },
  h3: { fontSize: '0.95rem', margin: '0.75rem 0 0' },
  ghost: { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', background: '#fff', borderRadius: 10, padding: '0.4rem 0.7rem', cursor: 'pointer', fontWeight: 700 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 },
  stat: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '0.85rem' },
  statValue: { display: 'block', fontSize: '1.15rem', fontWeight: 800 },
  statLabel: { fontSize: '0.68rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  table: { display: 'flex', flexDirection: 'column', border: '1px solid #E2E8F0', borderRadius: 14, background: '#fff', overflow: 'hidden' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '0.7rem 0.9rem', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' },
  rowMain: { display: 'flex', flexDirection: 'column', flex: '1 1 200px', lineHeight: 1.3 },
  rowActions: { display: 'flex', gap: 6, alignItems: 'center' },
  spacer: { width: 0 },
  badge: { padding: '0.25rem 0.6rem', borderRadius: 999, fontSize: '0.68rem', fontWeight: 800 },
  select: { border: '1px solid #CBD5E1', background: '#fff', borderRadius: 8, padding: '0.4rem 0.55rem', fontSize: '0.8rem', fontFamily: 'inherit' },
  smallInput: { border: '1px solid #CBD5E1', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '0.8rem', fontFamily: 'inherit', minWidth: 100 },
  tinyInput: { border: '1px solid #CBD5E1', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '0.8rem', fontFamily: 'inherit', width: 80 },
  bookForm: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.7rem', marginBottom: '0.5rem' },
  primaryBtnSm: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 0.8rem', fontWeight: 700, cursor: 'pointer' },
  confirm: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', borderRadius: 8, background: '#16A34A', color: '#fff', cursor: 'pointer' },
  reject: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', borderRadius: 8, background: '#DC2626', color: '#fff', cursor: 'pointer' },
  loginCard: { maxWidth: 400, margin: 'clamp(2.5rem,10vw,6rem) auto', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 20, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  loginTitle: { fontSize: '1.25rem', margin: '0 0 0.4rem' },
  loginForm: { width: '100%', display: 'flex', flexDirection: 'column', textAlign: 'left', marginTop: '1rem' },
  label: { fontSize: '0.76rem', fontWeight: 700, margin: '0.6rem 0 0.3rem' },
  input: { width: '100%', border: '1px solid #CBD5E1', borderRadius: 10, padding: '0.6rem 0.75rem', fontSize: '0.86rem', fontFamily: 'inherit' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 12, padding: '0.75rem 1.2rem', fontWeight: 700, cursor: 'pointer', marginTop: '1rem' },
  error: { display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 10, padding: '0.6rem 0.8rem', fontSize: '0.82rem', fontWeight: 600, marginTop: '0.75rem' },
  flash: { display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: '0.7rem 0.9rem', fontWeight: 600, fontSize: '0.85rem' },
  flashOk: { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' },
  flashError: { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' },
  muted: { color: '#64748B', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 },
  back: { color: '#0D9488', fontWeight: 700, textDecoration: 'none', fontSize: '0.85rem', marginTop: '1.25rem' },
}
