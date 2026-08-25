import * as fingerprintService from '../../services/resource/fingerprint.js';
import { subscribe } from '../../services/resource/fingerprint-events.js';

function fail(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

export function scan(req, res) {
  try {
    const { slot, fingerId } = req.body || {};
    res.json(fingerprintService.scanFingerprint({ slot: slot ?? fingerId }));
  } catch (err) {
    fail(res, err);
  }
}

export function enroll(req, res) {
  try {
    const { person_id, slot } = req.body || {};
    res.json(fingerprintService.startEnrollment({ person_id, slot }));
  } catch (err) {
    fail(res, err);
  }
}

export function confirmEnroll(req, res) {
  try {
    res.json(fingerprintService.confirmEnrollment(req.body || {}));
  } catch (err) {
    fail(res, err);
  }
}

export function cancelEnroll(req, res) {
  try {
    res.json(fingerprintService.cancelEnrollment());
  } catch (err) {
    fail(res, err);
  }
}

export function status(req, res) {
  try {
    res.json(fingerprintService.getStatus());
  } catch (err) {
    fail(res, err);
  }
}

export function nextSlot(req, res) {
  try {
    res.json({ slot: fingerprintService.nextFreeSlot() });
  } catch (err) {
    fail(res, err);
  }
}

export function search(req, res) {
  try {
    res.json({ results: fingerprintService.searchPersons(req.query.q) });
  } catch (err) {
    fail(res, err);
  }
}

export function link(req, res) {
  try {
    const { person_id, slot, finger_id } = req.body || {};
    if (!person_id) return res.status(400).json({ error: 'person_id is required' });
    const person = fingerprintService.linkFingerprint(person_id, slot ?? finger_id);
    res.json({ success: true, person });
  } catch (err) {
    fail(res, err);
  }
}

export function unlink(req, res) {
  try {
    const { person_id } = req.body || {};
    if (!person_id) return res.status(400).json({ error: 'person_id is required' });
    res.json({ success: true, person: fingerprintService.unlinkFingerprint(person_id) });
  } catch (err) {
    fail(res, err);
  }
}

/** SSE stream of live sensor events — scan results, enrollment progress, link state. */
export function events(req, res) {
  subscribe(req, res);
}
