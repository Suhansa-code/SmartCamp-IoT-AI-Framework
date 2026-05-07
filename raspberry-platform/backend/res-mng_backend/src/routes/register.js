// Registration route
// Creates person + wristband, registers them as a unique MQTT client in EMQX,
// then publishes the registration event AS that person's own client connection.

const express = require('express')
const router  = express.Router()
const { db }  = require('../../db/database')
const saamp   = require('../../services/saampMqtt')
const emqx    = require('../../services/emqxManager')

// Generate a random alphanumeric password (16 chars)
function genPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

router.post('/', async (req, res) => {
  const {
    full_name, age, gender, person_type, family_size,
    is_pregnant, has_chronic_illness, medical_notes,
  } = req.body

  if (!full_name || !age) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const fpId        = `FP_${Date.now()}`
  const familyUnitId = `FAM_${Date.now()}`

  // ── 1. Insert person ──────────────────────────────────────────
  const result = db.prepare(`
    INSERT INTO persons
    (fingerprint_id, full_name, age, gender, person_type, family_unit_id, family_size,
     is_pregnant, has_chronic_illness, medical_notes, pre_registered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    fpId, full_name, parseInt(age), gender || 'M', person_type || 'refugee', familyUnitId,
    parseInt(family_size) || 1,
    is_pregnant || 0, has_chronic_illness || 0, medical_notes || ''
  )

  const personId = result.lastInsertRowid

  // ── 2. Auto check-in ─────────────────────────────────────────
  db.prepare(`
    INSERT INTO camp_checkins (person_id, camp_day, is_new_arrival)
    VALUES (?, 1, 1)
  `).run(personId)

  // ── 3. Issue wristband ───────────────────────────────────────
  const barcode = `WB${String(personId).padStart(6, '0')}`
  db.prepare(`
    INSERT INTO wristbands (person_id, barcode) VALUES (?, ?)
  `).run(personId, barcode)

  // ── 4. Create unique EMQX MQTT client for this person ────────
  // clientId format: sc-person-{id}  (visible in EMQX client list)
  const clientId = `sc-person-${personId}`
  const password = genPassword()

  await emqx.createMqttUser(clientId, password)

  db.prepare(`
    UPDATE persons SET mqtt_client_id = ?, mqtt_password = ? WHERE id = ?
  `).run(clientId, password, personId)

  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId)

  // ── 5. Publish registration event AS this person's MQTT client ─
  // EMQX will now log this under sc-person-{id}, not the shared admin client.
  // QoS 2 by default (CRITICAL); SAAMP degrades to 1/0 if network is poor.
  const mqttResult = await saamp.publishAsClient(
    'smartcamp/registration/new',
    {
      event:            'new_registration',
      person,
      wristband_barcode: barcode,
      timestamp:        new Date().toISOString(),
    },
    clientId,
    password,
    'fingerprint_scanner',
    'new_registration'
  )

  res.json({ person, wristband_barcode: barcode, mqtt: mqttResult })
})

module.exports = router
