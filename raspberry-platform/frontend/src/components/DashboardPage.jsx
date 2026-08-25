import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  ClipboardCheck,
  Heart,
  Baby,
  Activity,
  TrendingUp,
  Wifi,
  CalendarDays,
  ArrowUpRight,
  CloudRain,
  Thermometer,
  MapPin,
  Mountain,
  Waves,
  BrainCircuit,
  Wind,
} from "lucide-react";
import LoadingState from "./ui/feedback/LoadingState";
import ErrorState from "./ui/feedback/ErrorState";
import { COLORS, SHADOW_CARD } from "../lib/tokens";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ------------------------------------------------------------------ */
/*  SEMANTIC COLOUR MAP                                                 */
/* ------------------------------------------------------------------ */

const TONE = {
  brand: { color: COLORS.brand, bg: `${COLORS.brand}14`, border: `${COLORS.brand}33` },
  warning: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  danger: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  info: { color: "#0284C7", bg: "#F0F9FF", border: "#BAE6FD" },
  violet: { color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  neutral: { color: COLORS.body, bg: "#F5F6F5", border: COLORS.line },
};

const NETWORK_TONE = { STABLE: "brand", DEGRADED: "warning", CRITICAL: "danger" };

/* ------------------------------------------------------------------ */
/*  MOCK DATA — Disaster Insight Card (replace with API endpoints)      */
/* ------------------------------------------------------------------ */

const MOCK_DISASTER_INSIGHT = {
  prediction: {
    risk_level: "moderate",
    risk_score: 62,
    model: "XGBoost v2.1",
    confidence: 0.84,
    updated_at: "2026-08-24T10:30:00+05:30",
  },
  weather: {
    condition: "Partly Cloudy",
    temp_c: 28,
    humidity_pct: 76,
    wind_kph: 18,
    forecast: "Light showers expected after 14:00",
  },
  rainfall: {
    current_mm: 2.4,
    hourly_avg_mm: 1.8,
    daily_total_mm: 14.2,
    trend: "increasing",
  },
  location: {
    altitude_m: 48,
    lat: 6.9271,
    lon: 79.8612,
    district: "Central Province",
    nearest_river: "Mahaweli River",
    river_distance_km: 3.2,
    river_level_m: 2.8,
    river_trend: "rising",
  },
};

/* ------------------------------------------------------------------ */
/*  MOCK DATA — Resource & Network Charts (replace with API endpoints)  */
/* ------------------------------------------------------------------ */

const MOCK_RESOURCE_USAGE = [
  { label: "Food", used: 840, total: 1000, unit: "kg", color: "#2563EB" },
  { label: "Water", used: 4200, total: 5000, unit: "L", color: "#0891B2" },
  { label: "Medical", used: 156, total: 200, unit: "kits", color: "#DC2626" },
  { label: "Shelter", used: 42, total: 50, unit: "units", color: "#D97706" },
];

const MOCK_SYNC_TIMELINE = [
  { hour: "06:00", sent: 120, received: 118, failed: 2 },
  { hour: "08:00", sent: 340, received: 335, failed: 5 },
  { hour: "10:00", sent: 280, received: 278, failed: 2 },
  { hour: "12:00", sent: 190, received: 185, failed: 5 },
  { hour: "14:00", sent: 420, received: 412, failed: 8 },
  { hour: "16:00", sent: 310, received: 308, failed: 2 },
];

const MOCK_POPULATION = [
  { label: "Adults", count: 420, color: "#2563EB" },
  { label: "Children", count: 185, color: "#0891B2" },
  { label: "Elderly", count: 68, color: "#D97706" },
  { label: "Pregnant", count: 24, color: "#DC2626" },
  { label: "Chronic Illness", count: 37, color: "#7C3AED" },
];

/* ------------------------------------------------------------------ */
/*  LOCAL PRIMITIVES — mirror the FloodWatch / ReliefOps design system  */
/* ------------------------------------------------------------------ */

function Card({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={`rounded-xl border bg-white p-4 sm:p-5 ${className}`}
      style={{ borderColor: COLORS.line }}
    >
      {children}
    </motion.div>
  );
}

function IconTile({ icon: Icon, tone = "brand", size = "md" }) {
  const t = TONE[tone] || TONE.brand;
  const dims = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-8 h-8" : "w-9 h-9";
  return (
    <div className={`${dims} rounded-lg flex items-center justify-center shrink-0 border`} style={{ backgroundColor: t.bg, borderColor: t.border }}>
      <Icon className={size === "lg" ? "w-5 h-5" : "w-4 h-4"} style={{ color: t.color }} strokeWidth={1.7} />
    </div>
  );
}

function Chip({ children, tone = "neutral" }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide border"
      style={{ color: t.color, backgroundColor: t.bg, borderColor: t.border }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.08em] mb-3 sm:mb-4" style={{ color: COLORS.muted }}>
      {children}
    </p>
  );
}

