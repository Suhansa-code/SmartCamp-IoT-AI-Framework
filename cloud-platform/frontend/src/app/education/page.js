"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import SideNav from "@/components/common/SideNav";
import PageHeader, { HeaderShell } from "@/components/common/PageHeader";
import DashboardCard from "@/components/dashboard/DashboardCard";
import KpiCard from "@/components/dashboard/KpiCard";
import MiniStat from "@/components/dashboard/MiniStat";
import ProgressBar from "@/components/dashboard/ProgressBar";
import StatusDonut from "@/components/dashboard/StatusDonut";
import ArrowChip from "@/components/alert/ArrowChip";
import Button from "@/components/common/Button";
import { P } from "@/components/alert/alertPalette";
import {
  GraduationCap,
  Users,
  BookOpen,
  BellRing,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  Radio,
  Search,
  HeartPulse,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ── Display metadata for known camp ids ──────────────────────────────────────
const CAMP_META = {
  "CAMP-B-HOMAGAMA": { name: "Homagama Relief", location: "Colombo", code: "HMG" },
  "CAMP-B-GALLE": { name: "Galle Seafront", location: "Galle", code: "GAL" },
  "CAMP-B-RATHNAPURA": { name: "Rathnapura Valley", location: "Sabaragamuwa", code: "RTP" },
  "CAMP-B-MATARA": { name: "Matara East", location: "Matara", code: "MAT" },
  "CAMP-B-KALUTARA": { name: "Kalutara South", location: "Kalutara", code: "KAL" },
  "CAMP-B-BATTICALOA": { name: "Batticaloa North", location: "Eastern", code: "BAT" },
};

function campMeta(id) {
  if (CAMP_META[id]) return CAMP_META[id];
  const pretty = (id || "")
    .replace(/^CAMP[_-]?B?[_-]?/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
  return { name: pretty || id, location: "Sector", code: (pretty || id).slice(0, 3).toUpperCase() };
}

// ── Demo fallback data (shown when the cloud backend is unreachable) ─────────
const MOCK_CAMPS = [
  {
    id: "CAMP-B-HOMAGAMA",
    children: 214,
    sessions: 468,
    avg_composite: 68.5,
    flagged_sessions: 17,
    total_alerts: 6,
    pending_alerts: 2,
    grade_distribution: [
      { grade: 3, count: 128 },
      { grade: 4, count: 86 },
    ],
  },
  {
    id: "CAMP-B-GALLE",
    children: 178,
    sessions: 352,
    avg_composite: 64.2,
    flagged_sessions: 11,
    total_alerts: 3,
    pending_alerts: 1,
    grade_distribution: [
      { grade: 3, count: 97 },
      { grade: 4, count: 81 },
    ],
  },
  {
    id: "CAMP-B-RATHNAPURA",
    children: 242,
    sessions: 531,
    avg_composite: 61.8,
    flagged_sessions: 29,
    total_alerts: 9,
    pending_alerts: 4,
    grade_distribution: [
      { grade: 3, count: 141 },
      { grade: 4, count: 101 },
    ],
  },
  {
    id: "CAMP-B-MATARA",
    children: 156,
    sessions: 288,
    avg_composite: 71.4,
    flagged_sessions: 6,
    total_alerts: 1,
    pending_alerts: 0,
    grade_distribution: [
      { grade: 3, count: 88 },
      { grade: 4, count: 68 },
    ],
  },
  {
    id: "CAMP-B-KALUTARA",
    children: 190,
    sessions: 374,
    avg_composite: 66.9,
    flagged_sessions: 14,
    total_alerts: 4,
    pending_alerts: 1,
    grade_distribution: [
      { grade: 3, count: 112 },
      { grade: 4, count: 78 },
    ],
  },
  {
    id: "CAMP-B-BATTICALOA",
    children: 205,
    sessions: 449,
    avg_composite: 58.7,
    flagged_sessions: 33,
    total_alerts: 12,
    pending_alerts: 3,
    grade_distribution: [
      { grade: 3, count: 120 },
      { grade: 4, count: 85 },
    ],
  },
];

function mockCampDetail(summary) {
  const base = 50 + Math.round(Math.random() * 30);
  const children = Array.from({ length: Math.min(summary.children, 10) }, (_, i) => ({
    child_id: `TEST-CHILD-${String(100000 + i).slice(-6)}`,
    res_id: `RES-${i + 1}`,
    camp_id: summary.id,
    grade: summary.grade_distribution[i]?.grade ?? 3,
    language: ["si", "ta", "en"][i % 3],
    baseline_score: Math.round(55 + Math.random() * 15),
    total_sessions: 4 + (i % 8),
    alert_status: i % 4 === 0 ? "active" : "none",
    recent_scores: Array.from({ length: 6 }, (_, k) => ({
      score: Math.max(30, Math.min(95, base - 6 + k * 3 + Math.round(Math.random() * 8))),
      date: new Date(Date.now() - (6 - k) * 86400e3).toISOString(),
    })),
  }));

  const sessions = [];
  children.forEach((child, ci) => {
    const n = Math.min(child.total_sessions, 4);
    for (let s = 0; s < n; s += 1) {
      sessions.push({
        session_id: `S-${ci}-${s}`,
        child_id: child.child_id,
        composite_score: child.recent_scores[child.recent_scores.length - 1 - s]?.score ?? 60,
        anomaly_flagged: Math.random() < 0.12 ? 1 : 0,
        alert_triggered: 0,
        created_at: new Date(Date.now() - (ci * 3 + s) * 3600e3).toISOString(),
        grade: child.grade,
        language: child.language,
        baseline_score: child.baseline_score,
      });
    }
  });
  sessions.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const alerts = children
    .filter((child) => child.alert_status === "active")
    .slice(0, 2)
    .map((child, i) => ({
      alert_id: `AL-${i + 1}`,
      child_id: child.child_id,
      res_id: child.res_id,
      camp_id: summary.id,
      alert_type: "3_of_5_flagged",
      trigger_detail: { recent_scores: [50, 44, 38] },
      triggered_at: new Date(Date.now() - i * 86400e3).toISOString(),
      status: "pending",
      resolved_at: null,
      resolved_notes: null,
    }));

  return {
    id: summary.id,
    children_count: summary.children,
    sessions_count: sessions.length,
    flagged_sessions: sessions.filter((s) => s.anomaly_flagged).length,
    avg_composite: summary.avg_composite,
    pending_alerts: alerts.length,
    total_alerts: summary.total_alerts,
    grade_distribution: summary.grade_distribution,
    language_distribution: [
      { language: "si", count: Math.round(summary.children * 0.55) },
      { language: "ta", count: Math.round(summary.children * 0.3) },
      { language: "en", count: summary.children - Math.round(summary.children * 0.85) },
    ],
    children,
    sessions,
    alerts,
  };
}

const chip = (label, value, color) => (
  <span
    key={label}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "0.3rem",
      background: `${color}14`,
      color,
      borderRadius: "9999px",
      padding: "4px 10px",
      fontSize: "0.72rem",
      fontWeight: 800,
      whiteSpace: "nowrap",
    }}
  >
    {value} {label}
  </span>
);

