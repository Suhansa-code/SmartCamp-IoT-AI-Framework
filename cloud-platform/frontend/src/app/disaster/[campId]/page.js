"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Users,
  MapPin,
  HeartHandshake,
  Gauge,
  ArrowLeft,
  Droplets,
  CloudRain,
  Wind,
  Cloud,
  Activity,
  AlertTriangle,
  Mountain,
  Layers,
  Box,
  Triangle,
  ChevronRight,
  RefreshCw,
  Thermometer,
  Eye,
  Radio,
  Shield,
  Waves,
  TreePine,
} from "lucide-react";
import * as MapLibreGL from "maplibre-gl";
import { STATUS_META, statusColor, getCampById, CAMP_DETAIL, STATUS_COLOR } from "@/data/disaster.data";
import SideNav from "@/components/common/SideNav";
import Button from "@/components/common/Button";
import { useTheme } from "@/components/common/ThemeProvider";
import { Map, MapControls, useMap } from "@/components/ui/map";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { GaugingChart, WaterLevelBarChart } from "@/components/disaster/DisasterVisuals";

const PAGE_PAD = "clamp(1rem, 2vw, 1.75rem)";

const DISASTER_API_BASE = process.env.NEXT_PUBLIC_DISASTER_API_BASE_URL || "http://localhost:3002";

const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRAIN_SOURCE = "camp-detail-dem";
const TERRAIN_EXAGGERATION = 1.5;
const HILLSHADE_LAYER = "camp-detail-hillshade";
const SKY_LAYER = "camp-detail-sky";

const VIEW_MODES = ["2d", "3d", "terrain", "slope"];

/* ── Skeleton primitives ────────────────────────────────────────────────── */