function StatCard({ label, value, icon: Icon, tone = "brand", delay = 0 }) {
  const t = TONE[tone] || TONE.brand;
  return (
    <Card delay={delay} className="relative overflow-hidden group">
      <div
        className="absolute -right-6 -top-6 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500"
        style={{ backgroundColor: t.bg }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />}
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>
            {label}
          </span>
        </div>
        <span className="text-[22px] sm:text-[24px] font-semibold font-mono tracking-tight" style={{ color: COLORS.ink }}>
          {value ?? "—"}
        </span>
      </div>
    </Card>
  );
}

function DistributionRow({ label, data }) {
  if (!data) return null;
  const pct = data.percent ?? 0;
  const tone = pct >= 85 ? TONE.brand : pct >= 60 ? TONE.info : TONE.warning;
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: COLORS.hairline }}>
      <span className="text-[13px] font-semibold w-20" style={{ color: COLORS.ink }}>
        {label}
      </span>
      <div className="flex-1 mx-3">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F0F1EF" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: tone.color }}
          />
        </div>
      </div>
      <span className="text-[12px] font-mono w-20 text-right" style={{ color: COLORS.muted }}>
        {data.served}/{data.served + data.pending}
      </span>
      <span className="text-[13px] font-semibold font-mono w-12 text-right" style={{ color: tone.color }}>
        {pct}%
      </span>
    </div>
  );
}

function VulnerableRow({ icon: Icon, tone, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile icon={Icon} tone={tone} />
      <div>
        <p className="text-[11.5px]" style={{ color: COLORS.muted }}>
          {label}
        </p>
        <p className="text-[16px] font-semibold font-mono" style={{ color: COLORS.ink }}>
          {value ?? 0}
        </p>
      </div>
    </div>
  );
}

