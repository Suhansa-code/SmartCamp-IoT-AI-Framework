/**
 * Flood prediction service.
 * Runs the XGBoost flood model (Python) via the edge-gateway scripts and returns its JSON output.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Repo root = <backend>/src/services/disaster → up 5 levels
const repoRoot = path.resolve(__dirname, '../../../../../');

const isWindows = process.platform === 'win32';

// Locate the venv interpreter — supports both Unix (bin/) and Windows (Scripts/) layouts.
const VENV_PYTHON_CANDIDATES = isWindows
  ? ['Scripts/python.exe', 'bin/python']
  : ['bin/python', 'Scripts/python.exe'];

function findDefaultPython() {
  if (env.disaster.pythonExecutable) return env.disaster.pythonExecutable;
  const venvRoot = path.join(repoRoot, 'edge-gateway', 'scripts', '.venv');
  for (const candidate of VENV_PYTHON_CANDIDATES) {
    const fullPath = path.join(venvRoot, candidate);
    try {
      require('fs').accessSync(fullPath);
      return fullPath;
    } catch {
      // try next layout
    }
  }
  return path.join(venvRoot, VENV_PYTHON_CANDIDATES[0]);
}

const DEFAULT_PYTHON_PATH = findDefaultPython();

const DEFAULT_SCRIPT_PATH =
  env.disaster.floodModelScript ||
  path.join(repoRoot, 'edge-gateway', 'prediction-models', 'xgboost_model', 'predict_flood.py');

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildInput(camp) {
  const detail = camp?.detail || {};

  return {
    rainfall_mm: toNumber(detail.rain),
    longitude: toNumber(camp?.lng),
    latitude: toNumber(camp?.lat),
    altitude_m: toNumber(detail.elev),
    dem_elevation_m: toNumber(detail.elev),
    nearest_river_m: toNumber(detail.stDist ?? detail.upDist),
    gauging_station_current_water_level_m: toNumber(detail.wl),
    is_forecast: true,
  };
}

export function predictFloodForCamp(camp) {
  const pythonExecutable = DEFAULT_PYTHON_PATH;
  const scriptPath = DEFAULT_SCRIPT_PATH;

  const child = spawnSync(pythonExecutable, [scriptPath], {
    input: JSON.stringify(buildInput(camp)),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });

  if (child.error) {
    throw new Error(`Failed to execute flood model: ${child.error.message}`);
  }

  if (child.status !== 0) {
    const message = (child.stderr || child.stdout || 'Unknown model error').trim();
    throw new Error(`Flood model exited with code ${child.status}: ${message}`);
  }

  const output = (child.stdout || '').trim();
  if (!output) {
    throw new Error('Flood model returned no output');
  }

  return JSON.parse(output);
}