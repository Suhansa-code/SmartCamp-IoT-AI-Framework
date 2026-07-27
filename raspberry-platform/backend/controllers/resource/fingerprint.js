import * as fingerprintService from '../../services/resource/fingerprint.js';

export function scan(req, res) {
  const result = fingerprintService.scanFingerprint();
  res.json(result);
}
