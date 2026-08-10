import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_SCRIPT = path.resolve(__dirname, '../../../../edge-gateway/scripts/gps_module/gps_reader.py');

const GPS_PORT = process.env.GPS_PORT || 'COM5';
const GPS_BAUD = process.env.GPS_BAUDRATE || '115200';
const TIMEOUT_MS = 10000;

let lastFix = null;
let lastFetch = 0;

function readGps() {
  return new Promise((resolve) => {
    execFile('python', [PYTHON_SCRIPT, GPS_PORT, GPS_BAUD], { timeout: TIMEOUT_MS }, (err, stdout) => {
      if (err) {
        resolve({ latitude: null, longitude: null, altitude: null, satellites: 0, error: err.message, live: false });
        return;
      }
      try {
        const data = JSON.parse(stdout.trim());
        const live = data.latitude != null && data.longitude != null;
        lastFix = live ? { ...data, live, fetched_at: new Date().toISOString() } : { ...data, live: false, fetched_at: new Date().toISOString() };
        lastFetch = Date.now();
        resolve(lastFix);
      } catch {
        resolve({ latitude: null, longitude: null, altitude: null, satellites: 0, error: 'Invalid GPS response', live: false });
      }
    });
  });
}

export async function getGpsLocation() {
  if (lastFix && (Date.now() - lastFetch) < 5000) return lastFix;
  return readGps();
}

export function getLastKnownLocation() {
  return lastFix || { latitude: null, longitude: null, altitude: null, satellites: 0, error: 'No GPS fix yet', live: false };
}
