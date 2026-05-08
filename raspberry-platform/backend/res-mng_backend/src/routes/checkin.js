// Check-in route — for pre-registered persons arriving at camp.
// If the person already has an MQTT client ID (registered via emqxManager),
// their check-in event is published under their own client connection.
// Pre-seeded demo persons without credentials fall back to the shared admin client.

const express = require('express')
const router  = express.Router()
const { db }  = require('../../db/database')
const saamp   = require('../../services/saampMqtt')
const emqx    = require('../../services/emqxManager')

function genPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

router.post('/', async (req, res) => {
  const { person_id } = req.body

  if (!person_id) {
    return res.status(400).json({ error: 'person_id required' })
  }

  const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(person_id)
  if (!person) {
    return res.status(404).json({ error: 'Person not found' })
  }

  // Insert check-in record
  db.prepare(`
    INSERT INTO camp_checkins (person_id, camp_day, is_new_arrival)
    VALUES (?, 1, 1)
  `).run(person_id)

  // Issue or reuse wristband
  let wristband = db.prepare(`
    SELECT * FROM wristbands
    WHERE person_id = ? AND is_active = 1
    ORDER BY issued_at DESC LIMIT 1
  `).get(person_id)

  if (!wristband) {
    const barcode = `WB${String(person_id).padStart(6, '0')}`
    db.prepare(`
      INSERT INTO wristbands (person_id, barcode) VALUES (?, ?)
    `).run(person_id, barcode)
    wristband = { barcode }
  }

  // If this person doesn't have MQTT credentials yet (e.g. pre-seeded demo data),
  // register them in EMQX now so they appear as their own client going forward.
  let clientId = person.mqtt_client_id
  let password = person.mqtt_password

  if (!clientId) {
    clientId = `sc-person-${person_id}`
    password = genPassword()
    await emqx.createMqttUser(clientId, password)
    db.prepare(`
      UPDATE persons SET mqtt_client_id = ?, mqtt_password = ? WHERE id = ?
    `).run(clientId, password, person_id)
  }

  // Publish check-in event as this person's own MQTT client
  const mqttResult = await saamp.publishAsClient(
    'smartcamp/registration/checkin',
    {
      event:             'checkin',
      person,
      wristband_barcode:  wristband.barcode,
      timestamp:          new Date().toISOString(),
    },
    clientId,
    password,
    'fingerprint_scanner',
    'checkin'
  )

  res.json({ person, wristband_barcode: wristband.barcode, mqtt: mqttResult })
})

module.exports = router
