import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Satellite, CloudRain, Droplets, ScanBarcode, Radio, RefreshCw, Activity } from 'lucide-react';
import { COLORS, SHADOW_CARD } from '../../lib/tokens';

/* ------------------------------------------------------------------ */
/*  SEMANTIC COLOUR MAP                                                 */
/* ------------------------------------------------------------------ */

const TONE = {
  brand:   { color: COLORS.brand, bg: `${COLORS.brand}14`, border: `${COLORS.brand}33` },
  warning: { color: '#D97706',    bg: '#FFFBEB',           border: '#FDE68A' },
  danger:  { color: '#DC2626',    bg: '#FEF2F2',           border: '#FECACA' },
  info:    { color: '#0284C7',    bg: '#F0F9FF',           border: '#BAE6FD' },
  neutral: { color: COLORS.body,  bg: '#F5F6F5',            border: COLORS.line },
};

const STATUS_TONE = {
  connected: 'brand',
  degraded:  'warning',
  offline:   'danger',
  unknown:   'neutral',
};

const STATUS_LABEL = {
  connected: 'Connected',
  degraded:  'Degraded',
  offline:   'Offline',
  unknown:   'Unknown',
};

/* ------------------------------------------------------------------ */
/*  STATIC DEMO DATA — wire real sensor reads here later                */
/* ------------------------------------------------------------------ */

const INITIAL_DEVICES = [
  {
    id: 'fingerprint', name: 'Fingerprint Sensor', icon: Fingerprint,
    status: 'connected', interface: '/dev/ttyUSB0', baud: 57600,
    lastSeen: '12s ago', signal: 96,
    reading: { label: 'Scans today', value: '128' },
    description: 'Enrolment & check-in identity capture',
  },
  {
    id: 'gps', name: 'GPS Sensor', icon: Satellite,
    status: 'connected', interface: 'COM5', baud: 115200,
    lastSeen: '2m ago', signal: 84,
    reading: { label: 'Satellites', value: '8' },
    description: 'Camp location & disaster-response tracking',
  },
  {
    id: 'rain', name: 'Rain Sensor', icon: CloudRain,
    status: 'connected', interface: 'GPIO 27', baud: null,
    lastSeen: '8s ago', signal: 91,
    reading: { label: 'Rainfall', value: '0 mm/h' },
    description: 'Precipitation monitoring for flood alerts',
  },
  {
    id: 'humidity', name: 'Humidity Sensor', icon: Droplets,
    status: 'degraded', interface: 'GPIO 4', baud: null,
    lastSeen: '41s ago', signal: 62,
    reading: { label: 'Humidity', value: '61 %RH' },
    description: 'DHT22 ambient humidity & temperature',
  },
  {
    id: 'wristband', name: 'Wristband Scanner', icon: ScanBarcode,
    status: 'connected', interface: '/dev/ttyACM0', baud: 9600,
    lastSeen: '1m ago', signal: 98,
    reading: { label: 'Reads today', value: '86' },
    description: 'Distribution & check-in wristband reads',
  },
  {
    id: 'broker', name: 'MQTT Broker Link', icon: Radio,
    status: 'connected', interface: 'EMQX TLS 8883', baud: null,
    lastSeen: '5s ago', signal: 100,
    reading: { label: 'Uptime', value: '99.98%' },
    description: 'Cloud broker bridge for event delivery',
  },
];

