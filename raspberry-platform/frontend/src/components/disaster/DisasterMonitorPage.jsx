import { useState, useEffect, useRef, useCallback } from "react";
import {
  Droplets,
  Wind,
  MapPin,
  RefreshCw,
  Radar,
  Navigation,
  Satellite,
  CloudRain,
  Bell,
  Download,
  Mountain,
  Waves,
  Gauge as GaugeIcon,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Zap,
  Clock,
  FlaskConical,
} from "lucide-react";
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { COLORS, SHADOW_CARD, TONE } from "../../lib/tokens";
import { API } from "../ui/config";
import DataTable from "../ui/display/DataTable";
import SimulationModal from "./SimulationModal";

const RISK = {
  safe: { label: "Stable", color: COLORS.brand },
  caution: { label: "Caution", color: TONE.warning.color },
  warning: { label: "Warning", color: "#EA580C" },
  critical: { label: "Critical", color: TONE.danger.color },
};

const STATUS_META = {
  critical: { label: "CRITICAL", color: TONE.danger.color },
  high: { label: "HIGH", color: TONE.warning.color },
  medium: { label: "MEDIUM", color: "#F59E0B" },
  stable: { label: "STABLE", color: COLORS.brand },
  recovery: { label: "RECOVERY", color: COLORS.brand },
};

function getRisk(wl, majorFlood, minorFlood, alertLevel) {
  if (wl >= majorFlood) return RISK.critical;
  if (wl >= minorFlood) return RISK.warning;
  if (wl >= alertLevel) return RISK.caution;
  return RISK.safe;
}

function computeTrend(levels) {
  return levels.map((d, i, arr) => {
    const win = arr.slice(Math.max(0, i - 2), i + 1);
    const trend = win.reduce((s, x) => s + x.level, 0) / win.length;
    return { ...d, trend: Number(trend.toFixed(2)) };
  });
}

const BEST_MODEL = { name: "XGBoost", roc_auc: 0.927 };

const PRED_RISK = {
  Low: { label: "Low", color: COLORS.brand },
  Medium: { label: "Medium", color: TONE.warning.color },
  High: { label: "High", color: TONE.danger.color },
  Unknown: { label: "N/A", color: COLORS.muted },
};

/* ------------------------------------------------------------------ */
/*  SEMI-CIRCLE GAUGE — fill colour follows live risk level             */
/* ------------------------------------------------------------------ */

