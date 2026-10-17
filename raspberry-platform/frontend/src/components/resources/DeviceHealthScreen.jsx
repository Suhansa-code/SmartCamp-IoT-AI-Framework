import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Satellite, Thermometer, Droplets, Radio, RefreshCw, Activity, MapPin, ArrowLeft, Wifi, WifiOff, CloudRain, Fingerprint } from 'lucide-react';
import { COLORS, SHADOW_CARD, TONE } from '../../lib/tokens';
import { API } from '../ui/config';
import useFingerprintDevice from '../../lib/useFingerprintDevice';

const CONNECTED_TONE = 'brand';
const DISCONNECTED_TONE = 'danger';

/* ------------------------------------------------------------------ */
/*  POLLING CONFIG                                                      */
/* ------------------------------------------------------------------ */

const POLL_INTERVAL_MS = 10000;

/* ------------------------------------------------------------------ */
/*  LOCAL PRIMITIVES                                                    */
/* ------------------------------------------------------------------ */

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl bg-white p-4 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

function IconTile({ icon: Icon, tone = "brand", size = "lg" }) {
  const t = TONE[tone] || TONE.brand;
  const dims = size === "sm" ? "w-8 h-8" : size === "md" ? "w-9 h-9" : "w-11 h-11 sm:w-12 sm:h-12";
  return (
    <div className={`${dims} rounded-xl flex items-center justify-center shrink-0 border`} style={{ backgroundColor: t.bg, borderColor: t.border }}>
      <Icon className={size === "lg" ? "w-6 h-6" : "w-4 h-4"} style={{ color: t.color }} strokeWidth={1.7} />
    </div>
  );
}

function Chip({ children, tone = 'neutral' }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border"
      style={{ color: t.color, backgroundColor: t.bg, borderColor: t.border }}
    >
      {children}
    </span>
  );
}

