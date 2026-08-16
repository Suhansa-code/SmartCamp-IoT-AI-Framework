import * as resourcesService from '../../services/resource/resources.js';

function actor(req) {
  return req.user?.username || req.user?.id || req.body?.recorded_by || 'STAFF';
}

export function listResources(req, res) {
  try {
    const { q, category, low_stock } = req.query;
    res.json(resourcesService.getAllResources({ q, category, low_stock }));
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function getResource(req, res) {
  try {
    res.json(resourcesService.getResourceById(Number(req.params.id)));
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function createResource(req, res) {
  try {
    const resource = resourcesService.createResource({ ...req.body, recorded_by: actor(req) });
    res.json({ success: true, resource });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function updateResource(req, res) {
  try {
    const resource = resourcesService.updateResource(Number(req.params.id), req.body);
    res.json({ success: true, resource });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function deactivateResource(req, res) {
  try {
    const resource = resourcesService.updateResource(Number(req.params.id), { status: 'INACTIVE' });
    res.json({ success: true, resource });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function createResourceUsage(req, res) {
  try {
    const result = resourcesService.recordResourceUsage({ ...req.body, recorded_by: actor(req) });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function listResourceUsage(req, res) {
  try {
    const { person_id, resource_id, meal, from, to, limit } = req.query;
    const result = resourcesService.getResourceUsage({ person_id, resource_id, meal, from, to, limit });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function getPersonResourceHistory(req, res) {
  try {
    const { days } = req.query;
    res.json(resourcesService.getPersonResourceHistory(Number(req.params.id), { days }));
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function getInventorySummary(req, res) {
  try {
    res.json(resourcesService.getInventorySummary());
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function getCategories(req, res) {
  try {
    res.json({ categories: resourcesService.getCategories() });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

export function getAuditLogs(req, res) {
  try {
    const { action, person_id, limit } = req.query;
    res.json(resourcesService.getAuditLogs({ action, person_id, limit }));
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}