function polar(cx, cy, r, deg) {
  const rad = ((deg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function LevelGauge({ waterLevel, alertLevel, minorFloodLevel, majorFloodLevel, risk }) {
  const wl = waterLevel ?? 0;
  const al = alertLevel ?? 2.0;
  const mf = minorFloodLevel ?? 3.0;
  const Mf = majorFloodLevel ?? 4.2;
  const max = Mf * 1.1;
  const valueDeg = Math.min(180, (wl / max) * 180);
  const cx = 110,
    cy = 110,
    r = 90;

  return (
    <div className="flex flex-col items-center w-full">
      <svg viewBox="0 0 220 128" className="w-full max-w-60">
        <path d={arcPath(cx, cy, r, 0, 180)} fill="none" stroke={COLORS.track} strokeWidth="15" strokeLinecap="round" />
        <path d={arcPath(cx, cy, r, 0, valueDeg)} fill="none" stroke={risk.color} strokeWidth="15" strokeLinecap="round" />
        {[al, mf, Mf].map((lvl, i) => {
          const deg = Math.min(180, (lvl / max) * 180);
          const p1 = polar(cx, cy, r - 10, deg);
          const p2 = polar(cx, cy, r + 10, deg);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={COLORS.noise} strokeWidth="1.5" />;
        })}
      </svg>
      <div className="-mt-12 text-center">
        <p className="text-[38px] leading-none tabular-nums tracking-tight" style={{ color: risk.color }}>
          {wl.toFixed(2)}
          <span className="text-lg" style={{ color: COLORS.muted }}>
            m
          </span>
        </p>
        <p className="text-[11px] mt-2 tracking-wider uppercase font-medium" style={{ color: risk.color }}>
          {risk.label}
        </p>
      </div>
      <div className="flex items-center justify-between w-full max-w-60 mt-4 text-[11px]" style={{ color: COLORS.muted }}>
        <span>0m</span>
        <span>Alert {al}</span>
        <span>Major {Mf}</span>
      </div>
    </div>
  );
}

function LevelHistoryChart({ history, alertLevel }) {
  return (
    <div className="h-50 sm:h-55 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={history} margin={{ top: 10, right: 6, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.trend} stopOpacity={0.16} />
              <stop offset="100%" stopColor={COLORS.trend} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.brand} stopOpacity={0.95} />
              <stop offset="100%" stopColor={COLORS.brand} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={COLORS.grid} />
          <XAxis dataKey="t" tick={{ fontSize: 11, fill: COLORS.muted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: COLORS.muted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={34} />
          <ReferenceLine y={alertLevel} stroke={COLORS.noise} strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: `1px solid ${COLORS.line}`, fontSize: 12, boxShadow: SHADOW_CARD, fontFamily: "Inter" }}
            labelStyle={{ color: COLORS.ink, fontWeight: 600 }}
            cursor={{ fill: "rgba(5,150,105,0.05)" }}
          />
          <Area type="monotone" dataKey="trend" stroke="none" fill="url(#trendFill)" />
          <Bar dataKey="level" fill="url(#barFill)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Line
            type="monotone"
            dataKey="trend"
            stroke={COLORS.trend}
            strokeWidth={2.25}
            dot={{ r: 3, fill: COLORS.trend, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: COLORS.trend, stroke: "#fff", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SMALL PRIMITIVES — icons stay neutral; colour is reserved for state */
/* ------------------------------------------------------------------ */

function IconTile({ icon: Icon }) {
  return (
    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.hairline }}>
      <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" style={{ color: COLORS.body }} strokeWidth={1.6} />
    </div>
  );
}

function FieldBox({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg px-3.5 py-3 flex items-center justify-between" style={{ backgroundColor: COLORS.surface }}>
      <div>
        <p className="text-[11px]" style={{ color: COLORS.muted }}>
          {label}
        </p>
        <p className="text-sm font-medium mt-0.5" style={{ color: COLORS.ink }}>
          {value}
        </p>
      </div>
      {Icon && <Icon className="w-4 h-4" style={{ color: COLORS.muted }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function DisasterMonitorPage() {
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [latestGps, setLatestGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [waterLevel, setWaterLevel] = useState(null);
  const [waterLevelLoading, setWaterLevelLoading] = useState(true);
  const [waterHistory, setWaterHistory] = useState([]);
  const [waterRefreshing, setWaterRefreshing] = useState(false);
  const [hydrospatial, setHydrospatial] = useState(null);
  const [hydroLoading, setHydroLoading] = useState(true);
  const [prediction, setPrediction] = useState(null);
  const [predLoading, setPredLoading] = useState(true);
  const [predError, setPredError] = useState(null);
  const [campData, setCampData] = useState(null);
  const [campLoading, setCampLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // ── Simulation state ──────────────────────────────────────────────
  const [showSimModal, setShowSimModal] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simPrediction, setSimPrediction] = useState(null);

  // ── Alert history state ──────────────────────────────────────────
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsPagination, setAlertsPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 0 });

  // Track last GPS coordinates to detect changes
  const lastGpsRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // ── Fetch all disaster data for current GPS ──────────────────────────
  const fetchAllDisasterData = useCallback(() => {
    setWeatherLoading(true);
    setWaterLevelLoading(true);
    setHydroLoading(true);
    setPredLoading(true);
    setPredError(null);
    setCampLoading(true);
    setOverviewLoading(true);

    // fetch(`${API}/api/disaster/camp-identity`)
    //   .then((r) => r.json())
    //   .then((data) => {
    //     if (data.camp_id) {
    //       fetch(`${API}/api/disaster/camps/${data.camp_id}`)
    //         .then((r) => r.json())
    //         .then((camp) => { if (camp) setCampData(camp) })
    //         .catch(() => {})
    //         .finally(() => setCampLoading(false))
    //     } else {
    //       setCampLoading(false)
    //     }
    //   })
    //   .catch(() => setCampLoading(false))

    // fetch(`${API}/api/disaster/overview`)
    //   .then((r) => r.json())
    //   .then((data) => { if (data) setOverview(data) })
    //   .catch(() => {})
    //   .finally(() => setOverviewLoading(false))

    fetch(`${API}/api/disaster/weather/latest`)
      .then((r) => r.json())
      .then((data) => {
        if (data.available) setWeather(data);
      })
      .catch(() => {})
      .finally(() => setWeatherLoading(false));

    fetch(`${API}/api/disaster/water-level/latest`)
      .then((r) => r.json())
      .then((data) => {
        if (data.available) setWaterLevel(data);
      })
      .catch(() => {})
      .finally(() => setWaterLevelLoading(false));

    fetch(`${API}/api/disaster/water-level/history?limit=20`)
      .then((r) => r.json())
      .then((data) => {
        if (data.readings?.length) {
          const mapped = data.readings.map((r) => {
            const t = new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return { t, level: r.water_level };
          });
          mapped[mapped.length - 1].t = "Now";
          setWaterHistory(computeTrend(mapped));
        }
      })
      .catch(() => {});

    fetch(`${API}/api/disaster/hydrospatial/latest`)
      .then((r) => r.json())
      .then((data) => {
        if (data.available) setHydrospatial(data);
      })
      .catch(() => {})
      .finally(() => setHydroLoading(false));

    fetch(`${API}/api/disaster/predict`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "success" && data.prediction) {
          setPrediction(data);
        } else {
          setPredError(data.error || "Prediction unavailable");
        }
      })
      .catch((err) => setPredError(err.message))
      .finally(() => setPredLoading(false));
  }, []);

  // ── Fetch escalated alerts ─────────────────────────────────────────
  const fetchAlerts = useCallback((page = 1) => {
    setAlertsLoading(true);
    fetch(`${API}/api/disaster/alerts?page=${page}&limit=15`)
      .then((r) => r.json())
      .then((data) => {
        setAlerts(data.alerts || []);
        setAlertsPagination(data.pagination || { page: 1, limit: 15, total: 0, totalPages: 0 });
      })
      .catch(() => {
        setAlerts([]);
      })
      .finally(() => setAlertsLoading(false));
  }, []);

  // ── GPS polling: detect changes and re-fetch all data ────────────────
  useEffect(() => {
    const pollGps = () => {
      fetch(`${API}/api/disaster/latest-gps`)
        .then((r) => r.json())
        .then((data) => {
          setLatestGps(data);
          setGpsLoading(false);

          const newLat = data?.latitude;
          const newLng = data?.longitude;

          if (newLat != null && newLng != null) {
            const prev = lastGpsRef.current;
            // First load or GPS changed significantly (>50m)
            if (!prev || Math.abs(prev.lat - newLat) > 0.0005 || Math.abs(prev.lng - newLng) > 0.0005) {
              lastGpsRef.current = { lat: newLat, lng: newLng };
              // GPS changed — clear stale data and re-fetch
              setWeather(null);
              setWaterLevel(null);
              setWaterHistory([]);
              setHydrospatial(null);
              setPrediction(null);
              setPredError(null);
              fetchAllDisasterData();
            }
          }
        })
        .catch(() => setGpsLoading(false));
    };

    pollGps(); // initial fetch
    fetchAlerts(1);
    const gpsInterval = setInterval(pollGps, 10000); // poll every 10s
    return () => clearInterval(gpsInterval);
  }, [fetchAllDisasterData, fetchAlerts]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetch(`${API}/api/disaster/latest-gps`)
      .then((r) => r.json())
      .then((data) => setLatestGps(data))
      .catch(() => {});
    fetch(`${API}/api/disaster/water-level/latest`)
      .then((r) => r.json())
      .then((data) => {
        if (data.available) setWaterLevel(data);
      })
      .catch(() => {});
    fetch(`${API}/api/disaster/water-level/history?limit=20`)
      .then((r) => r.json())
      .then((data) => {
        if (data.readings?.length) {
          const mapped = data.readings.map((r) => {
            const t = new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return { t, level: r.water_level };
          });
          mapped[mapped.length - 1].t = "Now";
          setWaterHistory(computeTrend(mapped));
        }
      })
      .catch(() => {});
    fetch(`${API}/api/disaster/weather/latest`)
      .then((r) => r.json())
      .then((data) => {
        if (data.available) setWeather(data);
      })
      .catch(() => {});
    fetch(`${API}/api/disaster/hydrospatial/latest`)
      .then((r) => r.json())
      .then((data) => {
        if (data.available) setHydrospatial(data);
      })
      .catch(() => {});
    if (!isSimulating) {
      fetch(`${API}/api/disaster/predict`)
        .then((r) => r.json())
        .then((data) => {
          if (data.status === "success" && data.prediction) {
            setPrediction(data);
            setPredError(null);
          }
        })
        .catch(() => {})
        .finally(() => setTimeout(() => setRefreshing(false), 700));
    } else {
      setTimeout(() => setRefreshing(false), 700);
    }
    // fetch(`${API}/api/disaster/camp-identity`)
    //   .then((r) => r.json())
    //   .then((data) => {
    //     if (data.camp_id) {
    //       fetch(`${API}/api/disaster/camps/${data.camp_id}`)
    //         .then((r) => r.json())
    //         .then((camp) => { if (camp) setCampData(camp) })
    //         .catch(() => {})
    //     }
    //   })
    //   .catch(() => {})
    fetch(`${API}/api/disaster/overview`)
      .then((r) => r.json())
      .then((data) => {
        if (data) setOverview(data);
      })
      .catch(() => {});
  };

  const handleRefreshWaterLevel = () => {
    setWaterRefreshing(true);
    fetch(`${API}/api/disaster/water-level/refresh`, { method: "POST" })
      .then((r) => r.json())
      .then(() => {
        return fetch(`${API}/api/disaster/water-level/latest`);
      })
      .then((r) => r.json())
      .then((data) => {
        if (data.available) setWaterLevel(data);
      })
      .catch(() => {})
      .finally(() => {
        fetch(`${API}/api/disaster/water-level/history?limit=20`)
          .then((r) => r.json())
          .then((data) => {
            if (data.readings?.length) {
              const mapped = data.readings.map((r) => {
                const t = new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return { t, level: r.water_level };
              });
              mapped[mapped.length - 1].t = "Now";
              setWaterHistory(computeTrend(mapped));
            }
          })
          .catch(() => {})
          .finally(() => setTimeout(() => setWaterRefreshing(false), 700));
      });
  };

  const wl = waterLevel?.water_level ?? 0;
  const al = waterLevel?.alert_level ?? 2.0;
  const mf = waterLevel?.minor_flood_level ?? 3.0;
  const Mf = waterLevel?.major_flood_level ?? 4.2;
  const risk = getRisk(wl, Mf, mf, al);
  const riverName = waterLevel?.river_name || null;
  const stationName = waterLevel?.station_name || null;
  const distanceKm = waterLevel?.distance_km ?? null;

  const chartHistory = waterHistory.length > 0 ? waterHistory : [{ t: "Now", level: 0, trend: 0 }];

  const readings = [];
  if (waterLevel) {
    readings.push({
      icon: GaugeIcon,
      title: stationName || "Gauging Station",
      meta: `${distanceKm != null ? `${distanceKm} km away` : "—"}${riverName ? ` · ${riverName}` : ""}`,
      value: `${wl.toFixed(2)} m`,
      note: "water level",
    });
  }
  if (riverName) {
    readings.push({
      icon: Waves,
      title: riverName,
      meta: `${distanceKm != null ? `${distanceKm} km from camp` : "—"} · Nearest waterway`,
      value: risk.label,
      note: "flow status",
    });
  }

  return (
    <div style={{ color: COLORS.ink }}>
      <div className="space-y-4 sm:space-y-6">
        {/* ================= TITLE ROW ================= */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.muted }}>
              Flood monitoring
            </p>
            <h1 className="font-medium text-[26px] sm:text-[32px] lg:text-[36px] leading-[1.1] tracking-tight mt-1.5">
              Smart Camp — {latestGps?.location_name ?? "Unknown Location"}
            </h1>
            <p className="flex items-center gap-1.5 text-[12px] mt-2" style={{ color: COLORS.muted }}>
              <MapPin className="w-3.5 h-3.5" />
              {latestGps?.latitude?.toFixed(4) ?? "—"}, {latestGps?.longitude?.toFixed(4) ?? "—"}
              {latestGps?.location_district && <span className="ml-1.5">· {latestGps.location_district}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: risk.color }} />
            <span className="font-semibold" style={{ color: risk.color }}>
              {risk.label}
            </span>
            {isSimulating && (
              <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                <FlaskConical className="w-3 h-3" /> SIMULATION
              </span>
            )}
          </div>
        </div>

        {/* =================  WEATHER + Locaion ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">

          <div className="lg:col-span-7 rounded-xl p-4 sm:p-6" style={{ backgroundColor: COLORS.grid }}>
            <div className="flex items-start justify-between mb-4 sm:mb-5">
              <div className="flex items-center gap-3">
                <IconTile icon={CloudRain} />
                <div>
                  <p className="text-[11px] uppercase tracking-widest" style={{ color: COLORS.muted }}>
                    Weather Forecast
                  </p>
                  <p className="text-[13px] sm:text-[14px] font-medium mt-0.5">{weather?.condition || "Weather data unavailable"}</p>
                </div>
              </div>
              <p className="font-medium text-[28px] sm:text-[30px] leading-none tracking-tight">
                {weather?.temperature != null ? `${Math.round(weather.temperature)}°` : "—"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              <div className="rounded-lg py-2.5 text-center" style={{ backgroundColor: COLORS.surface }}>
                <p className="text-[14px] sm:text-[15px] font-semibold">{weather?.rainfall != null ? `${weather.rainfall.toFixed(1)} mm` : "—"}</p>
                <p className="text-[11px] mt-0.5" style={{ color: COLORS.muted }}>
                  Rainfall
                </p>
              </div>
              <div className="rounded-lg py-2.5 text-center" style={{ backgroundColor: COLORS.surface }}>
                <p className="text-[14px] sm:text-[15px] font-semibold">
                  {weather?.wind_speed != null ? `${Math.round(weather.wind_speed)} km/h` : "—"}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: COLORS.muted }}>
                  Wind
                </p>
              </div>
              <div className="rounded-lg py-2.5 text-center" style={{ backgroundColor: COLORS.surface }}>
                <p className="text-[14px] sm:text-[15px] font-semibold">
                  {weather?.precipitation != null ? `${weather.precipitation.toFixed(1)} mm` : "—"}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: COLORS.muted }}>
                  Precipitation
                </p>
              </div>
            </div>

            {weather?.fetched_at && (
              <p className="text-[10px] mt-4 pt-3 border-t" style={{ borderColor: COLORS.hairline, color: COLORS.muted }}>
                Last updated: {new Date(weather.fetched_at).toLocaleString()}
              </p>
            )}
          </div>
          {/* Location Card */}
          <div className="lg:col-span-5 rounded-xl p-4 sm:p-6" style={{ backgroundColor: COLORS.grid }}>
            <div className="flex items-center gap-3 mb-4 sm:mb-5">
              <IconTile icon={Navigation} />
              <h2 className="text-[13px] sm:text-[14px] font-medium">Location</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              <FieldBox label="Latitude" value={latestGps?.latitude?.toFixed(6) ?? "—"} />
              <FieldBox label="Longitude" value={latestGps?.longitude?.toFixed(6) ?? "—"} />
              <FieldBox label="Altitude" value={latestGps?.altitude != null ? `${latestGps.altitude} m` : "—"} />
              <FieldBox label="Source" value={latestGps?.source ?? "—"} />
            </div>
          </div>
        </div>

        {/* ================= WATER LEVEL: GAUGE + HISTORY ================= */}
        <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: COLORS.grid }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-5">
            <div className="flex items-center gap-3">
              <IconTile icon={GaugeIcon} />
              <div>
                <h2 className="text-[13px] sm:text-[14px] font-medium">Water level</h2>
                {riverName && (
                  <p className="text-[11px] sm:text-[11.5px] mt-0.5" style={{ color: COLORS.muted }}>
                    {riverName}
                  </p>
                )}
                {stationName && (
                  <p className="text-[11px] sm:text-[11.5px] mt-0.5" style={{ color: COLORS.muted }}>
                    {stationName}
                    {distanceKm != null ? ` · ${distanceKm} km away` : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[11px] sm:text-[11.5px]" style={{ color: COLORS.muted }}>
                  Last 6 hours
                </span>
                {waterLevel?.recorded_at && (
                  <p className="text-[10px] mt-0.5" style={{ color: COLORS.muted }}>
                    Updated: {new Date(waterLevel.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <button
                onClick={handleRefreshWaterLevel}
                disabled={waterRefreshing}
                className="p-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                style={{ borderColor: COLORS.line }}
                title="Refresh water level data from ArcGIS"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${waterRefreshing ? "animate-spin" : ""}`} style={{ color: COLORS.muted }} />
              </button>
            </div>
          </div>

          {!waterLevel ? (
            <div className="flex items-center justify-center py-12" style={{ color: COLORS.muted }}>
              <p className="text-[13px]">Awaiting water level data from gauging station...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-center">
              <div className="lg:col-span-4 flex justify-center">
                <LevelGauge waterLevel={wl} alertLevel={al} minorFloodLevel={mf} majorFloodLevel={Mf} risk={risk} />
              </div>
              <div className="lg:col-span-8">
                <LevelHistoryChart history={chartHistory} alertLevel={al} />
                <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ color: COLORS.muted }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS.brand }} /> Level
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.trend }} /> Trend
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= FLOOD PREDICTION ================= */}
        <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: COLORS.grid }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-5">
            <div className="flex items-center gap-3">
              <IconTile icon={Activity} />
              <div>
                <h2 className="text-[13px] sm:text-[14px] font-medium">Flood prediction</h2>
                <p className="text-[11px] sm:text-[11.5px] mt-0.5" style={{ color: COLORS.muted }}>
                  XGBoost model · {BEST_MODEL.name} {(BEST_MODEL.roc_auc * 100).toFixed(1)}% AUC
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {prediction?.mode === "simulation" && (
                <>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">SIMULATION</span>
                  <button
                    onClick={() => {
                      setIsSimulating(false);
                      setSimPrediction(null);
                      fetchAllDisasterData();
                    }}
                    className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                  >
                    Return to Live
                  </button>
                </>
              )}
              {prediction?.mode === "live" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600">LIVE</span>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                style={{ borderColor: COLORS.line }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} style={{ color: COLORS.muted }} />
              </button>
            </div>
          </div>

          {predLoading ? (
            <div className="flex items-center justify-center py-12" style={{ color: COLORS.muted }}>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-[13px]">Running flood prediction model...</p>
              </div>
            </div>
          ) : predError ? (
            <div className="rounded-lg border p-4 text-center" style={{ borderColor: COLORS.line, color: COLORS.muted }}>
              <p className="text-[13px]">Prediction unavailable: {predError}</p>
            </div>
          ) : prediction?.prediction ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Probability */}
              <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.surface }}>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.muted }}>
                  Flood Probability
                </p>
                <p
                  className="font-medium text-[32px] sm:text-[36px] leading-none tracking-tight mt-2"
                  style={{ color: (PRED_RISK[prediction.prediction.risk_category] || PRED_RISK.Unknown).color }}
                >
                  {prediction.prediction.flood_probability_percent}
                  <span className="text-lg" style={{ color: COLORS.muted }}>
                    %
                  </span>
                </p>
                <p className="text-[11px] mt-1" style={{ color: COLORS.muted }}>
                  Next {prediction.prediction.forecast_hours}h forecast
                </p>
              </div>

              {/* Risk Category */}
              <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.surface }}>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.muted }}>
                  Risk Level
                </p>
                <p
                  className="font-medium text-[28px] sm:text-[32px] leading-none tracking-tight mt-3"
                  style={{ color: (PRED_RISK[prediction.prediction.risk_category] || PRED_RISK.Unknown).color }}
                >
                  {prediction.prediction.risk_category}
                </p>
              </div>

              {/* Occurrence */}
              <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.surface }}>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.muted }}>
                  Occurrence
                </p>
                <p className="font-medium text-[28px] sm:text-[32px] leading-none tracking-tight mt-3" style={{ color: COLORS.ink }}>
                  {prediction.prediction.occurrence}
                </p>
              </div>

              {/* Timestamp */}
              <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.surface }}>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.muted }}>
                  Prediction Time
                </p>
                <p className="text-[13px] mt-3" style={{ color: COLORS.ink }}>
                  {prediction.prediction_timestamp
                    ? new Date(prediction.prediction_timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </p>
                {prediction.prediction_duration_ms && (
                  <p className="text-[11px] mt-1" style={{ color: COLORS.muted }}>
                    Latency: {prediction.prediction_duration_ms}ms
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {/* Simulation hydrospatial context — river + station */}
          {prediction?.mode === "simulation" &&
            prediction?.hydrospatial &&
            (prediction.hydrospatial.river_name || prediction.hydrospatial.station_name) && (
              <div className="mt-3 px-3 py-2.5 rounded-lg flex flex-wrap items-center gap-x-5 gap-y-1" style={{ backgroundColor: "#F0FDF4" }}>
                {prediction.hydrospatial.river_name && (
                  <span className="flex items-center gap-1.5 text-[12px]">
                    <Waves className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                    <span style={{ color: COLORS.muted }}>Nearest River:</span>
                    <span className="font-medium" style={{ color: COLORS.ink }}>
                      {prediction.hydrospatial.river_name}
                    </span>
                  </span>
                )}
                {prediction.hydrospatial.station_name && (
                  <span className="flex items-center gap-1.5 text-[12px]">
                    <GaugeIcon className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                    <span style={{ color: COLORS.muted }}>Gauging Station:</span>
                    <span className="font-medium" style={{ color: COLORS.ink }}>
                      {prediction.hydrospatial.station_name}
                    </span>
                  </span>
                )}
                {prediction.hydrospatial.gauge_distance_km != null && (
                  <span className="flex items-center gap-1.5 text-[12px]">
                    <MapPin className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                    <span style={{ color: COLORS.muted }}>Gauge dist:</span>
                    <span className="font-medium" style={{ color: COLORS.ink }}>
                      {prediction.hydrospatial.gauge_distance_km} km
                    </span>
                  </span>
                )}
                {prediction.hydrospatial.elevation_difference != null && (
                  <span className="flex items-center gap-1.5 text-[12px]">
                    <Mountain className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                    <span style={{ color: COLORS.muted }}>Δ Elev:</span>
                    <span className="font-medium" style={{ color: COLORS.ink }}>
                      {prediction.hydrospatial.elevation_difference} m
                    </span>
                  </span>
                )}
              </div>
            )}

          {/* Prediction Inputs */}
          {prediction?.inputs && !predLoading && !predError && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: COLORS.hairline }}>
              <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: COLORS.muted }}>
                Model input conditions
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  {
                    label: "Rainfall",
                    value: prediction.inputs.rainfall_mm != null ? `${prediction.inputs.rainfall_mm} mm` : "—",
                    fetched: prediction?.mode === "simulation",
                  },
                  {
                    label: "Elevation",
                    value: prediction.inputs.elevation_m != null ? `${prediction.inputs.elevation_m} m` : "—",
                    fetched: prediction?.mode === "simulation",
                  },
                  {
                    label: "River Distance",
                    value: prediction.inputs.river_distance_km != null ? `${prediction.inputs.river_distance_km} km` : "—",
                    fetched: prediction?.mode === "simulation",
                  },
                  {
                    label: "Water Level",
                    value: prediction.inputs.water_level_m != null ? `${prediction.inputs.water_level_m} m` : "—",
                    fetched: prediction?.mode === "simulation",
                  },
                  { label: "Latitude", value: prediction.inputs.latitude?.toFixed(4) ?? "—", fetched: false },
                  { label: "Longitude", value: prediction.inputs.longitude?.toFixed(4) ?? "—", fetched: false },
                ].map((d) => (
                  <div key={d.label} className="rounded-lg px-2.5 py-2" style={{ backgroundColor: COLORS.surface }}>
                    <p className="text-[11px] flex items-center gap-1" style={{ color: COLORS.muted }}>
                      {d.label}
                      {d.fetched && (
                        <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: "#DCFCE7", color: "#166534" }}>
                          API
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] font-medium mt-0.5" style={{ color: COLORS.ink }}>
                      {d.value}
                    </p>
                  </div>
                ))}
              </div>
              {/* Fetched hydrospatial names — shown during simulation */}
              {prediction?.mode === "simulation" &&
                prediction?.hydrospatial &&
                (prediction.hydrospatial.river_name || prediction.hydrospatial.station_name) && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {prediction.hydrospatial.river_name && (
                      <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: "#F0FDF4" }}>
                        <p className="text-[11px]" style={{ color: "#166534" }}>
                          Nearest River
                        </p>
                        <p className="text-[12px] font-medium mt-0.5" style={{ color: COLORS.ink }}>
                          {prediction.hydrospatial.river_name}
                        </p>
                      </div>
                    )}
                    {prediction.hydrospatial.station_name && (
                      <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: "#F0FDF4" }}>
                        <p className="text-[11px]" style={{ color: "#166534" }}>
                          Gauging Station
                        </p>
                        <p className="text-[12px] font-medium mt-0.5" style={{ color: COLORS.ink }}>
                          {prediction.hydrospatial.station_name}
                        </p>
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}

          {/* Simulation vs live fields indicator */}
          {prediction?.simulation?.simulated_fields?.length > 0 && (
            <div className="mt-3 px-3 py-2 rounded-lg" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex flex-wrap gap-1.5">
                {prediction.simulation.simulated_fields.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                  >
                    Simulated: {f}
                  </span>
                ))}
                {(prediction.simulation.live_fields || []).map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ backgroundColor: "#ECFDF5", color: "#065F46" }}
                  >
                    Live: {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================= LIVE READINGS + DEVICE STATUS ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3 mb-3">
              <IconTile icon={Mountain} />
              <h2 className="text-[13px] sm:text-[14px] font-medium">Hydro-spatial insights</h2>
            </div>
            {!hydrospatial ? (
              <div className="rounded-xl border p-5 text-center" style={{ borderColor: COLORS.line, color: COLORS.muted }}>
                <p className="text-[13px]">Awaiting hydro-spatial analysis...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 ">
                {[
                  {
                    label: "Camp Elevation",
                    value: hydrospatial.elevation != null ? `${hydrospatial.elevation} m` : "—",
                    sub: hydrospatial.source || "—",
                  },
                  {
                    label: "Gauge Elevation",
                    value: hydrospatial.gauge_elevation != null ? `${hydrospatial.gauge_elevation} m` : "—",
                    sub: hydrospatial.station_name || "—",
                  },
                  {
                    label: "Elevation Δ",
                    value: hydrospatial.elevation_difference != null ? `${hydrospatial.elevation_difference} m` : "—",
                    sub:
                      hydrospatial.elevation_difference > 0
                        ? "Camp above gauge"
                        : hydrospatial.elevation_difference < 0
                          ? "Camp below gauge"
                          : "Same level",
                    icon: hydrospatial.elevation_difference > 0 ? TrendingUp : hydrospatial.elevation_difference < 0 ? TrendingDown : Minus,
                  },
                  {
                    label: "Gauge Distance",
                    value: hydrospatial.gauge_distance != null ? `${hydrospatial.gauge_distance} km` : "—",
                    sub: hydrospatial.gauge_distance != null ? `${(hydrospatial.gauge_distance * 0.621371).toFixed(1)} mi` : "—",
                  },
                ].map((d) => (
                  <div key={d.label} className="rounded-lg p-3 sm:p-3.5 min-h-34 bg-gray-50">
                    <span className="inline-block w-1.5 h-1.5 rounded-full mb-2 " style={{ backgroundColor: COLORS.brand }} />
                    <p className="text-[12px] sm:text-[12px] font-medium leading-tight">{d.label}</p>
                    <p className="text-[14px] sm:text-[15px] font-semibold mt-1">{d.value}</p>
                    <p className="text-[11px] sm:text-[11px] mt-0.5 truncate flex items-center gap-1" style={{ color: COLORS.muted }}>
                      {d.icon && <d.icon className="w-3 h-3 inline" />}
                      {d.sub}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {readings.length > 0 && (
            <div className="w-full lg:col-span-5">
              <div className="flex items-center gap-3 mb-3">
                <IconTile icon={Droplets} />
                <h2 className="text-[13px] sm:text-[14px] font-medium">Live readings</h2>
              </div>
              <div className="rounded-xl divide-y" style={{ backgroundColor: COLORS.grid }}>
                {readings.map((r) => (
                  <div
                    key={r.title}
                    className="flex items-center gap-3 sm:gap-3.5 px-3.5 sm:px-5 py-3.5 sm:py-4"
                    style={{ borderColor: COLORS.hairline }}
                  >
                    <IconTile icon={r.icon} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] sm:text-[13px] font-medium truncate">{r.title}</p>
                      <p className="text-[11px] sm:text-[12px] truncate mt-0.5" style={{ color: COLORS.muted }}>
                        {r.meta}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] sm:text-[14px] font-semibold">{r.value}</p>
                      <p className="text-[11px] sm:text-[11px]" style={{ color: COLORS.muted }}>
                        {r.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= ESCALATED ALERTS TABLE ================= */}
      <div className="mt-4 sm:mt-6">
        <div className="rounded-xl  overflow-hidden" style={{ background: "#fff", boxShadow: SHADOW_CARD }}>
          <div className="px-4 sm:px-5 py-3.5 border-b border-black/[.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" style={{ color: COLORS.brand }} />
              <h2 className="text-[14px] font-semibold" style={{ fontFamily: "Poppins, sans-serif" }}>
                Escalated Alerts
              </h2>
            </div>
            <span className="text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${COLORS.brand}12`, color: COLORS.brand }}>
              {alertsPagination.total} total
            </span>
          </div>
          <div className="px-4 sm:px-5 py-4">
            <DataTable
              columns={[
                {
                  key: "severity",
                  label: "Severity",
                  render: (v) => {
                    const colors = { CRITICAL: "#DC2626", HIGH: "#EA580C", MEDIUM: "#D97706", LOW: "#65A30D" };
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: `${colors[v] || "#6B7280"}14`, color: colors[v] || "#6B7280" }}
                      >
                        {v}
                      </span>
                    );
                  },
                },
                { key: "alert_type", label: "Type" },
                { key: "title", label: "Title", render: (v) => <span className="text-[12px] line-clamp-1 max-w-[200px]">{v}</span> },
                {
                  key: "flood_probability_percent",
                  label: "Prob %",
                  render: (v) => (v != null ? `${Math.round(v)}%` : "-"),
                },
                {
                  key: "water_level",
                  label: "Water Lvl",
                  render: (v) => (v != null ? `${Number(v).toFixed(2)} m` : "-"),
                },
                {
                  key: "river_distance_km",
                  label: "River Dist",
                  render: (v) => (v != null ? `${Number(v).toFixed(2)} km` : "-"),
                },
                {
                  key: "cloud_sync_status",
                  label: "Cloud Sync",
                  render: (v) => {
                    const colors = { SYNCED: "#16A34A", PENDING: "#D97706" };
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: colors[v] || "#6B7280" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[v] || "#6B7280" }} />
                        {v}
                      </span>
                    );
                  },
                },
                {
                  key: "created_at",
                  label: "Time",
                  render: (v) => {
                    const d = new Date(v);
                    return (
                      <span className="text-[11px] whitespace-nowrap">
                        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    );
                  },
                },
                {
                  key: "status",
                  label: "Status",
                  render: (v) => {
                    const colors = { ACTIVE: "#DC2626", ACKNOWLEDGED: "#2563EB" };
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: colors[v] || "#6B7280" }}>
                        {v}
                      </span>
                    );
                  },
                },
              ]}
              data={alerts}
              loading={alertsLoading}
              pageSize={15}
              searchKeys={["title", "alert_type", "severity", "camp_name"]}
              searchPlaceholder="Search alerts..."
              emptyMessage="No escalated alerts recorded yet"
              filters={[
                {
                  key: "severity",
                  label: "Severity",
                  options: [
                    { value: "CRITICAL", label: "Critical" },
                    { value: "HIGH", label: "High" },
                    { value: "MEDIUM", label: "Medium" },
                    { value: "LOW", label: "Low" },
                  ],
                },
                {
                  key: "cloud_sync_status",
                  label: "Cloud Sync",
                  options: [
                    { value: "SYNCED", label: "Synced" },
                    { value: "PENDING", label: "Pending" },
                  ],
                },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ================= FLOATING SIMULATION BUTTON ================= */}
      <button
        onClick={() => setShowSimModal(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full text-[13px] font-medium text-white transition-all hover:scale-105 active:scale-95"
        style={{ backgroundColor: isSimulating ? "#D97706" : COLORS.brand }}
        title="Open prediction simulation"
      >
        <FlaskConical className="w-4 h-4" />
        {isSimulating ? "Simulating" : "Simulate"}
      </button>

      {/* ================= SIMULATION MODAL ================= */}
      <SimulationModal
        open={showSimModal}
        onClose={() => setShowSimModal(false)}
        onSimulate={(data) => {
          setSimPrediction(data);
          setIsSimulating(true);
          setPrediction(data);
        }}
        onExitSimulation={() => {
          setIsSimulating(false);
          setSimPrediction(null);
          fetchAllDisasterData();
        }}
        isSimulating={isSimulating}
        simResult={simPrediction}
      />
    </div>
  );
}
