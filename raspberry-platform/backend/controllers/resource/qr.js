import * as qrService from '../../services/resource/qr.js';

export function resolveQr(req, res) {
  try {
    const { qr } = req.params;
    const result = qrService.resolveQR(qr);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function lookupQr(req, res) {
  try {
    const { qr } = req.params;
    res.json(qrService.lookupQR(qr));
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}
