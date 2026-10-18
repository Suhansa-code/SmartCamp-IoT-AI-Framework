import * as inventory from '../../data/resources/inventory.repository.js';
import { getOverview } from '../../services/resources/campData.service.js';

const UNITS = new Set(['kg', 'L', 'mL']);
const MOVEMENT_TYPES = new Set(['received', 'issued', 'adjustment']);

function number(value, field, { min = 0, allowNegative = false } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (!allowNegative && parsed < min)) {
    throw new Error(`${field} must be a ${allowNegative ? 'valid' : `number of at least ${min}`}`);
  }
  return parsed;
}

function toBase(category, unit, value) {
  if (!UNITS.has(unit) || (category === 'food' && unit !== 'kg') || (category === 'water' && !['L', 'mL'].includes(unit))) {
    throw new Error('Food must use kg; water must use L or mL');
  }
  return unit === 'mL' ? value / 1000 : value;
}

function baseUnit(category) {
  if (!['food', 'water'].includes(category)) throw new Error('category must be food or water');
  return category === 'food' ? 'kg' : 'L';
}

function sendError(res, error, label) {
  console.error(`[Inventory] ${label} error:`, error);
  const status = error.statusCode || (error.code === '23505' ? 409 : 400);
  res.status(status).json({ error: error.message || 'Inventory request failed' });
}

export async function listInventory(req, res) {
  try {
    const page = Math.max(0, Number.parseInt(req.query.page, 10) || 0);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    res.json(await inventory.listItems({ ...req.query, page, limit }));
  } catch (error) {
    sendError(res, error, 'listInventory');
  }
}

export async function createInventoryItem(req, res) {
  try {
    const body = req.body ?? {};
    const resourceName = String(body.resource_name ?? '').trim();
    if (!resourceName) throw new Error('resource_name is required');
    const category = body.category;
    const unit = body.recorded_unit;
    const recordedAvailable = number(body.available_quantity, 'available_quantity');
    const available = toBase(category, unit, recordedAvailable);
    const minimum = toBase(category, unit, number(body.minimum_quantity ?? 0, 'minimum_quantity'));
    res.status(201).json(await inventory.createItem({
      resourceName,
      category,
      recordedUnit: unit,
      baseUnit: baseUnit(category),
      available,
      recordedAvailable,
      minimum,
      notes: body.notes,
      recordedBy: body.recorded_by,
    }));
  } catch (error) {
    sendError(res, error, 'createInventoryItem');
  }
}

export async function adjustInventoryItem(req, res) {
  try {
    const body = req.body ?? {};
    const movementType = body.movement_type;
    if (!MOVEMENT_TYPES.has(movementType)) throw new Error('movement_type must be received, issued, or adjustment');
    const recordedQuantityChange = number(body.quantity_change, 'quantity_change', { allowNegative: true });
    if (recordedQuantityChange === 0) throw new Error('quantity_change cannot be zero');
    const unit = body.recorded_unit;
    const category = body.category;
    let signedQuantity = toBase(category, unit, Math.abs(recordedQuantityChange));
    if (movementType === 'issued' || (movementType === 'adjustment' && recordedQuantityChange < 0)) signedQuantity *= -1;
    res.json(await inventory.adjustItem(req.params.id, {
      quantityChange: signedQuantity,
      recordedQuantityChange: movementType === 'issued' ? -Math.abs(recordedQuantityChange) : recordedQuantityChange,
      recordedUnit: unit,
      movementType,
      reason: body.reason,
      recordedBy: body.recorded_by,
    }));
  } catch (error) {
    sendError(res, error, 'adjustInventoryItem');
  }
}

export async function inventorySummary(_req, res) {
  try {
    res.json(await inventory.getSummary());
  } catch (error) {
    sendError(res, error, 'inventorySummary');
  }
}

export async function inventoryCategories(_req, res) {
  try {
    res.json(await inventory.getCategories());
  } catch (error) {
    sendError(res, error, 'inventoryCategories');
  }
}

export async function inventoryUsageTimeline(req, res) {
  try {
    const days = Math.min(365, Math.max(1, Number.parseInt(req.query.days, 10) || 30));
    res.json(await inventory.getUsageTimeline(days));
  } catch (error) {
    sendError(res, error, 'inventoryUsageTimeline');
  }
}

export async function inventoryPredictionDataset(_req, res) {
  try {
    const [items, summary] = await Promise.all([inventory.listForecastItems(), inventory.getSummary()]);
    const overview = getOverview();
    res.json({
      generated_at: new Date().toISOString(),
      household_features: overview.population,
      inventory_features: { items, summary },
      prediction: overview.prediction_tomorrow,
    });
  } catch (error) {
    sendError(res, error, 'inventoryPredictionDataset');
  }
}

export async function saveInventoryPredictionSnapshot(req, res) {
  try {
    const body = req.body ?? {};
    const snapshot = await inventory.savePredictionSnapshot({
      horizonDays: Math.min(90, Math.max(1, Number.parseInt(body.horizon_days, 10) || 1)),
      householdFeatures: body.household_features ?? getOverview().population,
      inventoryFeatures: body.inventory_features ?? { items: await inventory.listForecastItems() },
      prediction: body.prediction ?? getOverview().prediction_tomorrow,
    });
    res.status(201).json(snapshot);
  } catch (error) {
    sendError(res, error, 'saveInventoryPredictionSnapshot');
  }
}
