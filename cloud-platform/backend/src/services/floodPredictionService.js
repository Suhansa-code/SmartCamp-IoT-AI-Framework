import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_PYTHON_PATH = path.resolve(
  __dirname,
  '../../../../edge-gateway/scripts/OpenStreet API/.venv/Scripts/python.exe',
)
const DEFAULT_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../../edge-gateway/prediction-models/xgboost_model/predict_flood.py',
)

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildInput(camp) {
  const detail = camp?.detail || {}

  return {
    rainfall_mm: toNumber(detail.rain),
    longitude: toNumber(camp?.lng),
    latitude: toNumber(camp?.lat),
    altitude_m: toNumber(detail.elev),
    dem_elevation_m: toNumber(detail.elev),
    nearest_river_m: toNumber(detail.stDist ?? detail.upDist),
    gauging_station_current_water_level_m: toNumber(detail.wl),
    is_forecast: true,
  }
}

export function predictFloodForCamp(camp) {
  const pythonExecutable = process.env.DISASTER_PYTHON_EXECUTABLE || DEFAULT_PYTHON_PATH
  const scriptPath = process.env.DISASTER_FLOOD_MODEL_SCRIPT || DEFAULT_SCRIPT_PATH

  const child = spawnSync(pythonExecutable, [scriptPath], {
    input: JSON.stringify(buildInput(camp)),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  })

  if (child.error) {
    throw new Error(`Failed to execute flood model: ${child.error.message}`)
  }

  if (child.status !== 0) {
    const message = (child.stderr || child.stdout || 'Unknown model error').trim()
    throw new Error(`Flood model exited with code ${child.status}: ${message}`)
  }

  const output = (child.stdout || '').trim()
  if (!output) {
    throw new Error('Flood model returned no output')
  }

  return JSON.parse(output)
}