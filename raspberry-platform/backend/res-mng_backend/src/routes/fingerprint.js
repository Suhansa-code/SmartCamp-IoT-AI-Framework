// Fingerprint scan route — simulates R307 scanner integration.
// In production this calls the Python fingerprint daemon over a Unix socket.

const express = require('express');
const router = express.Router();
const { db } = require('../../db/database');

// POST /api/fingerprint/scan
// Triggers the scanner. In demo mode, picks a random pre-registered person
// 70% of the time to simulate a "match", 30% returns no match
// (so staff can run through a "new registration" flow).
router.post('/scan', async (req, res) => {
  // SIMULATION — replace with actual Python scanner bridge
  const random = Math.random();

  if (random < 0.7) {
    // Simulate match — pick random pre-registered person
    const person = db.prepare(`
      SELECT * FROM persons
      WHERE pre_registered = 1
      ORDER BY RANDOM() LIMIT 1
    `).get();

    if (person) {
      return res.json({ matched: true, person });
    }
  }

  // No match — staff must register new person
  return res.json({ matched: false });
});

module.exports = router;