function SkeletonLine({ w = "100%", h = 14, style = {} }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 9999,
        background: "linear-gradient(90deg, var(--sk-base) 25%, var(--sk-shine) 50%, var(--sk-base) 75%)",
        backgroundSize: "200% 100%",
        animation: "skeletonShimmer 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

function SkeletonBlock({ w = "100%", h = 120, r = 14, style = {} }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "linear-gradient(90deg, var(--sk-base) 25%, var(--sk-shine) 50%, var(--sk-base) 75%)",
        backgroundSize: "200% 100%",
        animation: "skeletonShimmer 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

function SkeletonCard({ children, delay = 0 }) {
  const { T } = useTheme();
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: "1.25rem",
        background: T.card,
        padding: "1.1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        "--sk-base": T.cardSoft,
        "--sk-shine": T.border,
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function CampMapSkeletonOverlay() {
  const { isLoaded } = useMap();
  if (isLoaded) return null;
  return (
    <div
      aria-label="Loading camp disaster map"
      className="absolute inset-0 z-[20] flex items-center justify-center p-6 pointer-events-none"
      style={{ background: "rgba(226,232,240,0.72)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="flex w-full max-w-[340px] flex-col gap-3 rounded-2xl p-4"
        style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(148,163,184,0.35)", boxShadow: "0 14px 32px rgba(15,23,42,0.12)" }}
      >
        <div className="map-detail-skeleton-line" style={{ width: "42%", height: 12 }} />
        <div className="map-detail-skeleton-line" style={{ width: "78%", height: 9 }} />
        <div className="map-detail-skeleton-grid">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="map-detail-skeleton-line" style={{ height: 38 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CampSkeleton() {
  const { T } = useTheme();
  return (
    <div style={{ minHeight: "100vh", paddingLeft: "var(--rail-width, 236px)", transition: "padding-left 0.2s ease" }}>
      <SideNav />
      <style>{`
        @keyframes skeletonShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .map-detail-skeleton-line { border-radius: 5px; background: linear-gradient(90deg, ${T.cardSoft} 25%, ${T.border} 50%, ${T.cardSoft} 75%); background-size: 200% 100%; animation: skeletonShimmer 1.5s ease-in-out infinite; }
        .map-detail-skeleton-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      `}</style>
      <div style={{ minHeight: "100vh", background: T.outer, fontFamily: "'Inter',sans-serif", color: T.ink }}>
        <main style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Header skeleton */}
          <div style={{ padding: `${PAGE_PAD} ${PAGE_PAD} 0`, display: "flex", flexDirection: "column", gap: 12 }}>
            <SkeletonLine w={260} h={10} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <SkeletonLine w={300} h={24} style={{ borderRadius: 6 }} />
                <SkeletonLine w={180} h={12} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <SkeletonBlock w={90} h={36} r={999} />
                <SkeletonBlock w={90} h={36} r={999} />
              </div>
            </div>
          </div>

          {/* Map skeleton */}
          <div style={{ padding: `1rem ${PAGE_PAD}` }}>
            <SkeletonBlock h={480} r={20} />
          </div>

          {/* Stats skeleton */}
          <div style={{ padding: `0 ${PAGE_PAD} ${PAGE_PAD}`, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} delay={i * 0.1}>
                  <SkeletonLine w={80} h={10} />
                  <SkeletonLine w={60} h={22} style={{ borderRadius: 6 }} />
                  <SkeletonLine w={100} h={8} />
                </SkeletonCard>
              ))}
            </div>

            {/* Two-col skeleton */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <SkeletonCard delay={0.4}>
                <SkeletonLine w={100} h={10} />
                <SkeletonBlock h={140} r={10} />
              </SkeletonCard>
              <SkeletonCard delay={0.5}>
                <SkeletonLine w={100} h={10} />
                <SkeletonBlock h={140} r={10} />
              </SkeletonCard>
            </div>

            {/* Environment + operational skeleton */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <SkeletonCard delay={0.6}>
                <SkeletonLine w={100} h={10} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <SkeletonBlock key={i} h={60} r={10} />
                  ))}
                </div>
              </SkeletonCard>
              <SkeletonCard delay={0.7}>
                <SkeletonLine w={100} h={10} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <SkeletonBlock key={i} h={60} r={10} />
                  ))}
                </div>
              </SkeletonCard>
            </div>

            {/* Alerts + hydrology skeleton */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <SkeletonCard delay={0.8}>
                <SkeletonLine w={100} h={10} />
                <SkeletonBlock h={80} r={10} />
              </SkeletonCard>
              <SkeletonCard delay={0.9}>
                <SkeletonLine w={100} h={10} />
                <SkeletonBlock h={100} r={10} />
              </SkeletonCard>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Map sub-components ──────────────────────────────────────────────── */

function CampMapView({ camp, dark, viewMode }) {
  const { map, isLoaded } = useMap();
  const markerRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (!map || !isLoaded || !camp) return;

    map.easeTo({
      center: [camp.lng, camp.lat],
      zoom: 12,
      pitch: viewMode !== "2d" ? 55 : 0,
      bearing: viewMode !== "2d" ? 25 : 0,
      duration: 1200,
      easing: (t) => t * (2 - t),
    });
  }, [map, isLoaded, camp, viewMode]);

  useEffect(() => {
    if (!map || !isLoaded || !camp) return;

    if (markerRef.current) markerRef.current.remove();

    const el = document.createElement("div");
    el.style.cssText = `
      width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
      background: ${STATUS_COLOR[camp.status]}; border: 3px solid #fff;
      box-shadow: 0 0 16px ${STATUS_COLOR[camp.status]}aa, 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.2s ease;
    `;
    el.addEventListener("mouseenter", () => {
      el.style.transform = "scale(1.2)";
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "scale(1)";
    });

    const popup = new MapLibreGL.Popup({ offset: 18, closeButton: false, className: "camp-detail-popup" }).setHTML(`
        <div style="padding: 8px 12px; font-family: Inter, sans-serif;">
          <div style="font-size: 13px; font-weight: 800; color: ${dark ? "#FAFAFA" : "#0F2540"}; margin-bottom: 2px;">${camp.name}</div>
          <div style="font-size: 11px; color: ${dark ? "#A1A1AA" : "#5B7184"};">${camp.code} · ${camp.type}</div>
        </div>
      `);

    const marker = new MapLibreGL.Marker({ element: el }).setLngLat([camp.lng, camp.lat]).setPopup(popup).addTo(map);

    markerRef.current = marker;
    popupRef.current = popup;

    el.addEventListener("click", () => popup.addTo(map));

    return () => {
      marker.remove();
      popup.remove();
    };
  }, [map, isLoaded, camp, dark]);

  return null;
}

function CampDetailTerrain({ viewMode }) {
  const { map, isLoaded } = useMap();
  const enableTerrain = viewMode === "terrain" || viewMode === "slope";
  const enableHillshade = enableTerrain;
  const isSlope = viewMode === "slope";

  useEffect(() => {
    if (!map || !isLoaded) return;

    if (enableTerrain) {
      if (!map.getSource(TERRAIN_SOURCE)) {
        map.addSource(TERRAIN_SOURCE, {
          type: "raster-dem",
          tiles: [TERRAIN_TILES],
          tileSize: 256,
          encoding: "terrarium",
          maxzoom: 12,
        });
      }
      map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: isSlope ? 1.0 : 1.5 });

      if (enableHillshade) {
        if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER);
        map.addLayer(
          {
            id: HILLSHADE_LAYER,
            type: "hillshade",
            source: TERRAIN_SOURCE,
            paint: {
              "hillshade-exaggeration": isSlope ? 1.0 : 0.8,
              "hillshade-illumination-direction": 315,
              "hillshade-shadow-color": isSlope ? "#1e293b" : "#0f172a",
              "hillshade-highlight-color": isSlope ? "#fef3c7" : "#f1f5f9",
              "hillshade-accent-color": isSlope ? "#f59e0b" : "#64748b",
            },
          },
          "waterway",
        );
      } else {
        if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER);
      }

      if (!map.getLayer(SKY_LAYER)) {
        map.addLayer({
          id: SKY_LAYER,
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-azimuthal-direction": 180,
            "sky-blend": "screen",
          },
        });
      }
    } else {
      map.setTerrain(null);
      if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER);
      if (map.getLayer(SKY_LAYER)) map.removeLayer(SKY_LAYER);
    }
  }, [map, isLoaded, enableTerrain, enableHillshade, isSlope, viewMode]);

  return null;
}

