import * as distributeService from '../../services/resource/distribute.js';

export async function distribute(req, res) {
  try {
    const { barcode, resource_type, quantity } = req.body;
    if (!barcode || !resource_type) return res.status(400).json({ error: 'barcode and resource_type required' });

    const result = await distributeService.distributeResource(barcode, resource_type, quantity);
    res.json({ success: true, ...result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}