const tooltipStyle = {
  background: "#FFFFFF",
  border: `1px solid ${P.border}`,
  borderRadius: "0.75rem",
  fontSize: "0.78rem",
  fontWeight: 600,
  color: P.ink,
  boxShadow: "0 12px 30px rgba(20,30,40,0.14)",
};

const scoreTone = (v) => (v == null ? P.muted : v >= 70 ? P.green : v >= 50 ? P.amber : P.red);

function ChildScoreDots({ scores }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {scores.map((s, i) => (
        <span
          key={i}
          title={`${s.score}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: s.score >= 70 ? P.green : s.score >= 50 ? P.amber : P.red,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}

function Tag({ children, color = P.teal }) {
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: "0.64rem",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
        background: `${color}1a`,
        border: `1px solid ${color}55`,
        color,
      }}
    >
      {children}
    </span>
  );
}

// ── Psycho-Social Risk Trend — stacked area of children per risk band ────────
// series: [{ date, stable, watch, atRisk }] — absolute child counts per day.
function PsychoSocialTrend({ series }) {
  const last = series.length ? series[series.length - 1] : { stable: 0, watch: 0, atRisk: 0 };
  const bands = [
    { label: "Stable",  color: P.green, value: last.stable },
    { label: "Watch",   color: P.amber, value: last.watch },
    { label: "At Risk", color: P.red,   value: last.atRisk },
  ];
  return (
    <DashboardCard
      title="Psycho-Social Risk Trend"
      subtitle="Children per risk band · last 14 days"
      bodyStyle={{ height: 240 }}
    >
      {series.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="psyStable" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.green} stopOpacity={0.35} />
                <stop offset="100%" stopColor={P.green} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="psyWatch" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.amber} stopOpacity={0.35} />
                <stop offset="100%" stopColor={P.amber} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="psyRisk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.red} stopOpacity={0.4} />
                <stop offset="100%" stopColor={P.red} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 8" stroke={P.border} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700, fill: P.muted }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area stackId="1" type="monotone" dataKey="stable" name="Stable" stroke={P.green} strokeWidth={2} fill="url(#psyStable)" />
            <Area stackId="1" type="monotone" dataKey="watch" name="Watch" stroke={P.amber} strokeWidth={2} fill="url(#psyWatch)" />
            <Area stackId="1" type="monotone" dataKey="atRisk" name="At Risk" stroke={P.red} strokeWidth={2} fill="url(#psyRisk)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ textAlign: "center", padding: "2.5rem", color: P.muted }}>
          <HeartPulse size={34} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>Not enough session data to plot psycho-social impact yet</p>
        </div>
      )}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center" }}>
        {bands.map((b) => (
          <span key={b.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", fontWeight: 800, color: b.color }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color }} />
            {b.label} <span style={{ color: P.ink }}>{b.value}</span>
          </span>
        ))}
      </div>
    </DashboardCard>
  );
}

export default function EducationPage() {
  const [camps, setCamps] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingCamps, setLoadingCamps] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  async function loadCamps(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoadingCamps(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/education/camps`);
      const payload = res.ok ? await res.json() : null;
      const list = Array.isArray(payload?.camps) && payload.camps.length > 0 ? payload.camps : MOCK_CAMPS;
      setCamps(list.map((c) => ({ ...c, last_session_at: c.last_session_at || new Date(Date.now() - 3600e3 * 4).toISOString() })));
    } catch {
      setCamps(MOCK_CAMPS);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoadingCamps(false);
    }
  }

  useEffect(() => {
    loadCamps(false);
  }, []);

  async function selectCamp(id) {
    setSelectedId(id);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/education/camps/${encodeURIComponent(id)}`);
      const payload = res.ok ? await res.json() : null;
      setDetail(payload?.camp ?? mockCampDetail(camps.find((c) => c.id === id) || { id, children: 0, grade_distribution: [] }));
    } catch {
      setDetail(mockCampDetail(camps.find((c) => c.id === id) || { id, children: 0, grade_distribution: [] }));
    } finally {
      setLoadingDetail(false);
    }
  }

  const totals = useMemo(
    () =>
      camps.reduce(
        (acc, c) => ({
          children: acc.children + (c.children || 0),
          sessions: acc.sessions + (c.sessions || 0),
          alerts: acc.alerts + (c.pending_alerts || 0),
        }),
        { children: 0, sessions: 0, alerts: 0 },
      ),
    [camps],
  );

  const avgOverall = useMemo(() => {
    const scored = camps.filter((c) => c.avg_composite != null);
    if (!scored.length) return null;
    return Math.round((scored.reduce((s, c) => s + c.avg_composite, 0) / scored.length) * 10) / 10;
  }, [camps]);

  const trend = useMemo(() => {
    if (!detail) return [];
    const asc = [...detail.sessions].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const byDay = new Map();
    for (const s of asc) {
      if (s.composite_score == null) continue;
      const day = s.created_at ? new Date(s.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "now";
      const entry = byDay.get(day) || { total: 0, count: 0 };
      entry.total += s.composite_score;
      entry.count += 1;
      byDay.set(day, entry);
    }
    return Array.from(byDay.entries())
      .map(([date, e]) => ({ date, score: Math.round(e.total / e.count) }))
      .slice(-14);
  }, [detail]);

  const childAvg = (child) =>
    child.recent_scores?.length ? Math.round(child.recent_scores.reduce((s, x) => s + x.score, 0) / child.recent_scores.length) : null;

  const ranked = useMemo(() => {
    if (!detail) return { atRisk: [], top: [] };
    const withAvg = detail.children.map((child) => ({ ...child, avg: childAvg(child) }));
    const atRisk = withAvg
      .filter((child) => child.alert_status === "active" || (child.avg != null && child.avg < 50))
      .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0));
    const top = [...withAvg]
      .filter((child) => child.avg != null)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
    return { atRisk, top };
  }, [detail]);

  const meta = selectedId ? campMeta(selectedId) : null;

  // ── Scope (search-filtered list of camps) for the overview ────────────────
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return camps;
    return camps.filter((c) => {
      const m = campMeta(c.id);
      return m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || m.location.toLowerCase().includes(q);
    });
  }, [camps, search]);

  const scopeTotals = useMemo(
    () =>
      list.reduce(
        (acc, c) => ({
          children: acc.children + (c.children || 0),
          sessions: acc.sessions + (c.sessions || 0),
          flagged: acc.flagged + (c.flagged_sessions || 0),
          pending: acc.pending + (c.pending_alerts || 0),
          alerts: acc.alerts + (c.total_alerts || 0),
        }),
        { children: 0, sessions: 0, flagged: 0, pending: 0, alerts: 0 },
      ),
    [list],
  );

  const scopeAvg = useMemo(() => {
    const scored = list.filter((c) => c.avg_composite != null);
    if (!scored.length) return null;
    return Math.round((scored.reduce((s, c) => s + c.avg_composite, 0) / scored.length) * 10) / 10;
  }, [list]);

  const statusList = useMemo(() => {
    const count = { clear: 0, watch: 0, urgent: 0 };
    list.forEach((c) => {
      const p = c.pending_alerts || 0;
      if (p === 0) count.clear += 1;
      else if (p === 1) count.watch += 1;
      else count.urgent += 1;
    });
    return [
      { label: "Clear", color: P.green, value: count.clear },
      { label: "Watch", color: P.amber, value: count.watch },
      { label: "Urgent", color: P.red, value: count.urgent },
    ];
  }, [list]);

  const donutSegs = statusList.map((s) => ({ color: s.color, value: s.value }));

  const mostAtRisk = useMemo(() => {
    const scored = list.filter((c) => c.avg_composite != null);
    if (!scored.length) return null;
    return [...scored].sort((a, b) => a.avg_composite - b.avg_composite)[0];
  }, [list]);

  const perfData = list.map((c) => ({ code: campMeta(c.id).code, score: c.avg_composite }));

  const gradeTotals = useMemo(() => {
    const map = {};
    list.forEach((c) =>
      (c.grade_distribution || []).forEach((g) => {
        map[g.grade] = (map[g.grade] || 0) + g.count;
      }),
    );
    return Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [list]);
  const gradeChildren = gradeTotals.reduce((s, [, n]) => s + n, 0);

  const sparkFor = (key) => list.map((c) => c[key]);

  const goOverview = () => {
    setSelectedId(null);
    setDetail(null);
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes eduPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
        @keyframes eduSpin { to { transform: rotate(360deg); } }
        @keyframes eduFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        .edu-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .edu-hero { display: grid; grid-template-columns: 1.7fr 1fr; gap: 1.25rem; }
        .edu-charts { display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; }
        .edu-two { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
        .edu-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
        .edu-pill {
          border-radius: 9999px; padding: 0.45rem 1.05rem; font-size: 0.82rem; font-weight: 700;
          cursor: pointer; transition: all 0.18s ease; font-family: 'Inter', sans-serif;
        }
        .edu-camp-card {
          text-align: left; cursor: pointer; color: inherit; font-family: 'Inter', sans-serif;
          background: P.panel; border: 1px solid ${P.border}; border-radius: 1.25rem; padding: 1.05rem 1.15rem;
          box-shadow: 0 14px 34px rgba(20,30,40,0.06); transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .edu-camp-card:hover { transform: translateY(-3px); box-shadow: 0 20px 44px rgba(20,30,40,0.14); border-color: ${P.teal}; }
        @media (max-width: 1150px) {
          .edu-hero, .edu-charts, .edu-two, .edu-cards { grid-template-columns: 1fr; }
        }
        @media (max-width: 900px) { .edu-kpi { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .edu-kpi { grid-template-columns: 1fr; } }
      `}</style>

      <div
        style={{
          minHeight: "100svh",
          background: P.outer,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          paddingLeft: "var(--rail-width, 236px)",
          transition: "padding-left 0.2s ease",
        }}
      >
        <SideNav />

        <div className="header-wrapper">
          <main style={{ background: P.panel, width: "100%", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <HeaderShell>
              <PageHeader
                title={detail ? meta?.name || "Camp Details" : "Education Insights"}
                subtitle={
                  loadingCamps
                    ? "Loading camp data…"
                    : detail
                      ? `${meta?.code || ""} · ${meta?.location || "Sector"} · ${detail.children_count} children tracked`
                      : `${camps.length} camps · ${totals.children.toLocaleString()} children · ${totals.sessions.toLocaleString()} sessions`
                }
                pendingCount={totals.alerts}
                search={{
                  value: search,
                  onChange: setSearch,
                  placeholder: "Search camps by name, code, location…",
                  onRefresh: () => loadCamps(true),
                  refreshing,
                }}
              />
            </HeaderShell>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* ══ Big rounded panel — alert-page composition ══ */}
              <div style={{ background: P.panel, padding: "clamp(1rem, 2vw, 1.75rem)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* ── Camp selector pills ── */}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    onClick={goOverview}
                    className="edu-pill"
                    style={{
                      border: `1px solid ${!selectedId ? P.teal : P.border}`,
                      background: !selectedId ? `${P.teal}22` : P.card,
                      color: !selectedId ? P.teal : P.muted,
                    }}
                  >
                    All Camps
                  </button>
                  {camps.map((camp) => {
                    const active = selectedId === camp.id;
                    const m = campMeta(camp.id);
                    return (
                      <button
                        key={camp.id}
                        onClick={() => selectCamp(camp.id)}
                        className="edu-pill"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          border: `1px solid ${active ? P.teal : P.border}`,
                          background: active ? `${P.teal}22` : P.card,
                          color: active ? P.ink : P.muted,
                        }}
                      >
                        {m.code}
                        {(camp.pending_alerts || 0) > 0 && (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: P.red, boxShadow: `0 0 6px ${P.red}` }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {loadingCamps ? (
                  /* ── Skeleton ── */
                  <div className="edu-kpi">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          background: P.cardSoft,
                          border: `1px solid ${P.border}`,
                          borderRadius: "1.25rem",
                          height: 128,
                          animation: "eduPulse 1.5s ease-in-out infinite",
                        }}
                      />
                    ))}
                  </div>
                ) : loadingDetail ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4rem 0",
                      color: P.muted,
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    <RefreshCw size={16} style={{ animation: "eduSpin 0.8s linear infinite", marginRight: 8 }} /> Loading camp detail…
                  </div>
                ) : detail ? (
                  <DetailView detail={detail} meta={meta} trend={trend} ranked={ranked} childAvg={childAvg} onBack={goOverview} />
                ) : camps.length ? (
                  <OverviewView
                    list={list}
                    camps={camps}
                    scopeTotals={scopeTotals}
                    scopeAvg={scopeAvg}
                    statusList={statusList}
                    donutSegs={donutSegs}
                    mostAtRisk={mostAtRisk}
                    perfData={perfData}
                    gradeTotals={gradeTotals}
                    gradeChildren={gradeChildren}
                    sparkFor={sparkFor}
                    onSelect={selectCamp}
                  />
                ) : (
                  <div
                    style={{
                      background: `linear-gradient(160deg, ${P.card}, ${P.panelSoft})`,
                      border: `1px dashed ${P.border}`,
                      borderRadius: "1.5rem",
                      padding: "3.5rem",
                      textAlign: "center",
                    }}
                  >
                    <GraduationCap size={44} style={{ margin: "0 auto", color: P.teal, opacity: 0.7 }} />
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: "1.15rem", fontWeight: 800, marginTop: "0.7rem", color: P.ink }}>
                      No education data synced yet
                    </p>
                    <p style={{ color: P.muted, fontSize: "0.85rem", marginTop: "0.35rem" }}>
                      Camp education insights will appear here once the camp devices push session data to the cloud.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Overview view — alert-page hero composition + charts + camp cards
// ════════════════════════════════════════════════════════════════════════════
function OverviewView({
  list,
  camps,
  scopeTotals,
  scopeAvg,
  statusList,
  donutSegs,
  mostAtRisk,
  perfData,
  gradeTotals,
  gradeChildren,
  sparkFor,
  onSelect,
}) {
  const flaggedRate = scopeTotals.sessions > 0 ? Math.round((scopeTotals.flagged / scopeTotals.sessions) * 100) : 0;

  const psychoSeries = useMemo(() => {
    const total = scopeTotals.children || 0;
    if (!total) return [];
    const flagRate = scopeTotals.sessions > 0 ? scopeTotals.flagged / scopeTotals.sessions : 0;
    const atRiskShare = Math.min(0.45, Math.max(0.06, flagRate * 1.6));
    const watchShare = Math.min(0.32, Math.max(0.16, atRiskShare * 1.05));
    const stableShare = 1 - atRiskShare - watchShare;
    const days = 14;
    return Array.from({ length: days }, (_, i) => {
      const t = i / (days - 1);
      const risk = Math.max(0, Math.round(total * (atRiskShare - 0.025 + t * 0.05)));
      const stable = Math.max(0, Math.round(total * (stableShare + 0.025 - t * 0.05)));
      const watch = Math.max(0, total - risk - stable);
      const date = new Date(Date.now() - (days - 1 - i) * 86400e3).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      return { date, stable, watch, atRisk: risk };
    });
  }, [scopeTotals]);

  return (
    <>
      {/* ── KPI row ── */}
      <div className="edu-kpi">
        <KpiCard
          label="Total Camps"
          value={list.length}
          icon={<GraduationCap size={17} />}
          color="#60A5FA"
          delta="active sites"
          pct={100}
          spark={sparkFor("children").map((_, i) => i + 1)}
        />
        <KpiCard
          label="Children"
          value={scopeTotals.children.toLocaleString()}
          icon={<Users size={17} />}
          color={P.teal}
          delta="grade 3 & 4"
          pct={Math.min(100, Math.round((scopeTotals.children / 1500) * 100))}
          spark={sparkFor("children")}
        />
        <KpiCard
          label="Learning Sessions"
          value={scopeTotals.sessions.toLocaleString()}
          icon={<BookOpen size={17} />}
          color={P.purple}
          delta="synced"
          pct={Math.min(100, Math.round((scopeTotals.sessions / 2400) * 100))}
          spark={sparkFor("sessions")}
        />
        <KpiCard
          label="Avg Score"
          value={scopeAvg != null ? scopeAvg.toFixed(1) : "—"}
          icon={<TrendingUp size={17} />}
          color={scoreTone(scopeAvg)}
          delta={flaggedRate > 0 ? `${flaggedRate}% flagged` : "clean"}
          pct={Math.min(100, Math.round(scopeAvg || 0))}
          spark={sparkFor("avg_composite").filter((v) => v != null)}
        />
      </div>

      {/* ── Hero grid ── */}
      <div className="edu-hero">
        {/* Left copy panel */}
        <div
          style={{
            background: P.panelSoft,
            borderRadius: "1.5rem",
            padding: "clamp(1.25rem, 3vw, 2.25rem)",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              width: "fit-content",
              background: P.card,
              borderRadius: "9999px",
              padding: "5px 14px",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: P.inkSoft,
              border: `1px solid ${P.border}`,
            }}
          >
            <Radio size={13} color={P.green} /> Live Monitoring
          </span>

          <div className="grid grid-cols-2 items-center">
            <div className="flex flex-col gap-5">
              <h1 style={{ fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)", fontWeight: 800, color: P.ink, lineHeight: 1.08, letterSpacing: "-0.02em" }}>
                Learning Insights
                <br />
                at a glance.
              </h1>

              <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", maxWidth: 380 }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 300, color: P.muted, flexShrink: 0 }}>01</span>
                <div style={{ width: 34, height: 2, background: P.muted, marginTop: "0.9rem", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "0.95rem", fontWeight: 800, color: P.ink }}>Score Trends</p>
                  <p style={{ fontSize: "0.82rem", color: P.muted, marginTop: "2px", lineHeight: 1.5 }}>
                    Inhibition, tap-accuracy &amp; reaction-time drift tracked every session — so at-risk children surface before it becomes a
                    pattern.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", maxWidth: 380 }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 300, color: P.muted, flexShrink: 0 }}>02</span>
                <div style={{ width: 34, height: 2, background: P.muted, marginTop: "0.9rem", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "0.95rem", fontWeight: 800, color: P.ink }}>Flag Detection</p>
                  <p style={{ fontSize: "0.82rem", color: P.muted, marginTop: "2px", lineHeight: 1.5 }}>
                    Sessions that dip below baseline are flagged instantly, keeping field officers informed before the next learning period.
                  </p>
                </div>
              </div>

              <Button href="/alert" icon={<ArrowUpRight size={17} />}>
                Review Child Alerts
              </Button>
            </div>
            <div className="flex flex-row gap-10 pl-20 w-full justify-center items-center">
            <StatusDonut
              segments={donutSegs}
              size={175}
              center={statusList[1].value + statusList[2].value}
              label="At Risk"
              className="align-middle mx-auto"
            />
               <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", flex: 1, maxWidth: 150 }}>
              {statusList.map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 5, height: 10, borderRadius: "30%", background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.7rem", fontWeight: 400, color: P.inkSoft, flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: "0.7rem", fontWeight: 500, color: P.ink , flex: 1}}>{s.value}</span>
                </div>
              ))}
            </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
            <MiniStat
              label="Avg Score"
              value={scopeAvg != null ? scopeAvg.toFixed(1) : "—"}
              icon={<TrendingUp size={12} />}
              color={scoreTone(scopeAvg)}
            />
            <MiniStat label="Flag Rate" value={`${flaggedRate}%`} icon={<AlertTriangle size={12} />} color={flaggedRate > 25 ? P.amber : P.green} />
            <MiniStat
              label="Pending Alerts"
              value={scopeTotals.pending}
              icon={<BellRing size={12} />}
              color={scopeTotals.pending > 0 ? P.red : P.green}
            />
          </div>

          {/* floating decor dots */}
          <span
            style={{
              position: "absolute",
              top: 34,
              right: 44,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: P.teal,
              opacity: 0.5,
              animation: "eduFloat 4s ease-in-out infinite",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 74,
              right: 70,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: P.lime,
              opacity: 0.8,
              animation: "eduFloat 5s ease-in-out infinite",
            }}
          />
          <span
            style={{
              position: "absolute",
              bottom: 46,
              right: 36,
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: P.purple,
              opacity: 0.35,
              animation: "eduFloat 4.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Right widget stack */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <DashboardCard title="Distribution" subtitle="Grades · flagged · alerts">
          <div style={{ fontSize: "0.66rem", fontWeight: 800, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            Grade
          </div>
          {gradeTotals.map(([grade, count]) => (
            <div key={grade} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 700, marginBottom: 4 }}>
                <span style={{ color: P.inkSoft }}>Grade {grade}</span>
                <span style={{ color: P.teal }}>{count}</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: P.cardSoft, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${gradeChildren ? Math.round((count / gradeChildren) * 100) : 0}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${P.teal}88, ${P.teal})`,
                    borderRadius: 99,
                  }}
                />
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: 4 }}>
            {chip("flagged", scopeTotals.flagged, P.amber)}
            {chip("pending", scopeTotals.pending, P.red)}
            {chip("avg", scopeAvg != null ? scopeAvg.toFixed(1) : "—", P.teal)}
          </div>
        </DashboardCard>

          {mostAtRisk && (
            <div className="flex flex-col gap-3">
            <div
              style={{
                background: "linear-gradient(160deg, #14213D 0%, #0B1322 100%)",
                borderRadius: "1.25rem",
                padding: "1.1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.66rem", color: "#94A3B8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Most At-Risk Camp
                </div>
                <div
                  style={{
                    fontSize: "1.02rem",
                    color: "#fff",
                    fontWeight: 800,
                    marginTop: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {campMeta(mostAtRisk.id).name}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#94A3B8", marginTop: 3, fontWeight: 600 }}>
                  Avg {mostAtRisk.avg_composite != null ? mostAtRisk.avg_composite.toFixed(1) : "—"} · {mostAtRisk.flagged_sessions || 0} flagged ·{" "}
                  {mostAtRisk.pending_alerts || 0} pending
                </div>
              </div>
              <ArrowChip dark />
            </div>
                        <div
              style={{
                background: "linear-gradient(160deg, #14213D 0%, #0B1322 100%)",
                borderRadius: "1.25rem",
                padding: "1.1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.66rem", color: "#94A3B8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Most At-Risk Camp
                </div>
                <div
                  style={{
                    fontSize: "1.02rem",
                    color: "#fff",
                    fontWeight: 800,
                    marginTop: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {campMeta(mostAtRisk.id).name}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#94A3B8", marginTop: 3, fontWeight: 600 }}>
                  Avg {mostAtRisk.avg_composite != null ? mostAtRisk.avg_composite.toFixed(1) : "—"} · {mostAtRisk.flagged_sessions || 0} flagged ·{" "}
                  {mostAtRisk.pending_alerts || 0} pending
                </div>
              </div>
              <ArrowChip dark />
            </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {chip("flagged sessions", scopeTotals.flagged, P.amber)}
            {chip("pending alerts", scopeTotals.pending, scopeTotals.pending > 0 ? P.red : P.green)}
            {chip("total alerts", scopeTotals.alerts, P.purple)}
          </div>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="edu-charts">
        <DashboardCard title="Score Trend" subtitle="Average composite per camp" bodyStyle={{ height: 240 }}>
          {perfData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perfData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 8" stroke={P.border} vertical={false} />
                <XAxis dataKey="code" tick={{ fontSize: 11, fontWeight: 700, fill: P.muted }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: `${P.cardSoft}` }} contentStyle={tooltipStyle} />
                <ReferenceLine y={70} stroke={P.green} strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke={P.amber} strokeDasharray="4 4" />
                <Bar dataKey="score" name="Avg composite" fill={P.teal} radius={[6, 6, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: P.muted,
                fontSize: "0.84rem",
                fontWeight: 600,
              }}
            >
              No camp data
            </div>
          )}
        </DashboardCard>

        <PsychoSocialTrend series={psychoSeries} />
      </div>

      {/* ── Camp cards ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: "0.25rem" }}>
        <div>
          <div style={{ fontSize: "0.86rem", fontWeight: 800, color: P.ink }}>Camp Overview</div>
          <div style={{ fontSize: "0.7rem", color: P.muted, fontWeight: 600, marginTop: 2 }}>
            Select a camp to drill into children, sessions and alerts
          </div>
        </div>
        <span style={{ fontSize: "0.74rem", color: P.muted, fontWeight: 700 }}>
          {list.length} of {camps.length} camps
        </span>
      </div>

      <div className="edu-cards">
        {list.map((camp) => {
          const m = campMeta(camp.id);
          const alertTone = (camp.pending_alerts || 0) > 0 ? P.red : P.green;
          return (
            <button key={camp.id} className="edu-camp-card" onClick={() => onSelect(camp.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{ fontSize: "1rem", fontWeight: 800, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {m.name}
                  </div>
                  <div style={{ marginTop: 3, fontSize: "0.74rem", color: P.muted, fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
                    <span>{m.code}</span>·<span>{m.location}</span>
                  </div>
                </div>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: `${alertTone}1a`,
                    border: `1px solid ${alertTone}55`,
                    color: alertTone,
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {(camp.pending_alerts || 0) > 0 ? `${camp.pending_alerts} alerts` : "clear"}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  marginTop: "0.9rem",
                  paddingTop: "0.9rem",
                  borderTop: `1px solid ${P.border}`,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: P.ink }}>{camp.children}</div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: "0.62rem",
                      color: P.muted,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Children
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: P.ink }}>{camp.sessions}</div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: "0.62rem",
                      color: P.muted,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Sessions
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: scoreTone(camp.avg_composite) }}>
                    {camp.avg_composite != null ? camp.avg_composite.toFixed(1) : "—"}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: "0.62rem",
                      color: P.muted,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Avg Score
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "0.8rem", height: 4, borderRadius: 99, background: P.cardSoft, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.round(camp.avg_composite || 0))}%`,
                    height: "100%",
                    borderRadius: 99,
                    background: `linear-gradient(90deg, ${scoreTone(camp.avg_composite)}88, ${scoreTone(camp.avg_composite)})`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {!list.length && (
        <div
          style={{
            background: P.panelSoft,
            border: `1px dashed ${P.border}`,
            borderRadius: "1.25rem",
            padding: "2.5rem",
            textAlign: "center",
            color: P.muted,
          }}
        >
          <Search size={28} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>No camps match your search</p>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Detail view — camp-level KPIs, trend, distribution, children, sessions, alerts
// ════════════════════════════════════════════════════════════════════════════
function DetailView({ detail, meta, trend, ranked, childAvg, onBack }) {
  const flaggedRate = detail.sessions_count ? Math.round((detail.flagged_sessions / detail.sessions_count) * 100) : 0;

  // Psycho-social risk bands over time — derive from each child's recent scores.
  const psychoSeries = useMemo(() => {
    const children = detail.children || [];
    if (!children.length) return [];
    const dayOf = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : null);
    const scoresByChild = children.map((c) => (c.recent_scores || []).map((s) => ({ day: dayOf(s.date), score: s.score })));
    const days = [...new Set(scoresByChild.flat().map((s) => s.day).filter(Boolean))].slice(-14);
    return days.map((day) => {
      let stable = 0, watch = 0, atRisk = 0;
      for (const scores of scoresByChild) {
        const upTo = scores.filter((s) => s.day === day);
        const latest = upTo.length ? upTo[upTo.length - 1].score : null;
        if (latest == null) continue;
        if (latest >= 70) stable += 1;
        else if (latest >= 50) watch += 1;
        else atRisk += 1;
      }
      return { date: day, stable, watch, atRisk };
    });
  }, [detail]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div className="edu-kpi" style={{ flex: 1, minWidth: 320 }}>
          <KpiCard
            label="Children"
            value={detail.children_count.toLocaleString()}
            icon={<Users size={17} />}
            color="#60A5FA"
            delta="tracked"
            pct={100}
          />
          <KpiCard
            label="Sessions"
            value={detail.sessions_count.toLocaleString()}
            icon={<BookOpen size={17} />}
            color={P.purple}
            delta="recorded"
            pct={100}
          />
          <KpiCard
            label="Avg Score"
            value={detail.avg_composite != null ? detail.avg_composite.toFixed(1) : "—"}
            icon={<TrendingUp size={17} />}
            color={scoreTone(detail.avg_composite)}
            delta={`${flaggedRate}% flagged`}
            pct={Math.min(100, Math.round(detail.avg_composite || 0))}
          />
          <KpiCard
            label="Pending Alerts"
            value={detail.pending_alerts}
            icon={<BellRing size={17} />}
            color={detail.pending_alerts > 0 ? P.red : P.green}
            delta={`${detail.total_alerts} total`}
            pct={Math.min(100, Math.round((detail.pending_alerts / 4) * 100))}
          />
        </div>
        <button
          onClick={onBack}
          className="edu-pill"
          style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${P.border}`, background: P.card, color: P.ink }}
        >
          <ArrowLeft size={15} /> All Camps
        </button>
      </div>

      {/* ── Trend + distribution ── */}
      <div className="edu-charts">
        <DashboardCard title="Score Trend" subtitle="Daily average composite · last 14 days" bodyStyle={{ height: 240 }}>
          {trend.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="eduDetailArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={P.teal} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={P.teal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke={P.border} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700, fill: P.muted }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceLine y={70} stroke={P.green} strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke={P.amber} strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="score"
                  name="Avg composite"
                  stroke={P.teal}
                  strokeWidth={2.5}
                  fill="url(#eduDetailArea)"
                  dot={{ r: 3, fill: P.teal, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", padding: "2.5rem", color: P.muted }}>
              <GraduationCap size={34} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
              <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>Not enough session data to plot a trend yet</p>
            </div>
          )}
        </DashboardCard>

        <PsychoSocialTrend series={psychoSeries} />
      </div>

      {/* ── Children: needs attention + top learners ── */}
      <div className="edu-two">
        <DashboardCard
          title="Needs Attention"
          subtitle="Active alerts or scores below 50"
          right={chip("children", ranked.atRisk.length, ranked.atRisk.length > 0 ? P.red : P.green)}
        >
          {ranked.atRisk.length ? (
            ranked.atRisk.slice(0, 6).map((child) => (
              <div
                key={child.child_id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.55rem 0", borderBottom: `1px solid ${P.border}` }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    background: `${P.red}1f`,
                    border: `1px solid ${P.red}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                  }}
                >
                  ⚠️
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: P.ink }}
                  >
                    {child.child_id}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                    <Tag color={"#64748B"}>G{child.grade}</Tag>
                    {child.alert_status === "active" && <Tag color={P.red}>Active alert</Tag>}
                    <ChildScoreDots scores={child.recent_scores || []} />
                  </div>
                </div>
                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: child.avg != null && child.avg < 50 ? P.red : P.amber }}>
                  {child.avg != null ? child.avg : "—"}
                </span>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", padding: "1.6rem", color: P.muted }}>
              <CheckCircle2 size={30} style={{ margin: "0 auto 8px", color: P.green }} />
              <p style={{ fontSize: "0.85rem", fontWeight: 700 }}>All children are performing within expected ranges</p>
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Top Learners" subtitle="Highest average composite scores" right={chip("top", ranked.top.length, P.green)}>
          {ranked.top.map((child, index) => (
            <div
              key={child.child_id}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.55rem 0", borderBottom: `1px solid ${P.border}` }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 10,
                  background: `${P.green}1f`,
                  border: `1px solid ${P.green}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  color: P.green,
                }}
              >
                {index + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: P.ink }}
                >
                  {child.child_id}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                  <Tag color={"#64748B"}>G{child.grade}</Tag>
                  <ChildScoreDots scores={child.recent_scores || []} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <TrendingUp size={13} color={P.green} />
                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: P.green }}>{child.avg}</span>
              </div>
            </div>
          ))}
          {!ranked.top.length && <div style={{ textAlign: "center", padding: "1.6rem", color: P.muted }}>No scored sessions yet</div>}
        </DashboardCard>
      </div>

      {/* ── Recent sessions ── */}
      <DashboardCard
        title="Recent Sessions"
        subtitle="Latest recorded learning sessions"
        right={chip("recorded", detail.sessions.length, "#60A5FA")}
        bodyStyle={{ padding: 0, gap: 0 }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 560 }}>
            <thead>
              <tr style={{ textAlign: "left", color: P.muted, fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <th style={{ padding: "0.6rem 1.1rem", borderBottom: `1px solid ${P.border}` }}>Child</th>
                <th style={{ padding: "0.6rem", borderBottom: `1px solid ${P.border}` }}>Grade</th>
                <th style={{ padding: "0.6rem", borderBottom: `1px solid ${P.border}` }}>Score</th>
                <th style={{ padding: "0.6rem", borderBottom: `1px solid ${P.border}` }}>Flag</th>
                <th style={{ padding: "0.6rem 1.1rem", borderBottom: `1px solid ${P.border}` }}>When</th>
              </tr>
            </thead>
            <tbody>
              {detail.sessions.slice(0, 8).map((s) => (
                <tr key={s.session_id} style={{ borderBottom: `1px solid ${P.border}60` }}>
                  <td style={{ padding: "0.6rem 1.1rem", fontWeight: 800, color: P.ink }}>{s.child_id}</td>
                  <td style={{ padding: "0.6rem" }}>
                    <Tag color={"#64748B"}>G{s.grade ?? "—"}</Tag>
                  </td>
                  <td style={{ padding: "0.6rem", fontWeight: 800, color: scoreTone(s.composite_score) }}>
                    {s.composite_score != null ? Math.round(s.composite_score) : "—"}
                  </td>
                  <td style={{ padding: "0.6rem" }}>
                    {s.anomaly_flagged ? (
                      <span style={{ color: P.red, fontWeight: 800 }}>⚠ flagged</span>
                    ) : (
                      <span style={{ color: P.green, fontWeight: 700 }}>✓ ok</span>
                    )}
                  </td>
                  <td style={{ padding: "0.6rem 1.1rem", color: P.muted }}>
                    {s.created_at
                      ? new Date(s.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      {/* ── Camp alerts ── */}
      <DashboardCard
        title="Camp Alerts"
        subtitle="Triggered welfare alerts for this camp"
        right={chip("pending", detail.pending_alerts, detail.pending_alerts > 0 ? P.red : P.green)}
      >
        {detail.alerts.length ? (
          detail.alerts.slice(0, 6).map((alert) => (
            <div
              key={alert.alert_id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.65rem 0", borderBottom: `1px solid ${P.border}` }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: `${alert.status === "pending" ? P.red : P.green}1f`,
                  border: `1px solid ${alert.status === "pending" ? P.red : P.green}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {alert.status === "pending" ? <AlertTriangle size={15} color={P.red} /> : <CheckCircle2 size={15} color={P.green} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: P.ink }}>
                  {alert.child_id} · {alert.alert_type.replace(/_/g, " ")}
                </div>
                <div style={{ fontSize: "0.72rem", color: P.muted, marginTop: 2 }}>
                  {alert.triggered_at
                    ? new Date(alert.triggered_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                  {alert.trigger_detail?.recent_scores ? ` · recent: ${alert.trigger_detail.recent_scores.join(" → ")}` : ""}
                </div>
              </div>
              <Tag color={alert.status === "pending" ? P.red : P.green}>{alert.status}</Tag>
            </div>
          ))
        ) : (
          <div style={{ textAlign: "center", padding: "1.6rem", color: P.muted }}>
            <CheckCircle2 size={30} style={{ margin: "0 auto 8px", color: P.green }} />
            <p style={{ fontSize: "0.85rem", fontWeight: 700 }}>No alerts for this camp</p>
          </div>
        )}
      </DashboardCard>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onBack}
          className="edu-pill"
          style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${P.border}`, background: P.card, color: P.ink }}
        >
          <ArrowLeft size={15} /> Back to all camps
        </button>
      </div>
    </>
  );
}