function MapViewController({ viewMode }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    let pitch, bearing;
    switch (viewMode) {
      case "3d":
        pitch = 45;
        bearing = 30;
        break;
      default:
        pitch = 0;
        bearing = 0;
    }

    map.easeTo({
      pitch,
      bearing,
      duration: 800,
      easing: (t) => t * (2 - t),
    });
  }, [map, isLoaded, viewMode]);

  return null;
}

/* ── UI primitives ────────────────────────────────────────────────────── */

function StatusBadge({ status, T }) {
  const meta = STATUS_META[status];
  const color = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: "0.6rem",
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: `${color}18`,
        border: `1px solid ${color}44`,
        color,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}88` }} />
      {meta?.label || status}
    </span>
  );
}

function DataRow({ label, value, tone }) {
  const { T } = useTheme();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 11, color: T.muted, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: tone || T.ink }}>{value}</span>
    </div>
  );
}

function RiskBar({ label, level, color, T }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, padding: "6px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ color: T.ink, fontWeight: 600 }}>{label}</span>
      </div>
      <span style={{ color, fontWeight: 800, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.06em" }}>{level}</span>
    </div>
  );
}

function InfoCard({ label, value, color, T }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: "0.85rem", background: T.cardSoft, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color, marginTop: 3, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function DisasterCampDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { T } = useTheme();
  const [camp, setCamp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState("terrain");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const campId = Array.isArray(params?.campId) ? params.campId[0] : params?.campId;
  const dark = T.mode === "dark";

  useEffect(() => {
    let active = true;

    async function loadCamp() {
      if (campId === "overview") {
        router.replace("/disaster");
        return;
      }
      if (!campId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}`);
        const payload = res.ok ? await res.json() : null;
        if (!active) return;
        if (payload) {
          setCamp(payload);
        } else {
          setCamp(null);
          setError("Camp not found");
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load camp detail");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCamp();
    return () => {
      active = false;
    };
  }, [campId, router]);

  const detail = camp?.detail || null;
  const prediction = camp?.prediction || null;
  const occupancy = camp ? Math.round((camp.displaced / camp.capacity) * 100) : 0;

  const [predResult, setPredResult] = useState(null);
  const [predLoading, setPredLoading] = useState(false);
  const [waterHistory, setWaterHistory] = useState([]);
  const [waterHistoryLoading, setWaterHistoryLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadPrediction() {
      if (!camp || camp.prediction) {
        setPredResult(camp?.prediction || null);
        return;
      }
      setPredLoading(true);
      try {
        const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}/predict`);
        if (!active) return;
        if (!res.ok) {
          setPredResult(null);
          return;
        }
        const body = await res.json();
        setPredResult(body.prediction || null);
      } catch {
        if (!active) return;
        setPredResult(null);
      } finally {
        if (active) setPredLoading(false);
      }
    }
    loadPrediction();
    return () => {
      active = false;
    };
  }, [camp, campId]);

  // Fetch water level history for gauging chart
  useEffect(() => {
    let active = true;
    async function loadWaterHistory() {
      if (!camp || !detail?.station) return;
      setWaterHistoryLoading(true);
      try {
        const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}/water-level-history?hours=8`);
        if (!active) return;
        if (res.ok) {
          const body = await res.json();
          setWaterHistory(body.points || []);
        } else {
          setWaterHistory([]);
        }
      } catch {
        if (!active) return;
        setWaterHistory([]);
      } finally {
        if (active) setWaterHistoryLoading(false);
      }
    }
    loadWaterHistory();
    return () => {
      active = false;
    };
  }, [camp, campId, detail?.station]);

  const refreshCamp = useCallback(async () => {
    if (!campId) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}`);
      const payload = res.ok ? await res.json() : null;
      if (payload) {
        setCamp(payload);
      } else {
        setError("Camp not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reload");
    } finally {
      setRefreshing(false);
    }
  }, [campId]);

  const handleStatusChange = useCallback(async (newStatus) => {
    if (!campId || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`${DISASTER_API_BASE}/api/disaster/camps/${campId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setCamp((prev) => prev ? { ...prev, status: newStatus } : prev);
      }
    } catch (err) {
      console.error("Failed to update camp status:", err);
    } finally {
      setStatusUpdating(false);
    }
  }, [campId, statusUpdating]);

  const waterTone = detail ? (detail.wl > detail.alertL ? T.red : detail.wl > 0 ? T.amber : T.teal) : T.teal;

  /* ── Loading ── */
  if (loading) return <CampSkeleton />;

  /* ── Not found ── */
  if (!camp) {
    return (
      <div style={{ minHeight: "100vh", paddingLeft: "var(--rail-width, 236px)", transition: "padding-left 0.2s ease" }}>
        <SideNav />
        <div
          style={{
            minHeight: "100vh",
            background: T.outer,
            display: "grid",
            placeItems: "center",
            color: T.ink,
            fontFamily: "'Inter',sans-serif",
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 440,
              width: "100%",
              border: `1px solid ${T.border}`,
              borderRadius: "1.5rem",
              padding: "2.25rem 2rem",
              background: T.card,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                margin: "0 auto 16px",
                background: `${T.red}14`,
                border: `1px solid ${T.red}33`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={22} style={{ color: T.red }} />
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: 8, letterSpacing: "-0.01em" }}>Camp Not Found</div>
            <div style={{ color: T.muted, fontSize: 13, marginBottom: 22, lineHeight: 1.6 }}>
              The requested disaster camp could not be found. It may have been removed or the link is incorrect.
            </div>
            <Button onClick={() => router.push("/disaster")} icon={<ArrowLeft size={15} />} style={{ margin: "0 auto" }}>
              Back to Camps
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main content ── */
  return (
    <div style={{ minHeight: "100vh", paddingLeft: "var(--rail-width, 236px)", transition: "padding-left 0.2s ease" }}>
      <SideNav />
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 9999px; }
        .camp-detail-popup .maplibregl-popup-content { border-radius: 12px !important; padding: 0 !important; box-shadow: 0 12px 32px rgba(0,0,0,0.2) !important; border: 1px solid ${T.border} !important; background: ${T.card} !important; }
        .camp-detail-popup .maplibregl-popup-tip { border-top-color: ${T.card} !important; }
        .cd-two { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 1rem; align-items: start; }
        .cd-three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .cd-pred-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
        .cd-env-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
        .cd-water { display: grid; grid-template-columns: 0.35fr 0.65fr; gap: 1rem; align-items: start; }
        .cd-crumb-btn { background: none; border: none; color: inherit; cursor: pointer; padding: 0; display: flex; align-items: center; gap: 4px; font-size: 12px; transition: color 0.15s ease; }
        .cd-crumb-btn:hover { color: ${T.teal}; }
        @media (max-width: 1100px) { .cd-two, .cd-pred-row, .cd-env-row { grid-template-columns: 1fr; } .cd-water { grid-template-columns: 1fr; } }
        @media (max-width: 700px) { .cd-three { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ minHeight: "100vh", background: T.panel, fontFamily: "'Inter',sans-serif", color: T.ink }}>
        <main style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* ── Breadcrumb + Header ─────────────────────────────── */}
          <div style={{ padding: `1.25rem ${PAGE_PAD} 0`, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.muted }}>
              <Button variant="ghost" circleIcon={false} onClick={() => router.push("/disaster")} style={{ fontSize: 12, padding: 0, gap: 4 }}>
                <ArrowLeft size={12} /> Disaster Operations
              </Button>
              <span style={{ opacity: 0.35 }}>/</span>
              <Button variant="ghost" circleIcon={false} onClick={() => router.push("/disaster")} style={{ fontSize: 12, padding: 0 }}>
                Camps
              </Button>
              <span style={{ opacity: 0.35 }}>/</span>
              <span style={{ color: T.ink, fontWeight: 700 }}>{camp.name}</span>
            </div>

            {/* header row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: "clamp(1.4rem, 2vw, 1.7rem)", fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.015em" }}>
                    {camp.name}
                  </h1>
                  <StatusBadge status={camp.status} T={T} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.muted, fontWeight: 500 }}>
                  <span style={{ fontWeight: 800, color: T.teal }}>{camp.code}</span>
                  <span style={{ opacity: 0.3 }}>·</span>
                  <span>{camp.type}</span>
                  {detail?.station && (
                    <>
                      <span style={{ opacity: 0.3 }}>·</span>
                      <span>{detail.station} station</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {camp.status !== "recovery" && (
                  <button
                    onClick={() => handleStatusChange("recovery")}
                    disabled={statusUpdating}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 14px", borderRadius: 8, fontSize: "0.7rem", fontWeight: 700,
                      background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0",
                      cursor: statusUpdating ? "not-allowed" : "pointer",
                      opacity: statusUpdating ? 0.6 : 1, transition: "all 0.15s",
                    }}
                  >
                    <Shield size={12} /> Mark as Recovery
                  </button>
                )}
                {camp.status !== "stable" && camp.status !== "recovery" && (
                  <button
                    onClick={() => handleStatusChange("stable")}
                    disabled={statusUpdating}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 14px", borderRadius: 8, fontSize: "0.7rem", fontWeight: 700,
                      background: "#F0F9FF", color: "#0284C7", border: "1px solid #BAE6FD",
                      cursor: statusUpdating ? "not-allowed" : "pointer",
                      opacity: statusUpdating ? 0.6 : 1, transition: "all 0.15s",
                    }}
                  >
                    <Shield size={12} /> Mark as Stable
                  </button>
                )}
                <Button variant="outline" circleIcon={false} onClick={() => router.push("/disaster")} icon={<ArrowLeft size={13} />}>
                  Overview
                </Button>
                <Button
                  variant="circleRefresh"
                  circleIcon={false}
                  onClick={refreshCamp}
                  disabled={refreshing}
                  icon={<RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />}
                  style={{ opacity: refreshing ? 0.55 : 1 }}
                ></Button>
              </div>
            </div>
          </div>

          {/* ── Large Interactive Map ────────────────────────────── */}
          <div style={{ padding: `1rem ${PAGE_PAD}` }}>
            <div
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: "1.25rem",
                background: T.card,
                overflow: "hidden",
              }}
            >
              {/* Map Header */}
              <div
                style={{
                  padding: "1.1rem 1.25rem 0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: `${T.teal}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MapPin size={16} style={{ color: T.teal }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Camp Overview Map</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>Interactive map with terrain visualization</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={12} style={{ color: T.teal }} />
                  <span style={{ fontSize: 11, color: T.muted }}>Lat:</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, fontFamily: "monospace" }}>
                    {camp.lat?.toFixed(4) ?? "—"}°
                  </span>
                  <span style={{ fontSize: 11, color: T.muted, marginLeft: 4 }}>Lng:</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, fontFamily: "monospace" }}>
                    {camp.lng?.toFixed(4) ?? "—"}°
                  </span>
                </div>
              </div>

              {/* Map container */}
              <div style={{ padding: "0 1.25rem 1rem" }}>
                <div
                  style={{
                    position: "relative",
                    borderRadius: "1rem",
                    overflow: "hidden",
                    height: "clamp(400px, 50vh, 600px)",
                    background: dark ? "#030c18" : "#ddeaf5",
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <Map center={[camp.lng, camp.lat]} zoom={12} className="absolute inset-0" theme={dark ? "dark" : "light"}>
                    <CampMapSkeletonOverlay />
                    <MapControls showZoom showLocate showCompass />
                    <MapViewController viewMode={viewMode} />
                    <CampDetailTerrain viewMode={viewMode} />
                    <CampMapView camp={camp} dark={dark} viewMode={viewMode} />
                  </Map>

                  {/* View mode toggle */}
                  <div
                    className="absolute z-[13] top-3 right-3 flex items-center rounded-full overflow-hidden"
                    style={{
                      background: dark ? "rgba(13,13,16,0.85)" : "rgba(255,255,255,0.9)",
                      border: `1px solid ${T.border}`,
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                    }}
                  >
                    {VIEW_MODES.map((m) => {
                      const active = viewMode === m;
                      const icon =
                        m === "2d" ? (
                          <Layers size={11} />
                        ) : m === "3d" ? (
                          <Box size={11} />
                        ) : m === "terrain" ? (
                          <Mountain size={11} />
                        ) : (
                          <Triangle size={11} />
                        );
                      return (
                        <button
                          key={m}
                          onClick={() => setViewMode(m)}
                          title={m.toUpperCase()}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "7px 12px",
                            fontSize: "0.6rem",
                            fontWeight: 800,
                            letterSpacing: "0.06em",
                            cursor: "pointer",
                            border: "none",
                            background: active ? T.teal : "transparent",
                            color: active ? "#fff" : T.muted,
                            transition: "all 0.2s ease",
                          }}
                        >
                          {icon} {m.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Camp label overlay */}
                  <div
                    className="absolute z-[13] bottom-3 left-3 flex items-center gap-2 rounded-xl px-3 py-2"
                    style={{
                      background: dark ? "rgba(13,13,16,0.85)" : "rgba(255,255,255,0.9)",
                      border: `1px solid ${T.border}`,
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: STATUS_COLOR[camp.status],
                        boxShadow: `0 0 10px ${STATUS_COLOR[camp.status]}88`,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, lineHeight: 1.2 }}>{camp.code}</div>
                      <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {STATUS_META[camp.status]?.label}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Footer */}
              <div
                style={{
                  padding: "0.75rem 1.25rem 1rem",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  borderTop: `1px solid ${T.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={12} style={{ color: T.teal }} />
                  <span style={{ fontSize: 11, color: T.muted }}>Latitude:</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: "monospace" }}>
                    {camp.lat?.toFixed(4) ?? "—"}°
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={12} style={{ color: T.teal }} />
                  <span style={{ fontSize: 11, color: T.muted }}>Longitude:</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: "monospace" }}>
                    {camp.lng?.toFixed(4) ?? "—"}°
                  </span>
                </div>
                {detail?.elev != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Mountain size={12} style={{ color: T.teal }} />
                    <span style={{ fontSize: 11, color: T.muted }}>Camp Elevation:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: "monospace" }}>
                      {detail.elev} m
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Content grid ─────────────────────────────────────── */}
          <div style={{ padding: `0 ${PAGE_PAD} ${PAGE_PAD}`, display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* ── Flood Prediction + Location + Active Alerts ── */}
            <div className="cd-pred-row">
              {/* Flood Prediction + Risk */}
              <DashboardCard title="Flood Prediction" subtitle="Risk model & live thresholds">
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Main probability display */}
                  {predResult && (
                    <div style={{ padding: "14px 16px", borderRadius: "0.85rem", background: T.cardSoft, border: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                          Flood Probability
                        </span>
                        <span
                          style={{
                            fontSize: 22,
                            fontWeight: 800,
                            color: predResult.probability >= 0.7 ? T.red : predResult.probability >= 0.4 ? T.amber : T.green,
                          }}
                        >
                          {Math.round(predResult.probability * 100)}%
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: T.border, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${Math.round(predResult.probability * 100)}%`,
                            height: "100%",
                            background: predResult.probability >= 0.7 ? T.red : predResult.probability >= 0.4 ? T.amber : T.green,
                            borderRadius: 999,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 8, fontSize: 10, color: T.muted }}>Source: {predResult.source}</div>
                      {predResult.roc_auc != null && (
                        <div style={{ marginTop: 4, fontSize: 10, color: T.muted }}>
                          Model Accuracy (AUC): {(predResult.roc_auc * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  )}

                  {/* Risk bars */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <RiskBar
                      label="Flood Risk"
                      level={prediction?.flood_possibility?.toLowerCase() || camp.status}
                      color={STATUS_COLOR[prediction?.flood_possibility?.toLowerCase() || camp.status] || T.amber}
                      T={T}
                    />
                    <RiskBar label="Camp Status" level={camp.status} color={STATUS_COLOR[camp.status]} T={T} />
                    {detail?.rain > 20 && <RiskBar label="Rainfall Alert" level="high" color={T.red} T={T} />}
                  </div>


                </div>
                {predLoading && (
                  <div style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
                    <RefreshCw size={11} className="animate-spin" /> Running flood model…
                  </div>
                )}
              </DashboardCard>

              {/* Location + Active Alerts stacked */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} className="h-full">
                <DashboardCard title="Location" subtitle="Coordinates & terrain context">
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <DataRow label="Latitude" value={`${camp.lat.toFixed(4)}°`} tone={T.teal} />
                    <DataRow label="Longitude" value={`${camp.lng.toFixed(4)}°`} tone={T.teal} />
                    {detail?.elev != null && <DataRow label="Elevation" value={`${detail.elev} m AMSL`} tone={T.ink} />}
                    {detail?.river && <DataRow label="Water body" value={detail.river} tone={T.ink} />}
                    {detail?.upDist != null && <DataRow label="Upstream dist." value={`${detail.upDist} m`} tone={T.ink} />}
                  </div>
                </DashboardCard>
              </div>
            </div>

            {/* ── Environment + Operational (side by side) ── */}
            <div className="cd-env-row">
              <DashboardCard title="Environment" subtitle="Live sensor readings">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  {detail?.wl != null && <InfoCard label="Water Level" value={`${detail.wl} m`} color={waterTone} T={T} />}
                  {detail?.rain != null && (
                    <InfoCard
                      label="Rainfall"
                      value={`${detail.rain} mm`}
                      color={detail.rain > 20 ? T.red : detail.rain > 5 ? T.amber : T.teal}
                      T={T}
                    />
                  )}
                  {detail?.hum != null && <InfoCard label="Humidity" value={`${detail.hum}%`} color={T.teal} T={T} />}
                  {detail?.pres != null && <InfoCard label="Pressure" value={`${detail.pres} hPa`} color={T.ink} T={T} />}
                  {detail?.minT != null && detail?.maxT != null && (
                    <InfoCard label="Temperature" value={`${detail.minT}–${detail.maxT}°C`} color={T.coral} T={T} />
                  )}
                  {detail?.soil != null && <InfoCard label="Soil Moisture" value={`${Math.round(detail.soil * 100)}%`} color={T.teal} T={T} />}
                </div>
              </DashboardCard>

              <DashboardCard title="Operational" subtitle="24h weather & logistics signal">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  {detail?.precip != null && (
                    <InfoCard label="Precip (24h)" value={`${detail.precip.toFixed(1)} mm`} color={detail.precip > 15 ? T.red : T.amber} T={T} />
                  )}
                  {detail?.maxWind != null && <InfoCard label="Max Wind" value={`${detail.maxWind} km/h`} color={T.ink} T={T} />}
                  {detail?.cloud != null && <InfoCard label="Cloud Cover" value={`${detail.cloud}%`} color={T.inkSoft} T={T} />}
                  {detail?.maxHrPrec != null && <InfoCard label="Peak Hourly" value={`${detail.maxHrPrec} mm/hr`} color={T.amber} T={T} />}
                </div>
              </DashboardCard>
            </div>

            {/* ── Hydrology ── */}
            <div className="flex flex-row w-full gap-2">
              <DashboardCard title="Hydrology" subtitle="Gauge station reference levels" style={{ flex: "0 0 40%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {detail?.station && <DataRow label="Station" value={detail.station} />}
                  {detail?.river && <DataRow label="River" value={detail.river} />}
                  {detail?.alertL != null && <DataRow label="Alert level" value={`${detail.alertL} m`} tone={T.amber} />}
                  {detail?.minorL != null && <DataRow label="Minor flood" value={`${detail.minorL} m`} />}
                  {detail?.majorL != null && <DataRow label="Major flood" value={`${detail.majorL} m`} tone={T.red} />}
                  {detail?.gauLat != null && <DataRow label="Gauge coords" value={`${detail.gauLat.toFixed(4)}°, ${detail.gauLng.toFixed(4)}°`} />}
                  {detail?.stDist != null && <DataRow label="Station dist." value={`${(detail.stDist / 1000).toFixed(1)} km`} />}
                </div>
              </DashboardCard>
              <DashboardCard title="Active Alerts" subtitle="Automated threshold monitoring" style={{ flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {detail?.wl > detail?.alertL && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: `${T.red}10`,
                        border: `1px solid ${T.red}33`,
                      }}
                    >
                      <AlertTriangle size={14} style={{ color: T.red, marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.red }}>Water level above alert threshold</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                          Current: {detail.wl} m · Alert: {detail.alertL} m
                        </div>
                      </div>
                    </div>
                  )}
                  {detail?.rain > 20 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: `${T.amber}10`,
                        border: `1px solid ${T.amber}33`,
                      }}
                    >
                      <CloudRain size={14} style={{ color: T.amber, marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.amber }}>Heavy rainfall detected</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{detail.rain} mm accumulated</div>
                      </div>
                    </div>
                  )}
                  {camp.status === "critical" && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: `${T.red}10`,
                        border: `1px solid ${T.red}33`,
                      }}
                    >
                      <Shield size={14} style={{ color: T.red, marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.red }}>Critical status active</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>Camp requires immediate attention</div>
                      </div>
                    </div>
                  )}
                  {!(detail?.wl > detail?.alertL) && !(detail?.rain > 20) && camp.status !== "critical" && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "12px",
                        borderRadius: 10,
                        background: `${T.green}10`,
                        border: `1px solid ${T.green}33`,
                        color: T.green,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <Activity size={14} /> No active alerts
                    </div>
                  )}
                </div>
              </DashboardCard>
              <div></div>
            </div>

            {/* ── Water Level Gauging Charts ── */}
            {(detail?.wl != null || waterHistory.length > 0) && (
              <div className="cd-water">
                {/* Water Level Bar Chart */}
                <DashboardCard title="Water Level Status" subtitle="Current level vs. thresholds">
                  <WaterLevelBarChart
                    currentWl={detail?.wl}
                    alertL={detail?.alertL}
                    minorL={detail?.minorL}
                    majorL={detail?.majorL}
                    station={detail?.station}
                    theme={T}
                  />
                </DashboardCard>

                {/* Gauging History Chart */}
                <DashboardCard
                  title="Gauging History"
                  subtitle={waterHistoryLoading ? "Loading station data…" : `8-hour trend from ${detail?.station || "nearest station"}`}
                  right={waterHistoryLoading ? <RefreshCw size={12} className="animate-spin" style={{ color: T.muted }} /> : null}
                >
                  <GaugingChart
                    points={waterHistory}
                    alertL={detail?.alertL}
                    minorL={detail?.minorL}
                    majorL={detail?.majorL}
                    station={detail?.station}
                    theme={T}
                  />
                </DashboardCard>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
