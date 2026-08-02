import * as wristbandService from '../../services/resource/wristband.js';

export function getWristband(req, res) {
  try {
    const { barcode } = req.params;
    const result = wristbandService.getWristbandInfo(barcode);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}
