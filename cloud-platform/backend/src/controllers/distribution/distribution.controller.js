import * as service from '../../services/distribution/distribution.service.js';

export async function listDistributions(req, res) {
  try {
    const { campId, resourceType, startDate, endDate, search, page = 0, limit = 20 } = req.query;
    const result = await service.getDistributions({
      campId, resourceType, startDate, endDate, search,
      page: parseInt(page, 10), limit: parseInt(limit, 10),
    });
    res.json(result);
  } catch (err) {
    console.error('[Distribution] listDistributions error:', err);
    res.status(500).json({ error: 'Failed to fetch distributions' });
  }
}

export async function getSummary(req, res) {
  try {
    const { campId } = req.query;
    const summary = await service.getDistributionSummary(campId || null);
    res.json(summary);
  } catch (err) {
    console.error('[Distribution] getSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch distribution summary' });
  }
}

export async function getByResourceType(req, res) {
  try {
    const { campId } = req.query;
    const data = await service.getDistributionByResourceType(campId || null);
    res.json(data);
  } catch (err) {
    console.error('[Distribution] getByResourceType error:', err);
    res.status(500).json({ error: 'Failed to fetch resource type breakdown' });
  }
}

export async function getTimeline(req, res) {
  try {
    const { campId, days = 30 } = req.query;
    const data = await service.getDistributionTimeline(campId || null, parseInt(days, 10));
    res.json(data);
  } catch (err) {
    console.error('[Distribution] getTimeline error:', err);
    res.status(500).json({ error: 'Failed to fetch distribution timeline' });
  }
}

export async function getCampList(_req, res) {
  try {
    const camps = await service.getCampList();
    res.json(camps);
  } catch (err) {
    console.error('[Distribution] getCampList error:', err);
    res.status(500).json({ error: 'Failed to fetch camp list' });
  }
}

export async function getResourceTypes(_req, res) {
  try {
    const types = await service.getResourceTypes();
    res.json(types);
  } catch (err) {
    console.error('[Distribution] getResourceTypes error:', err);
    res.status(500).json({ error: 'Failed to fetch resource types' });
  }
}
