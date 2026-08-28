import * as service from '../../services/resource/resource.service.js';

export async function listResources(req, res) {
  try {
    const { category, status, search, page = 0, limit = 20 } = req.query;
    const result = await service.getResourceInventory({
      category, status, search,
      page: parseInt(page, 10), limit: parseInt(limit, 10),
    });
    res.json(result);
  } catch (err) {
    console.error('[Resource] listResources error:', err);
    res.status(500).json({ error: 'Failed to fetch resources' });
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
