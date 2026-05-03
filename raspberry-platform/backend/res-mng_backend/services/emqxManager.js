// EMQX HTTP Management API
// Registers each camp person as a unique MQTT client in EMQX's built-in auth database.
// Called once at registration — after this, the person can connect as their own client ID.

const https = require('https')
const fs    = require('fs')
const path  = require('path')

const EMQX_HOST       = process.env.EMQX_HOST       || 'i17140d1.ala.asia-southeast1.emqxsl.com'
const EMQX_API_KEY    = process.env.EMQX_API_KEY    || ''
const EMQX_API_SECRET = process.env.EMQX_API_SECRET || ''
const CA_CERT_PATH    = process.env.EMQX_CA_CERT    || path.join(__dirname, '../../emqxsl-ca.crt')

const API_BASE   = `https://${EMQX_HOST}:8443/api/v5`
const AUTH_SOURCE = 'password_based:built_in_database'

// ─────────────────────────────────────────────────────────────
// Internal HTTP helper (uses EMQX API key + secret as Basic auth)
// ─────────────────────────────────────────────────────────────
function apiRequest(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const creds = Buffer.from(`${EMQX_API_KEY}:${EMQX_API_SECRET}`).toString('base64')

    let ca
    try { ca = fs.readFileSync(CA_CERT_PATH) } catch (_) { /* proceed without pinning */ }

    const url  = new URL(`${API_BASE}${urlPath}`)
    const opts = {
      hostname: url.hostname,
      port:     Number(url.port) || 8443,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type':  'application/json',
      },
      ...(ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }),
    }

    const req = https.request(opts, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        let parsed = null
        try { parsed = raw ? JSON.parse(raw) : null } catch { parsed = raw }
        resolve({ ok: res.statusCode < 300, status: res.statusCode, body: parsed })
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

// Register a new person's MQTT credentials in EMQX.
// clientId  — unique ID e.g. "sc-person-42"
// password  — auto-generated, stored in persons table
const API_KEY_CONFIGURED = EMQX_API_KEY && !EMQX_API_KEY.startsWith('your_')

async function createMqttUser(clientId, password) {
  if (!API_KEY_CONFIGURED) {
    console.warn('[EMQX Manager] EMQX_API_KEY not configured — skipping user creation for', clientId)
    return { ok: false, skipped: true }
  }

  const result = await apiRequest('POST', `/authentication/${AUTH_SOURCE}/users`, {
    user_id:       clientId,
    password,
    is_superuser:  false,
  })

  if (result.ok) {
    console.log(`[EMQX Manager] Registered client: ${clientId}`)
  } else {
    // 409 = already exists (safe to ignore on retries)
    if (result.status !== 409) {
      console.warn(`[EMQX Manager] Could not register ${clientId} (HTTP ${result.status})`, result.body)
    }
  }
  return result
}

// Update password for an existing client (e.g. wristband re-issue)
async function updateMqttUser(clientId, newPassword) {
  if (!API_KEY_CONFIGURED) return { ok: false, skipped: true }

  return apiRequest('PUT', `/authentication/${AUTH_SOURCE}/users/${encodeURIComponent(clientId)}`, {
    password: newPassword,
  })
}

// Remove a person's credentials (camp discharge / cleanup)
async function deleteMqttUser(clientId) {
  if (!API_KEY_CONFIGURED) return { ok: false, skipped: true }

  const result = await apiRequest('DELETE', `/authentication/${AUTH_SOURCE}/users/${encodeURIComponent(clientId)}`)
  if (result.ok) console.log(`[EMQX Manager] Removed client: ${clientId}`)
  return result
}

// List all registered MQTT users (useful for the research dashboard)
async function listMqttUsers() {
  if (!API_KEY_CONFIGURED) return { ok: false, skipped: true }
  return apiRequest('GET', `/authentication/${AUTH_SOURCE}/users?page=1&limit=1000`)
}

module.exports = { createMqttUser, updateMqttUser, deleteMqttUser, listMqttUsers }
