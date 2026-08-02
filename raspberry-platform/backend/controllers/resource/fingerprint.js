import * as fingerprintService from '../../services/resource/fingerprint.js';

export function scan(req, res) {
  const result = fingerprintService.scanFingerprint();
  res.json(result);
}

export function search(req, res) {
  try {
    const { q } = req.query;
    const results = fingerprintService.searchPersons(q);
    res.json({ results });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

export function link(req, res) {
  try {
    const { person_id } = req.body;
    if (!person_id) return res.status(400).json({ error: 'person_id is required' });
    const person = fingerprintService.linkFingerprint(person_id);
    res.json({ success: true, person });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}