/* ------------------------------------------------------------------ */
/*  LOCAL PRIMITIVES — mirror the FloodWatch / ReliefOps design system  */
/* ------------------------------------------------------------------ */

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border bg-white p-4 sm:p-6 ${className}`} style={{ borderColor: COLORS.line }}>
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

function SignalBar({ signal }) {
  const tone = signal >= 80 ? 'brand' : signal >= 60 ? 'warning' : 'danger';
  const t = TONE[tone];
  const bars = [1, 2, 3, 4];
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-end gap-0.5">
        {bars.map((b) => (
          <div
            key={b}
            className="w-1 rounded-sm"
            style={{
              height: `${b * 4 + 3}px`,
              backgroundColor: signal >= b * 25 ? t.color : COLORS.hairline,
            }}
          />
        ))}
      </div>
      <span className="text-[11px] font-mono font-semibold" style={{ color: t.color }}>{signal}%</span>
    </div>
  );
}

function DeviceCard({ device }) {
  const Icon = device.icon;
  const tone = STATUS_TONE[device.status] || 'neutral';
  const t = TONE[tone];
  const online = device.status === 'connected';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`h-full transition-all ${online ? '' : 'opacity-95'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <IconTile icon={Icon} tone={device.status === 'offline' ? 'danger' : device.status === 'degraded' ? 'warning' : 'brand'} />
            <div>
              <h3 className="text-[13.5px] sm:text-[14px] font-semibold leading-tight" style={{ color: COLORS.ink }}>{device.name}</h3>
              <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.muted }}>{device.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${online ? 'animate-pulse' : ''}`} style={{ backgroundColor: t.color }} />
            <Chip tone={tone}>{STATUS_LABEL[device.status]}</Chip>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-x-6 gap-y-3" style={{ borderColor: COLORS.hairline }}>
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>Interface</p>
            <p className="text-[12.5px] font-mono font-medium mt-0.5" style={{ color: COLORS.ink }}>
              {device.interface}{device.baud ? ` · ${device.baud}` : ''}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>Last seen</p>
            <p className="text-[12.5px] font-mono font-medium mt-0.5" style={{ color: online ? COLORS.ink : TONE.danger.color }}>{device.lastSeen}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>{device.reading.label}</p>
            <p className="text-[15px] font-semibold font-mono mt-0.5" style={{ color: COLORS.ink }}>{device.reading.value}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>Signal</p>
            <div className="mt-1.5"><SignalBar signal={device.signal} /></div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN SCREEN                                                         */
/* ------------------------------------------------------------------ */

export default function DeviceHealthScreen() {
  const [devices, setDevices] = useState(INITIAL_DEVICES);
  const [lastAt, setLastAt] = useState(new Date());

  const connected = devices.filter((d) => d.status === 'connected').length;
  const degraded = devices.filter((d) => d.status === 'degraded').length;
  const offline = devices.filter((d) => d.status === 'offline').length;

  const refresh = () => {
    // Static demo — re-render only. Swap in real /api/device/health fetch later.
    setDevices([...INITIAL_DEVICES]);
    setLastAt(new Date());
  };

  return (
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>
      <div className="sm:px-5 lg:px-6 py-2 sm:py-5 space-y-4 sm:space-y-6">

        {/* ================= TITLE ROW ================= */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.12em]" style={{ color: COLORS.muted }}>Camp operations</p>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="font-serif font-medium text-[26px] sm:text-[32px] leading-[1.1] tracking-tight">Device Health</h1>
              <Chip tone="neutral">Demo data</Chip>
            </div>
            <p className="text-[12.5px] mt-2" style={{ color: COLORS.muted }}>Peripheral sensor &amp; peripheral connectivity status</p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-semibold rounded-lg border outline-none transition-colors duration-200 self-start sm:self-auto"
            style={{ color: COLORS.brand, backgroundColor: `${COLORS.brand}0F`, borderColor: `${COLORS.brand}33` }}
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
            Refresh
          </button>
        </div>

        {/* ================= SUMMARY STRIP ================= */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: 'Connected', value: connected, tone: 'brand', icon: Activity },
            { label: 'Degraded', value: degraded, tone: 'warning', icon: Activity },
            { label: 'Offline', value: offline, tone: 'danger', icon: Activity },
          ].map(({ label, value, tone, icon: Icon }) => {
            const t = TONE[tone];
            return (
              <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="flex items-center justify-between gap-3 py-3 sm:py-4">
                  <div>
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</p>
                    <p className="font-serif font-medium text-[26px] sm:text-[32px] leading-none mt-1.5" style={{ color: t.color }}>{value}</p>
                  </div>
                  <IconTile icon={Icon} tone={tone} size="md" />
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* ================= DEVICE GRID ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>

        <p className="text-[11.5px] font-mono" style={{ color: COLORS.muted }}>
          Last refreshed {lastAt.toLocaleTimeString()} · static data pending live wiring
        </p>

      </div>
    </div>
  );
}