function InsightRow({ icon: Icon, tone, label, value, sub }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0" style={{ borderColor: COLORS.hairline }}>
      <IconTile icon={Icon} tone={tone} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>
          {label}
        </p>
        <p className="text-[13.5px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>
          {value}
        </p>
        {sub && (
          <p className="text-[11px] mt-0.5" style={{ color: COLORS.muted }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function ResourceBar({ item }) {
  const pct = Math.round((item.used / item.total) * 100);
  const barTone = pct >= 90 ? TONE.danger : pct >= 70 ? TONE.warning : TONE.brand;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-[12px] font-semibold w-16 shrink-0" style={{ color: COLORS.ink }}>
        {item.label}
      </span>
      <div className="flex-1">
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F0F1EF" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: item.color }}
          />
        </div>
      </div>
      <span className="text-[11px] font-mono w-20 text-right shrink-0" style={{ color: COLORS.muted }}>
        {item.used.toLocaleString()}/{item.total.toLocaleString()} {item.unit}
      </span>
    </div>
  );
}

function DonutChart({ data, size = 160, strokeWidth = 24 }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulated = 0;
  const segments = data.map((d) => {
    const pct = d.count / total;
    const dashArray = circumference * pct;
    const dashOffset = circumference * (1 - accumulated / total);
    accumulated += d.count;
    return { ...d, pct, dashArray, dashOffset };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#F0F1EF" strokeWidth={strokeWidth} />
          {segments.map((seg, i) => (
            <motion.circle
              key={seg.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${seg.dashArray} ${circumference - seg.dashArray}` }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-semibold font-mono leading-none" style={{ color: COLORS.ink }}>
            {total}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider mt-1" style={{ color: COLORS.muted }}>
            Total
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[11.5px] flex-1" style={{ color: COLORS.body }}>
              {d.label}
            </span>
            <span className="text-[12px] font-semibold font-mono" style={{ color: COLORS.ink }}>
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncBar({ data, maxVal }) {
  const sentH = Math.round((data.sent / maxVal) * 100);
  const failedH = Math.round((data.failed / maxVal) * 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-8 flex flex-col justify-end" style={{ height: 80 }}>
        <div className="absolute bottom-0 w-full rounded-t-sm" style={{ height: `${sentH}%`, backgroundColor: COLORS.brand, opacity: 0.2 }} />
        <div className="absolute bottom-0 w-full rounded-t-sm" style={{ height: `${sentH - failedH}%`, backgroundColor: COLORS.brand }} />
        {data.failed > 0 && <div className="absolute bottom-0 w-full rounded-t-sm" style={{ height: `${failedH}%`, backgroundColor: "#DC2626" }} />}
      </div>
      <span className="text-[9px] font-mono" style={{ color: COLORS.muted }}>
        {data.hour}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campId, setCampId] = useState("");
  const [latestGps, setLatestGps] = useState(null);
  const [weather, setWeather] = useState(null);

  const fetchStats = () => {
    fetch(`${API}/api/stats/overview`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStats();
    fetch(`${API}/api/disaster/camp-identity`)
      .then((r) => r.json())
      .then((data) => {
        if (data.camp_id) setCampId(data.camp_id);
      })
      .catch(() => {});
    fetch(`${API}/api/disaster/latest-gps`)
      .then((r) => r.json())
      .then((data) => setLatestGps(data))
      .catch(() => {});
    fetch(`${API}/api/disaster/weather/latest`)
      .then((r) => r.json())
      .then((data) => {
        if (data.available) setWeather(data);
      })
      .catch(() => {});
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) return <LoadingState message="Loading dashboard..." fullPage />;
  if (error) return <ErrorState title="Could not load dashboard" message={error} onRetry={fetchStats} />;

  const pop = stats?.population ?? {};
  const vuln = stats?.vulnerable ?? {};
  const dist = stats?.distribution_today ?? {};
  const pred = stats?.prediction_tomorrow ?? {};
  const mqtt = stats?.mqtt ?? {};
  const recent = stats?.recent_registrations ?? [];

  const netTone = NETWORK_TONE[mqtt.network_state] ?? "neutral";

  return (
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>
      <div className="sm:px-5 lg:px-6 py-2 sm:py-7 space-y-4 sm:space-y-6">
        {/* ================= TITLE ROW ================= */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
        >
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.12em]" style={{ color: COLORS.muted }}>
              {campId || "Camp"}
            </p>
            <h1 className="font-serif font-medium text-[26px] sm:text-[32px] leading-[1.1] tracking-tight mt-1.5">Camp Dashboard</h1>
            <p className="text-[12.5px] mt-2" style={{ color: COLORS.muted }}>
              Live overview of population, distribution &amp; readiness
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-mono" style={{ color: COLORS.muted }}>
            <CalendarDays className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
            <span className="font-medium">{today}</span>
          </div>
        </motion.div>

        {/* ================= STAT ROW ================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Population" value={pop.total?.toLocaleString()} icon={Users} tone="brand" delay={0} />
          <StatCard label="Today Registered" value={pop.today_registered} icon={UserPlus} tone="info" delay={0.05} />
          <StatCard label="Today Check-ins" value={pop.today_checkins} icon={ClipboardCheck} tone="violet" delay={0.1} />
          <StatCard label="Families" value={pop.families} icon={Heart} tone="warning" delay={0.15} />
        </div>

        {/* ================= DISTRIBUTION + SIDE CARDS ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            <Card delay={0.1} className="lg:col-span-2 w-full h-fit">
              <SectionLabel>Today's Distribution</SectionLabel>
              <DistributionRow label="Breakfast" data={dist.breakfast} />
              <DistributionRow label="Lunch" data={dist.lunch} />
              <DistributionRow label="Dinner" data={dist.dinner} />
              <DistributionRow label="Water" data={dist.water} />
            </Card>

            {/* Resource Usage */}
            <Card delay={0.25}>
              <SectionLabel>Resource Usage</SectionLabel>
              <div className="space-y-0">
                {MOCK_RESOURCE_USAGE.map((item) => (
                  <ResourceBar key={item.label} item={item} />
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: COLORS.hairline }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.brand }} />
                  <span className="text-[10px] font-mono" style={{ color: COLORS.muted }}>
                    Normal
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#D97706" }} />
                  <span className="text-[10px] font-mono" style={{ color: COLORS.muted }}>
                    Warning
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#DC2626" }} />
                  <span className="text-[10px] font-mono" style={{ color: COLORS.muted }}>
                    Critical
                  </span>
                </div>
              </div>
            </Card>

            {/* Donut Chart for population of camp */}
            <Card delay={0.2}>
              <SectionLabel>Population Distribution</SectionLabel>
              <DonutChart data={MOCK_POPULATION} />
            </Card>
          </div>
          <div className="space-y-3 sm:space-y-4 h-full">
            <Card delay={0.15} className="h-auto">
              <SectionLabel>Vulnerable</SectionLabel>
              <div className="space-y-3">
                <VulnerableRow icon={Baby} tone="violet" label="Pregnant" value={vuln.pregnant} />
                <VulnerableRow icon={Activity} tone="warning" label="Chronic Illness" value={vuln.chronic_illness} />
                <VulnerableRow icon={Heart} tone="brand" label="Total Flagged" value={vuln.total_flagged} />
              </div>
            </Card>

            <Card delay={0.2} className="h-42">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Network</SectionLabel>
                <Chip tone={netTone}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />
                  {mqtt.network_state ?? "UNKNOWN"}
                </Chip>
              </div>
              <div className="flex items-center gap-2 text-[12.5px]" style={{ color: COLORS.muted }}>
                <Wifi className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                <span>
                  Buffered:{" "}
                  <strong className="font-mono font-semibold" style={{ color: COLORS.ink }}>
                    {mqtt.buffered_messages ?? 0}
                  </strong>{" "}
                  messages
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12.5px] mt-3" style={{ color: COLORS.muted }}>
                <Activity className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
                <span>
                  Uptime:{" "}
                  <strong className="font-mono font-semibold" style={{ color: COLORS.ink }}>
                    {mqtt.uptime_hours ?? 0}
                  </strong>{" "}
                  hours
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12.5px] mt-3" style={{ color: COLORS.muted }}>
                <ArrowUpRight className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                <span>
                  Last sync:{" "}
                  <strong className="font-mono font-semibold" style={{ color: COLORS.ink }}>
                    {mqtt.last_sync ?? "—"}
                  </strong>
                </span>
              </div>
            </Card>

            <Card delay={0.25} className="h-auto">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                <SectionLabel>Tomorrow</SectionLabel>
              </div>
              <div className="text-[12.5px] space-y-1.5" style={{ color: COLORS.body }}>
                <p className="flex justify-between">
                  <span>Expected</span>
                  <strong className="font-mono font-semibold" style={{ color: COLORS.ink }}>
                    {pred.expected_persons?.toLocaleString() ?? "—"} persons
                  </strong>
                </p>
                <p className="flex justify-between">
                  <span>Food</span>
                  <strong className="font-mono font-semibold" style={{ color: COLORS.ink }}>
                    {pred.breakfast_kg ?? "—"} kg
                  </strong>
                </p>
                <p className="flex justify-between">
                  <span>Water</span>
                  <strong className="font-mono font-semibold" style={{ color: COLORS.ink }}>
                    {pred.water_litres?.toLocaleString() ?? "—"} L
                  </strong>
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* ================= DISASTER INSIGHT ================= */}
        <Card delay={0.3}>
          <SectionLabel>Disaster Insight</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Model Prediction */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BrainCircuit className="w-4 h-4" style={{ color: COLORS.brand }} />
                <span className="text-[12px] font-semibold" style={{ color: COLORS.ink }}>
                  Model Prediction
                </span>
              </div>
              <div className="space-y-0">
                <InsightRow
                  icon={Activity}
                  tone={
                    MOCK_DISASTER_INSIGHT.prediction.risk_level === "high"
                      ? "danger"
                      : MOCK_DISASTER_INSIGHT.prediction.risk_level === "moderate"
                        ? "warning"
                        : "brand"
                  }
                  label="Risk Level"
                  value={`${MOCK_DISASTER_INSIGHT.prediction.risk_level.charAt(0).toUpperCase() + MOCK_DISASTER_INSIGHT.prediction.risk_level.slice(1)} (${MOCK_DISASTER_INSIGHT.prediction.risk_score}/100)`}
                  sub={`Model: ${MOCK_DISASTER_INSIGHT.prediction.model} · ${MOCK_DISASTER_INSIGHT.prediction.confidence * 100}% confidence`}
                />
              </div>
            </div>

            {/* Weather Forecast */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CloudRain className="w-4 h-4" style={{ color: COLORS.brand }} />
                <span className="text-[12px] font-semibold" style={{ color: COLORS.ink }}>
                  Weather Forecast
                </span>
              </div>
              <div className="space-y-0">
                {weather ? (
                  <>
                    <InsightRow
                      icon={Thermometer}
                      tone="info"
                      label="Condition"
                      value={`${weather.condition || 'Unknown'} · ${weather.temperature != null ? `${Math.round(weather.temperature)}°C` : '—'}`}
                      sub={`Humidity: ${weather.humidity != null ? `${Math.round(weather.humidity)}%` : '—'} · Wind: ${weather.wind_speed != null ? `${Math.round(weather.wind_speed)} km/h` : '—'}`}
                    />
                    {weather.fetched_at && (
                      <p className="text-[10px] font-mono mt-2" style={{ color: COLORS.muted }}>
                        Last updated: {new Date(weather.fetched_at).toLocaleString()}
                      </p>
                    )}
                  </>
                ) : (
                  <InsightRow
                    icon={Thermometer}
                    tone="neutral"
                    label="Condition"
                    value="Weather data unavailable"
                    sub="Waiting for first forecast"
                  />
                )}
              </div>
            </div>

            {/* Rainfall & Location */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4" style={{ color: COLORS.brand }} />
                <span className="text-[12px] font-semibold" style={{ color: COLORS.ink }}>
                  Rainfall & Location
                </span>
              </div>
              <div className="space-y-0">
                <InsightRow
                  icon={CloudRain}
                  tone="info"
                  label="Rainfall"
                  value={`${MOCK_DISASTER_INSIGHT.rainfall.current_mm} mm/hr`}
                  sub={`Daily total: ${MOCK_DISASTER_INSIGHT.rainfall.daily_total_mm} mm · Trend: ${MOCK_DISASTER_INSIGHT.rainfall.trend}`}
                />
                <InsightRow
                  icon={Mountain}
                  tone="neutral"
                  label="Altitude"
                  value={latestGps?.altitude != null ? `${latestGps.altitude} m` : "—"}
                  sub={`${latestGps?.latitude?.toFixed(4) ?? "—"}°N, ${latestGps?.longitude?.toFixed(4) ?? "—"}°E`}
                />
                <InsightRow
                  icon={Waves}
                  tone="info"
                  label={MOCK_DISASTER_INSIGHT.location.nearest_river}
                  value={`${MOCK_DISASTER_INSIGHT.location.river_level_m} m`}
                  sub={`${MOCK_DISASTER_INSIGHT.location.river_distance_km} km away · Trend: ${MOCK_DISASTER_INSIGHT.location.river_trend}`}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* ================= RECENT REGISTRATIONS ================= */}
        {recent.length > 0 && (
          <Card delay={0.3}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <SectionLabel>Recent Registrations</SectionLabel>
              <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: COLORS.muted }}>
                Live <ArrowUpRight className="w-3 h-3" style={{ color: COLORS.brand }} />
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: COLORS.line }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: COLORS.hairline, backgroundColor: "#FAFAF9" }}>
                    {["Name", "Age", "Gender", "Wristband", "Status", "Time"].map((h) => (
                      <th
                        key={h}
                        className="py-3 px-4 font-mono font-semibold text-[10.5px] uppercase tracking-[0.06em]"
                        style={{ color: COLORS.muted }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(0, 10).map((p) => (
                    <tr key={p.id} className="border-t transition-colors" style={{ borderColor: COLORS.hairline }}>
                      <td className="py-3 px-4 font-semibold" style={{ color: COLORS.ink }}>
                        {p.full_name}
                      </td>
                      <td className="py-3 px-4" style={{ color: COLORS.body }}>
                        {p.age}
                      </td>
                      <td className="py-3 px-4" style={{ color: COLORS.body }}>
                        {p.gender}
                      </td>
                      <td className="py-3 px-4 font-mono text-[12px]" style={{ color: COLORS.body }}>
                        {p.wristband_barcode ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Chip tone={p.pre_registered ? "brand" : "info"}>{p.pre_registered ? "Pre-registered" : "New"}</Chip>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11.5px]" style={{ color: COLORS.muted }}>
                        {p.created_at ? new Date(p.created_at).toLocaleTimeString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
