// Resource domain data — mock inventory, usage timeline, predictions, and map locations.
// Single source of truth for the resource pages when in mock mode.

import { CAMPS } from './disaster.data'

// ── Resource Inventory (mock) ──────────────────────────────────────────────

export const MOCK_RESOURCES = [
  { id: 1, resource_name: 'Drinking Water', category: 'water', unit: 'litres', total_quantity: 50000, available_quantity: 32500, minimum_threshold: 10000, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 2, resource_name: 'Cooked Rice', category: 'food', unit: 'kg', total_quantity: 8000, available_quantity: 3200, minimum_threshold: 2000, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 3, resource_name: 'Dal Curry', category: 'food', unit: 'kg', total_quantity: 3000, available_quantity: 850, minimum_threshold: 1000, status: 'LOW', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 4, resource_name: 'Bread Loaves', category: 'food', unit: 'pieces', total_quantity: 12000, available_quantity: 4800, minimum_threshold: 3000, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 5, resource_name: 'OR Salts', category: 'medical', unit: 'packets', total_quantity: 4000, available_quantity: 1600, minimum_threshold: 1000, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 6, resource_name: 'First Aid Kits', category: 'medical', unit: 'kits', total_quantity: 500, available_quantity: 180, minimum_threshold: 100, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 7, resource_name: 'Blankets', category: 'shelter', unit: 'pieces', total_quantity: 3000, available_quantity: 1200, minimum_threshold: 500, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 8, resource_name: 'Tarpaulins', category: 'shelter', unit: 'pieces', total_quantity: 1500, available_quantity: 420, minimum_threshold: 300, status: 'LOW', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 9, resource_name: 'Soap Bars', category: 'hygiene', unit: 'pieces', total_quantity: 8000, available_quantity: 5200, minimum_threshold: 2000, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 10, resource_name: 'Sanitary Pads', category: 'hygiene', unit: 'packets', total_quantity: 2000, available_quantity: 340, minimum_threshold: 500, status: 'CRITICAL', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 11, resource_name: 'Mosquito Nets', category: 'shelter', unit: 'pieces', total_quantity: 2500, available_quantity: 1800, minimum_threshold: 500, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 12, resource_name: 'Paracetamol', category: 'medical', unit: 'tablets', total_quantity: 10000, available_quantity: 4500, minimum_threshold: 2000, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 13, resource_name: 'Bandages', category: 'medical', unit: 'rolls', total_quantity: 1500, available_quantity: 120, minimum_threshold: 300, status: 'CRITICAL', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 14, resource_name: 'Cooking Gas', category: 'other', unit: 'kg', total_quantity: 2000, available_quantity: 880, minimum_threshold: 400, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 15, resource_name: 'Dry Rations', category: 'food', unit: 'kg', total_quantity: 6000, available_quantity: 2100, minimum_threshold: 1500, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 16, resource_name: 'Baby Formula', category: 'food', unit: 'tins', total_quantity: 800, available_quantity: 95, minimum_threshold: 200, status: 'CRITICAL', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 17, resource_name: 'Shoes', category: 'other', unit: 'pairs', total_quantity: 1200, available_quantity: 680, minimum_threshold: 200, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
  { id: 18, resource_name: 'Towels', category: 'hygiene', unit: 'pieces', total_quantity: 2000, available_quantity: 1100, minimum_threshold: 400, status: 'AVAILABLE', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T06:00:00Z' },
]

// ── Resource Summary (derived from MOCK_RESOURCES) ─────────────────────────

export function computeMockSummary(resources = MOCK_RESOURCES) {
  const total = resources.length
  const totalQuantity = resources.reduce((s, r) => s + r.total_quantity, 0)
  const availableQuantity = resources.reduce((s, r) => s + r.available_quantity, 0)
  const belowThreshold = resources.filter((r) => r.available_quantity <= r.minimum_threshold).length
  const availableCount = resources.filter((r) => r.status === 'AVAILABLE').length
  const lowCount = resources.filter((r) => r.status === 'LOW').length
  const criticalCount = resources.filter((r) => r.status === 'CRITICAL').length
  const unavailableCount = resources.filter((r) => r.status === 'UNAVAILABLE').length

  const byCategory = {}
  resources.forEach((r) => {
    const cat = r.category || 'other'
    if (!byCategory[cat]) byCategory[cat] = { category: cat, count: 0, total_quantity: 0, available_quantity: 0 }
    byCategory[cat].count++
    byCategory[cat].total_quantity += r.total_quantity
    byCategory[cat].available_quantity += r.available_quantity
  })

  return {
    total_resources: total,
    total_quantity: totalQuantity,
    available_quantity: availableQuantity,
    below_threshold: belowThreshold,
    available_count: availableCount,
    low_count: lowCount,
    critical_count: criticalCount,
    unavailable_count: unavailableCount,
    by_category: Object.values(byCategory),
  }
}

// ── Usage Timeline (mock) ──────────────────────────────────────────────────

function generateMockTimeline() {
  const categories = ['food', 'water', 'medical', 'hygiene', 'shelter']
  const baseValues = { food: 320, water: 850, medical: 60, hygiene: 90, shelter: 40 }
  const data = []
  const now = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().slice(0, 10)

    categories.forEach((cat) => {
      const base = baseValues[cat]
      const noise = Math.sin(i * 0.7) * base * 0.15 + Math.cos(i * 1.3) * base * 0.1
      const weekend = (date.getDay() === 0 || date.getDay() === 6) ? base * 0.2 : 0
      data.push({
        date: dateStr,
        category: cat,
        total_used: Math.round(base + noise + weekend),
      })
    })
  }

  return data
}

export const MOCK_TIMELINE = generateMockTimeline()

// ── Flood Predictions (mock) ───────────────────────────────────────────────

export const MOCK_PREDICTIONS = [
  { id: 1, prediction_id: 'FP-MOCK-001', latitude: 6.03, longitude: 80.22, rainfall: 45, elevation: 4, river_distance: 0.8, flood_probability: 0.82, flood_category: 'HIGH', forecast_hours: 24, model_version: 'v2.1', predicted_at: new Date().toISOString() },
  { id: 2, prediction_id: 'FP-MOCK-002', latitude: 6.68, longitude: 80.40, rainfall: 62, elevation: 18, river_distance: 0.3, flood_probability: 0.91, flood_category: 'HIGH', forecast_hours: 12, model_version: 'v2.1', predicted_at: new Date().toISOString() },
  { id: 3, prediction_id: 'FP-MOCK-003', latitude: 7.72, longitude: 81.68, rainfall: 18, elevation: 2, river_distance: 1.4, flood_probability: 0.45, flood_category: 'MEDIUM', forecast_hours: 48, model_version: 'v2.1', predicted_at: new Date().toISOString() },
  { id: 4, prediction_id: 'FP-MOCK-004', latitude: 6.92, longitude: 79.86, rainfall: 28, elevation: 8, river_distance: 0.5, flood_probability: 0.58, flood_category: 'MEDIUM', forecast_hours: 36, model_version: 'v2.1', predicted_at: new Date().toISOString() },
  { id: 5, prediction_id: 'FP-MOCK-005', latitude: 5.97, longitude: 80.54, rainfall: 8, elevation: 6, river_distance: 2.1, flood_probability: 0.15, flood_category: 'LOW', forecast_hours: 72, model_version: 'v2.1', predicted_at: new Date().toISOString() },
]

// ── Resource Locations (for the map — derived from CAMPS) ──────────────────

export const MOCK_RESOURCE_LOCATIONS = CAMPS.map((camp) => ({
  id: camp.id,
  name: camp.name,
  lat: camp.lat,
  lng: camp.lng,
  status: camp.status,
  displaced: camp.displaced,
  capacity: camp.capacity,
  aid: camp.aid,
  type: camp.type,
  code: camp.code,
}))

// ── Mock categories list ───────────────────────────────────────────────────

export const MOCK_CATEGORIES = [...new Set(MOCK_RESOURCES.map((r) => r.category))].sort()

// ── Status color map (matches STATUS_COLORS in ResourcePanel) ──────────────

export const MOCK_STATUS_COLORS = {
  AVAILABLE: '#16A34A',
  LOW: '#D97706',
  CRITICAL: '#DC2626',
  UNAVAILABLE: '#64748B',
}
