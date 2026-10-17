import * as service from '../../services/resource/resource.service.js';

function normalizeWaterUnit(resource) {
  const name = String(resource.resource_name || '').toLowerCase();
  const unit = String(resource.unit || '').toLowerCase();
  // Camp water bottles hold one litre, so their numeric quantities need no conversion.
  return ['water', 'drinking water'].includes(name) && ['bottle', 'bottles'].includes(unit)
    ? { ...resource, unit: 'L' }
    : ['rice', 'vegetables'].includes(name) && ['portion', 'portions'].includes(unit)
      ? { ...resource, unit: 'kg' }
      : resource;
}

export async function listResources(req, res) {
  try {
    const { category, status, search, page = 0, limit = 20 } = req.query;
    const result = await service.getResourceInventory({
      category, status, search,
      page: parseInt(page, 10), limit: parseInt(limit, 10),
    });
    res.json({ ...result, data: result.data.map(normalizeWaterUnit) });
  } catch (err) {
    console.error('[Resource] listResources error:', err);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
}

export async function createResource(req, res) {
  try {
    const body = req.body ?? {};
    const resourceName = String(body.resource_name ?? '').trim();
    const category = String(body.category ?? '').trim().toLowerCase();
    const requestedUnit = String(body.unit ?? '').trim();
    const resourceKey = resourceName.toLowerCase();
    const requestedUnitKey = requestedUnit.toLowerCase();
    const unit = ['water', 'drinking water'].includes(resourceKey)
      && ['bottle', 'bottles'].includes(requestedUnitKey)
        ? 'L'
        : ['rice', 'vegetables'].includes(resourceKey)
          && ['portion', 'portions'].includes(requestedUnitKey)
            ? 'kg'
            : requestedUnit;
    const quantity = Number(body.quantity);
    const minimumThreshold = Number(body.minimum_threshold ?? 0);

    if (!resourceName || !category || !unit) {
      return res.status(400).json({ error: 'resource_name, category, and unit are required' });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be greater than zero' });
    }
    if (!Number.isFinite(minimumThreshold) || minimumThreshold < 0) {
      return res.status(400).json({ error: 'minimum_threshold cannot be negative' });
    }

    res.status(201).json(await service.createResource({
      resourceName, category, unit, quantity, minimumThreshold,
    }));
  } catch (err) {
    console.error('[Resource] createResource error:', err);
    res.status(500).json({ error: 'Failed to add resource donation' });
  }
}

export async function getSummary(_req, res) {
  try {
    const summary = await service.getResourceSummary();
    res.json(summary);
  } catch (err) {
    console.error('[Resource] getSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch resource summary' });
  }
}

export async function getUsageTimeline(req, res) {
  try {
    const { days = 30 } = req.query;
    const data = await service.getResourceUsageTimeline(parseInt(days, 10));
    res.json(data);
  } catch (err) {
    console.error('[Resource] getUsageTimeline error:', err);
    res.status(500).json({ error: 'Failed to fetch usage timeline' });
  }
}

export async function getPredictions(req, res) {
  try {
    const { limit = 20 } = req.query;
    const data = await service.getFloodPredictions(parseInt(limit, 10));
    res.json(data);
  } catch (err) {
    console.error('[Resource] getPredictions error:', err);
    res.status(500).json({ error: 'Failed to fetch flood predictions' });
  }
}

export async function getCategories(_req, res) {
  try {
    const categories = await service.getResourceCategories();
    res.json(categories);
  } catch (err) {
    console.error('[Resource] getCategories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
}
