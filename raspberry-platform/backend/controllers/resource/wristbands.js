import * as wristbandService from '../../services/resource/wristband.js';

function actor(req) {
  return req.user?.username || req.user?.id || req.body?.recorded_by || 'STAFF';
}

export function listWristbands(req, res) {
  try {
    const { q, status, assigned } = req.query;
    res.json(wristbandService.listWristbands({ q, status, assigned }));
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function getWristband(req, res) {
  try {
    res.json(wristbandService.getWristbandById(req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function createWristband(req, res) {
  try {
    const wristband = wristbandService.createWristband(req.body);
    res.json({ success: true, wristband });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function updateWristband(req, res) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status is required' });
    const wristband = wristbandService.updateWristbandStatus(req.params.id, status, { actor: actor(req) });
    res.json({ success: true, wristband });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function assignWristband(req, res) {
  try {
    const { person_id } = req.body;
    if (!person_id) return res.status(400).json({ success: false, message: 'person_id is required' });
    const wristband = wristbandService.assignWristband(req.params.id, person_id, { actor: actor(req) });
    res.json({ success: true, wristband });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function unassignWristband(req, res) {
  try {
    const wristband = wristbandService.unassignWristband(req.params.id, { actor: actor(req) });
    res.json({ success: true, wristband });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function getAssignmentHistory(req, res) {
  try {
    res.json({ history: wristbandService.getAssignmentHistory(req.params.id) });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function getAvailableWristbands(req, res) {
  try {
    res.json(wristbandService.getAvailableWristbands());
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export async function getWristbandQRCode(req, res) {
  try {
    const result = await wristbandService.generateWristbandQRCode(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function getWristbandStats(req, res) {
  try {
    res.json(wristbandService.getWristbandStats());
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function createWristbandsBatch(req, res) {
  try {
    const result = wristbandService.createWristbandsBatch(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export async function exportWristbandQRSheet(req, res) {
  try {
    const { status, limit } = req.query;
    const html = await wristbandService.generateWristbandQRSheet({ status, limit });
    res.type('html').send(html);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}