function DataRow({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</p>
      <p className={`${mono ? 'text-[12px]' : 'text-[12px]'} font-medium mt-0.5`} style={{ color: COLORS.ink }}>{value ?? '—'}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SENSOR CARD — accepts `connected` as explicit prop                  */
/* ------------------------------------------------------------------ */

function SensorCard({ icon: Icon, name, description, connected, lastUpdated, chip, children }) {
  const tone = chip?.tone ?? (connected ? CONNECTED_TONE : DISCONNECTED_TONE);
  const chipLabel = chip?.label ?? (connected ? 'Connected' : 'Disconnected');

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="h-full">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3">
            <IconTile icon={Icon} tone={tone} />
            <div>
              <h3 className="text-[13px] sm:text-[14px] font-medium leading-tight" style={{ color: COLORS.ink }}>{name}</h3>
              <p className="text-[11px] mt-0.5" style={{ color: COLORS.muted }}>{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:self-start">
            <span className={`w-2 h-2 rounded-full ${connected ? 'animate-pulse' : ''}`} style={{ backgroundColor: TONE[tone].color }} />
            <Chip tone={tone}>{chipLabel}</Chip>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t" style={{ borderColor: COLORS.hairline }}>
          {children}
        </div>

        {lastUpdated && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: COLORS.hairline }}>
            <p className="text-[11px]" style={{ color: COLORS.muted }}>
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  DEVICE STATUS CARD (gateway connectivity)                           */
/* ------------------------------------------------------------------ */

function DeviceStatusCard({ device }) {
  const status = device?.status || 'unknown';
  const connected = status === 'connected';
  const tone = connected ? CONNECTED_TONE : DISCONNECTED_TONE;
  const Icon = connected ? Wifi : WifiOff;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="h-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3">
            <IconTile icon={Icon} tone={connected ? 'brand' : 'danger'} />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <div>
                <h3 className="text-[13px] sm:text-[14px] font-medium leading-tight" style={{ color: COLORS.ink }}>Edge Gateway</h3>
                <p className="text-[11px] mt-0.5" style={{ color: COLORS.muted }}>{device ? 'Raspberry Pi device connectivity' : 'Device is not connected'}</p>
              </div>
              {device?.id && (
                <div className="hidden sm:flex items-center gap-4 pl-4" style={{ borderLeft: `1px solid ${COLORS.hairline}` }}>
                  <DataRow label="Device ID" value={device.id} mono />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:self-center">
            <span className={`w-2 h-2 rounded-full ${connected ? 'animate-pulse' : ''}`} style={{ backgroundColor: TONE[tone].color }} />
            <Chip tone={tone}>{connected ? 'Connected' : 'Disconnected'}</Chip>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  GPS CARD                                                            */
/* ------------------------------------------------------------------ */

function GpsCard({ sensor }) {
  const connected = !!sensor?.connected;
  const noFix = !connected && sensor?.status === 'no_fix';
  const [geo, setGeo] = useState({ name: '', district: '', loading: false, done: false });

  useEffect(() => {
    if (!connected || sensor?.latitude == null || sensor?.longitude == null) return;

    const backendName = sensor?.location_name || '';
    const backendDistrict = sensor?.district || '';
    const looksLikeCoords = /^-?\d+\.?\d*\s*[,]\s*-?\d+\.?\d*$/.test(backendName);
    if (backendName && !looksLikeCoords) {
      setGeo({ name: backendName, district: backendDistrict, loading: false, done: true });
      return;
    }

    let cancelled = false;
    setGeo(g => ({ ...g, loading: true }));
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${sensor.latitude}&lon=${sensor.longitude}&zoom=14`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept-Language': 'en' },
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const addr = data.address || {};
        const name = addr.village || addr.town || addr.city || addr.hamlet || addr.suburb || addr.county || '';
        const district = addr.district || addr.state_district || addr.state || '';
        setGeo({ name, district, loading: false, done: true });
      })
      .catch(() => { if (!cancelled) setGeo({ name: '', district: '', loading: false, done: true }); });
    return () => { cancelled = true; };
  }, [connected, sensor?.latitude, sensor?.longitude, sensor?.location_name, sensor?.district]);

  return (
    <SensorCard
      icon={Satellite}
      name="GPS Sensor"
      description="Camp location & disaster-response tracking"
      connected={connected}
      lastUpdated={sensor?.timestamp}
      chip={noFix ? { label: 'No Fix', tone: 'warning' } : undefined}
    >
      {connected ? (
        <>
          <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-3">
            <DataRow label="Latitude" value={sensor?.latitude != null ? `${Number(sensor.latitude).toFixed(4)}°` : '—'} mono />
            <DataRow label="Longitude" value={sensor?.longitude != null ? `${Number(sensor.longitude).toFixed(4)}°` : '—'} mono />
            <DataRow label="Altitude" value={sensor?.altitude != null ? `${sensor.altitude} m` : '—'} mono />
            <DataRow label="Satellites" value={sensor?.satellites ?? '—'} mono />
          </div>

          <div className="mt-3 pt-3 border-t flex items-start gap-2" style={{ borderColor: COLORS.hairline }}>
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: COLORS.brand }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: COLORS.muted }}>Location</p>
              {geo.loading ? (
                <p className="text-[12.5px] font-medium mt-0.5" style={{ color: COLORS.muted }}>Fetching location…</p>
              ) : geo.name ? (
                <>
                  <p className="text-[12.5px] font-medium mt-0.5 break-words" style={{ color: COLORS.ink }}>
                    {geo.name}
                    {sensor?.is_mock && <span className="text-[11px] ml-1" style={{ color: TONE.warning.color }}>(Mock)</span>}
                  </p>
                  {geo.district && <p className="text-[11px] mt-0.5 break-words" style={{ color: COLORS.muted }}>{geo.district}</p>}
                </>
              ) : (
                <p className="text-[12.5px] font-medium mt-0.5" style={{ color: COLORS.muted }}>Location unavailable</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-[12.5px]" style={{ color: noFix ? TONE.warning.color : COLORS.muted }}>{sensor?.error ?? 'Device is not connected'}</p>
      )}
    </SensorCard>
  );
}

/* ------------------------------------------------------------------ */
/*  TEMPERATURE CARD                                                    */
/* ------------------------------------------------------------------ */

function TemperatureCard({ sensor }) {
  const connected = !!sensor?.connected;

  return (
    <SensorCard icon={Thermometer} name="Temperature Sensor" description="DHT11 via ESP32 USB serial" connected={connected} lastUpdated={sensor?.timestamp}>
      {connected ? (
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-[32px] leading-none" style={{ color: COLORS.ink }}>
            {sensor?.value != null ? Number(sensor.value).toFixed(1) : '—'}
          </span>
          <span className="text-[14px]" style={{ color: COLORS.muted }}>°C</span>
        </div>
      ) : (
        <p className="text-[12px]" style={{ color: COLORS.muted }}>Device is not connected</p>
      )}
      {sensor?.error && !connected && (
        <p className="text-[11px] mt-2" style={{ color: TONE.danger.color }}>{sensor.error}</p>
      )}
    </SensorCard>
  );
}

/* ------------------------------------------------------------------ */
/*  HUMIDITY CARD                                                       */
/* ------------------------------------------------------------------ */

function HumidityCard({ sensor }) {
  const connected = !!sensor?.connected;

  return (
    <SensorCard icon={Droplets} name="Humidity Sensor" description="DHT11 relative humidity via ESP32" connected={connected} lastUpdated={sensor?.timestamp}>
      {connected ? (
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-[32px] leading-none" style={{ color: COLORS.ink }}>
            {sensor?.value != null ? Number(sensor.value).toFixed(1) : '—'}
          </span>
          <span className="text-[14px]" style={{ color: COLORS.muted }}>%</span>
        </div>
      ) : (
        <p className="text-[12px]" style={{ color: COLORS.muted }}>Device is not connected</p>
      )}
      {sensor?.error && !connected && (
        <p className="text-[11px] mt-2" style={{ color: TONE.danger.color }}>{sensor.error}</p>
      )}
    </SensorCard>
  );
}

/* ------------------------------------------------------------------ */
/*  RAINFALL CARD                                                       */
/* ------------------------------------------------------------------ */

function RainfallCard({ sensor }) {
  const connected = !!sensor?.connected;

  return (
    <SensorCard icon={CloudRain} name="Rainfall Sensor" description="YL-83 rain gauge via ESP32" connected={connected} lastUpdated={sensor?.timestamp}>
      {connected ? (
        <>
          <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-3">
            <DataRow label="Analog Value" value={sensor?.rain_analog ?? '—'} mono />
            <DataRow label="Digital" value={sensor?.rain_digital === 1 ? 'Wet' : 'Dry'} />
            <DataRow label="Status" value={sensor?.rain_status ?? '—'} />
            <DataRow label="Wetness" value={sensor?.wetness_level ?? '—'} />
          </div>

          <div className="mt-3 pt-3 border-t flex items-start gap-2" style={{ borderColor: COLORS.hairline }}>
            <CloudRain className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: COLORS.brand }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: COLORS.muted }}>Current Conditions</p>
              <p className="text-[12px] font-medium mt-0.5" style={{ color: COLORS.ink }}>
                {sensor?.rain_status === 'RAIN_DETECTED' ? 'Rain detected' : 'No rain'}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-[12.5px]" style={{ color: COLORS.muted }}>Device is not connected</p>
      )}
      {sensor?.error && !connected && (
        <p className="text-[11px] mt-2" style={{ color: TONE.danger.color }}>{sensor.error}</p>
      )}
    </SensorCard>
  );
}

/* ------------------------------------------------------------------ */
/*  FINGERPRINT CARD                                                    */
/* ------------------------------------------------------------------ */

function FingerprintCard({ deviceConnected }) {
  const { status } = useFingerprintDevice();
  const connected = deviceConnected;

  return (
    <SensorCard icon={Fingerprint} name="Fingerprint Sensor" description="Biometric identification for camp access" connected={connected}>
      {!status ? (
        <p className="text-[12.5px]" style={{ color: COLORS.muted }}>Device is not connected</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-3">
            <DataRow label="Enrolled" value={status.linked_count} mono />
            <DataRow label="Interface" value={status.device?.port ?? '—'} mono />
            <DataRow label="Mode" value={status.simulation ? 'Simulation' : 'Hardware'} />
            <DataRow label="Enabled" value={status.enabled ? 'Yes' : 'No'} />
          </div>

          <div className="mt-3 pt-3 border-t flex items-start gap-2" style={{ borderColor: COLORS.hairline }}>
            <Fingerprint className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: COLORS.brand }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: COLORS.muted }}>System Status</p>
              <p className="text-[12px] font-medium mt-0.5 break-words" style={{ color: COLORS.ink }}>
                {connected
                  ? (status.linked_count > 0 ? 'Operational — ready for scanning' : 'Connected — no fingerprints enrolled')
                  : (status.enabled ? 'Scanner unreachable' : 'Scanner disabled')}
              </p>
            </div>
          </div>
        </>
      )}
    </SensorCard>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN SCREEN                                                         */
/* ------------------------------------------------------------------ */

export default function DeviceHealthScreen() {
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastAt, setLastAt] = useState(null);
  const [pollError, setPollError] = useState(null);
  const intervalRef = useRef(null);

  const { deviceConnected: fpConnected } = useFingerprintDevice();

  const fetchDeviceStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/disaster/device-status`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const data = await res.json();
      setDeviceStatus(data);
      setLastAt(new Date());
      setPollError(null);
    } catch (err) {
      setPollError(err.message);
      setDeviceStatus(null);
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchDeviceStatus();
    intervalRef.current = setInterval(fetchDeviceStatus, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchDeviceStatus]);

  const device = deviceStatus?.device ?? null;
  const sensors = deviceStatus?.sensors ?? {};

  const gatewayConnected = device?.status === 'connected';
  const gpsConnected = !!sensors.gps?.connected;
  const tempConnected = !!sensors.temperature?.connected;
  const humConnected = !!sensors.humidity?.connected;
  const rainConnected = !!sensors.rainfall?.connected;
  const connectedSensors = [gpsConnected, tempConnected, humConnected, rainConnected, fpConnected].filter(Boolean).length;
  const disconnectedSensors = [gpsConnected, tempConnected, humConnected, rainConnected, fpConnected].filter(c => !c).length;



  return (
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>
      <div className="sm:px-5 lg:px-6 sm:py-5 space-y-4 sm:space-y-6">

        {/* ================= TITLE ROW ================= */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: deviceStatus ? COLORS.muted : TONE.danger.color }}>
              {device?.id ?? 'Device is not connected'}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="font-medium text-[26px] sm:text-[32px] leading-[1.1] tracking-tight">Device Health</h1>
              {loading && <Chip tone="neutral">Loading…</Chip>}
              {pollError && <Chip tone="danger">Retry</Chip>}
            </div>
            <p className="text-[12px] mt-2" style={{ color: COLORS.muted }}>Real-time Edge Gateway sensor &amp; connectivity status</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border outline-none transition-colors duration-200"
              style={{ color: COLORS.body, backgroundColor: 'transparent', borderColor: COLORS.line }}
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
              Back
            </button>
            <button
              onClick={fetchDeviceStatus}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium rounded-lg border outline-none transition-colors duration-200"
              style={{ color: COLORS.brand, backgroundColor: `${COLORS.brand}0F`, borderColor: `${COLORS.brand}33` }}
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
              Refresh
            </button>
          </div>
        </div>

        {/* ================= SUMMARY STRIP ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: 'Gateway', value: gatewayConnected ? 'Online' : 'Offline', tone: gatewayConnected ? 'brand' : 'danger', icon: gatewayConnected ? Wifi : WifiOff },
            { label: 'Connected Sensors', value: connectedSensors, tone: 'brand', icon: Activity },
            { label: 'Disconnected', value: disconnectedSensors, tone: disconnectedSensors > 0 ? 'danger' : 'brand', icon: Activity },
          ].map(({ label, value, tone, icon: Icon }) => {
            const t = TONE[tone];
            return (
              <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="flex items-center justify-between gap-3 py-3 sm:py-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</p>
                    <p className="font-medium text-[22px] sm:text-[28px] leading-none mt-1.5" style={{ color: t.color }}>{value}</p>
                  </div>
                  <IconTile icon={Icon} tone={tone} size="md" />
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* ================= DEVICE STATUS ================= */}
        <DeviceStatusCard device={device} />

        {/* ================= SENSOR GRID ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <GpsCard sensor={sensors.gps} />
          <TemperatureCard sensor={sensors.temperature} />
          <HumidityCard sensor={sensors.humidity} />
          <RainfallCard sensor={sensors.rainfall} />
          <FingerprintCard deviceConnected={fpConnected} />
        </div>

        <div className="text-[11px] space-y-1" style={{ color: COLORS.muted }}>
          <p>{lastAt ? `Last updated ${lastAt.toLocaleTimeString()}` : (pollError ? 'Device is not connected' : 'Connecting to Edge Gateway…')}</p>
          {pollError && <p className="text-[11px]" style={{ color: TONE.danger.color }}>{pollError}</p>}
          <p>Polling every {POLL_INTERVAL_MS / 1000}s</p>
        </div>

      </div>
    </div>
  );
}
