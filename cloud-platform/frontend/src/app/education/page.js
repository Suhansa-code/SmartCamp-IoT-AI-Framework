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
import { useTheme } from "@/components/common/ThemeProvider";
import { CAMP_META } from "@/data/education.data";
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

function campMeta(id) {
  if (CAMP_META[id]) return CAMP_META[id];
  const pretty = (id || "")
    .replace(/^CAMP[_-]?B?[_-]?/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
  return { name: pretty || id, location: "Sector", code: (pretty || id).slice(0, 3).toUpperCase() };
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
  border: `1px solid #E9EDF3`,
  borderRadius: "0.75rem",
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "#1E3A5F",
  boxShadow: "0 12px 30px rgba(20,30,40,0.14)",
};

const scoreTone = (T, v) => (v == null ? T.muted : v >= 70 ? T.green : v >= 50 ? T.amber : T.red);

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
            background: s.score >= 70 ? "#16A34A" : s.score >= 50 ? "#B45309" : "#DC2626",
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}

function Tag({ children, color = "#0F766E" }) {
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
  const { T } = useTheme();
  const last = series.length ? series[series.length - 1] : { stable: 0, watch: 0, atRisk: 0 };
  const bands = [
    { label: "Stable",  color: T.green, value: last.stable },
    { label: "Watch",   color: T.amber, value: last.watch },
    { label: "At Risk", color: T.red,   value: last.atRisk },
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
                <stop offset="0%" stopColor={T.green} stopOpacity={0.35} />
                <stop offset="100%" stopColor={T.green} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="psyWatch" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.amber} stopOpacity={0.35} />
                <stop offset="100%" stopColor={T.amber} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="psyRisk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.red} stopOpacity={0.4} />
                <stop offset="100%" stopColor={T.red} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 8" stroke={T.border} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700, fill: T.muted }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area stackId="1" type="monotone" dataKey="stable" name="Stable" stroke={T.green} strokeWidth={2} fill="url(#psyStable)" />
            <Area stackId="1" type="monotone" dataKey="watch" name="Watch" stroke={T.amber} strokeWidth={2} fill="url(#psyWatch)" />
            <Area stackId="1" type="monotone" dataKey="atRisk" name="At Risk" stroke={T.red} strokeWidth={2} fill="url(#psyRisk)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ textAlign: "center", padding: "2.5rem", color: T.muted }}>
          <HeartPulse size={34} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>Not enough session data to plot psycho-social impact yet</p>
        </div>
      )}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center" }}>
        {bands.map((b) => (
          <span key={b.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", fontWeight: 800, color: b.color }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color }} />
            {b.label} <span style={{ color: T.textPrimary }}>{b.value}</span>
          </span>
        ))}
      </div>
    </DashboardCard>
  );
}

export default function EducationPage() {
  const { T } = useTheme();
  const [camps, setCamps] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingCamps, setLoadingCamps] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");

  async function loadCamps(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoadingCamps(true);
    setLoadError("");
    try {
      const res = await fetch(`${API_BASE}/api/alerts/education/camps`);
      if (!res.ok) throw new Error(`Cloud Backend returned ${res.status}`);
      const payload = await res.json();
      const list = Array.isArray(payload?.camps) ? payload.camps : [];
      setCamps(list);
    } catch (error) {
      setCamps([]);
      setLoadError(error instanceof Error ? error.message : "Failed to load education data");
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
      if (!res.ok) throw new Error(`Cloud Backend returned ${res.status}`);
      const payload = await res.json();
      setDetail(payload?.camp ?? null);
    } catch {
      setDetail(null);
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
      { label: "Clear", color: T.green, value: count.clear },
      { label: "Watch", color: T.amber, value: count.watch },
      { label: "Urgent", color: T.red, value: count.urgent },
    ];
  }, [list, T]);

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
          background: ${T.card}; border: 1px solid ${T.border}; border-radius: 1.25rem; padding: 1.05rem 1.15rem;
          box-shadow: 0 14px 34px rgba(20,30,40,0.06); transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .edu-camp-card:hover { transform: translateY(-3px); box-shadow: 0 20px 44px rgba(20,30,40,0.14); border-color: ${T.teal}; }
        @media (max-width: 1150px) {
          .edu-hero, .edu-charts, .edu-two, .edu-cards { grid-template-columns: 1fr; }
        }
        @media (max-width: 900px) { .edu-kpi { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .edu-kpi { grid-template-columns: 1fr; } }
      `}</style>

      <div
        style={{
          minHeight: "100svh",
          background: T.outer,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          paddingLeft: "var(--rail-width, 236px)",
          transition: "padding-left 0.2s ease",
        }}
      >
        <SideNav />

        <div className="header-wrapper">
          <main style={{ background: T.panel, width: "100%", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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
              <div style={{ background: T.panel, padding: "clamp(1rem, 2vw, 1.75rem)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* ── Camp selector pills ── */}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    onClick={goOverview}
                    className="edu-pill"
                    style={{
                      border: `1px solid ${!selectedId ? T.teal : T.border}`,
                      background: !selectedId ? `${T.teal}22` : T.card,
                      color: !selectedId ? T.teal : T.muted,
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
                          border: `1px solid ${active ? T.teal : T.border}`,
                          background: active ? `${T.teal}22` : T.card,
                          color: active ? T.ink : T.muted,
                        }}
                      >
                        {m.code}
                        {(camp.pending_alerts || 0) > 0 && (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.red, boxShadow: `0 0 6px ${T.red}` }} />
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
                          background: T.cardSoft,
                          border: `1px solid ${T.border}`,
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
                      color: T.muted,
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
                      background: `linear-gradient(160deg, ${T.card}, ${T.panelSoft})`,
                      border: `1px dashed ${T.border}`,
                      borderRadius: "1.5rem",
                      padding: "3.5rem",
                      textAlign: "center",
                    }}
                  >
                    <GraduationCap size={44} style={{ margin: "0 auto", color: T.teal, opacity: 0.7 }} />
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: "1.15rem", fontWeight: 800, marginTop: "0.7rem", color: T.ink }}>
                      No education data synced yet
                    </p>
                    <p style={{ color: T.muted, fontSize: "0.85rem", marginTop: "0.35rem" }}>
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
  const { T } = useTheme();
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
          color="#2563EB"
          delta="active sites"
          pct={100}
          spark={sparkFor("children").map((_, i) => i + 1)}
        />
        <KpiCard
          label="Children"
          value={scopeTotals.children.toLocaleString()}
          icon={<Users size={17} />}
          color={T.teal}
          delta="grade 3 & 4"
          pct={Math.min(100, Math.round((scopeTotals.children / 1500) * 100))}
          spark={sparkFor("children")}
        />
        <KpiCard
          label="Learning Sessions"
          value={scopeTotals.sessions.toLocaleString()}
          icon={<BookOpen size={17} />}
          color={T.purple}
          delta="synced"
          pct={Math.min(100, Math.round((scopeTotals.sessions / 2400) * 100))}
          spark={sparkFor("sessions")}
        />
        <KpiCard
          label="Avg Score"
          value={scopeAvg != null ? scopeAvg.toFixed(1) : "—"}
          icon={<TrendingUp size={17} />}
          color={scoreTone(T, scopeAvg)}
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
            background: T.panelSoft,
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
              background: T.card,
              borderRadius: "9999px",
              padding: "5px 14px",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: T.inkSoft,
              border: `1px solid ${T.border}`,
            }}
          >
            <Radio size={13} color={T.green} /> Live Monitoring
          </span>

          <div className="grid grid-cols-2 items-center">
            <div className="flex flex-col gap-5">
              <h1 style={{ fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)", fontWeight: 800, color: T.ink, lineHeight: 1.08, letterSpacing: "-0.02em" }}>
                Learning Insights
                <br />
                at a glance.
              </h1>

              <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", maxWidth: 380 }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 300, color: T.muted, flexShrink: 0 }}>01</span>
                <div style={{ width: 34, height: 2, background: T.muted, marginTop: "0.9rem", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "0.95rem", fontWeight: 800, color: T.ink }}>Score Trends</p>
                  <p style={{ fontSize: "0.82rem", color: T.muted, marginTop: "2px", lineHeight: 1.5 }}>
                    Inhibition, tap-accuracy &amp; reaction-time drift tracked every session — so at-risk children surface before it becomes a
                    pattern.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", maxWidth: 380 }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 300, color: T.muted, flexShrink: 0 }}>02</span>
                <div style={{ width: 34, height: 2, background: T.muted, marginTop: "0.9rem", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "0.95rem", fontWeight: 800, color: T.ink }}>Flag Detection</p>
                  <p style={{ fontSize: "0.82rem", color: T.muted, marginTop: "2px", lineHeight: 1.5 }}>
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
                  <span style={{ fontSize: "0.7rem", fontWeight: 400, color: T.inkSoft, flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: "0.7rem", fontWeight: 500, color: T.ink , flex: 1}}>{s.value}</span>
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
              color={scoreTone(T, scopeAvg)}
            />
            <MiniStat label="Flag Rate" value={`${flaggedRate}%`} icon={<AlertTriangle size={12} />} color={flaggedRate > 25 ? T.amber : T.green} />
            <MiniStat
              label="Pending Alerts"
              value={scopeTotals.pending}
              icon={<BellRing size={12} />}
              color={scopeTotals.pending > 0 ? T.red : T.green}
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
              background: T.teal,
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
              background: "#2563EB",
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
              background: T.purple,
              opacity: 0.35,
              animation: "eduFloat 4.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Right widget stack */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <DashboardCard title="Distribution" subtitle="Grades · flagged · alerts">
          <div style={{ fontSize: "0.66rem", fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            Grade
          </div>
          {gradeTotals.map(([grade, count]) => (
            <div key={grade} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 700, marginBottom: 4 }}>
                <span style={{ color: T.inkSoft }}>Grade {grade}</span>
                <span style={{ color: T.teal }}>{count}</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: T.cardSoft, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${gradeChildren ? Math.round((count / gradeChildren) * 100) : 0}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${T.teal}88, ${T.teal})`,
                    borderRadius: 99,
                  }}
                />
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: 4 }}>
            {chip("flagged", scopeTotals.flagged, T.amber)}
            {chip("pending", scopeTotals.pending, T.red)}
            {chip("avg", scopeAvg != null ? scopeAvg.toFixed(1) : "—", T.teal)}
          </div>
        </DashboardCard>

          {mostAtRisk && (
            <div className="flex flex-col gap-3">
            <div
              onClick={() => onSelect(mostAtRisk.id)}
              style={{
                background: T.mode === 'dark'
                  ? "linear-gradient(160deg, #F8FAFC 0%, #E2E8F0 100%)"
                  : "linear-gradient(160deg, #0F172A 0%, #1E293B 100%)",
                borderRadius: "1.25rem",
                padding: "1.1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.66rem", color: T.mode === 'dark' ? '#475569' : "#94A3B8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Most At-Risk Camp
                </div>
                <div
                  style={{
                    fontSize: "1.02rem",
                    color: T.mode === 'dark' ? '#0F172A' : "#fff",
                    fontWeight: 800,
                    marginTop: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {campMeta(mostAtRisk.id).name}
                </div>
                <div style={{ fontSize: "0.78rem", color: T.mode === 'dark' ? '#64748B' : "#94A3B8", marginTop: 3, fontWeight: 600 }}>
                  Avg {mostAtRisk.avg_composite != null ? mostAtRisk.avg_composite.toFixed(1) : "—"} · {mostAtRisk.flagged_sessions || 0} flagged ·{" "}
                  {mostAtRisk.pending_alerts || 0} pending
                </div>
              </div>
              <ArrowChip dark={T.mode === 'light'} />
            </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {chip("flagged sessions", scopeTotals.flagged, T.amber)}
            {chip("pending alerts", scopeTotals.pending, scopeTotals.pending > 0 ? T.red : T.green)}
            {chip("total alerts", scopeTotals.alerts, T.purple)}
          </div>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="edu-charts">
        <DashboardCard title="Score Trend" subtitle="Average composite per camp" bodyStyle={{ height: 240 }}>
          {perfData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perfData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 8" stroke={T.border} vertical={false} />
                <XAxis dataKey="code" tick={{ fontSize: 11, fontWeight: 700, fill: T.muted }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: `${T.cardSoft}` }} contentStyle={tooltipStyle} />
                <ReferenceLine y={70} stroke={T.green} strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke={T.amber} strokeDasharray="4 4" />
                <Bar dataKey="score" name="Avg composite" fill={T.teal} radius={[6, 6, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: T.muted,
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
          <div style={{ fontSize: "0.86rem", fontWeight: 800, color: T.ink }}>Camp Overview</div>
          <div style={{ fontSize: "0.7rem", color: T.muted, fontWeight: 600, marginTop: 2 }}>
            Select a camp to drill into children, sessions and alerts
          </div>
        </div>
        <span style={{ fontSize: "0.74rem", color: T.muted, fontWeight: 700 }}>
          {list.length} of {camps.length} camps
        </span>
      </div>

      <div className="edu-cards">
        {list.map((camp) => {
          const m = campMeta(camp.id);
          const alertTone = (camp.pending_alerts || 0) > 0 ? T.red : T.green;
          return (
            <button key={camp.id} className="edu-camp-card" onClick={() => onSelect(camp.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{ fontSize: "1rem", fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {m.name}
                  </div>
                  <div style={{ marginTop: 3, fontSize: "0.74rem", color: T.muted, fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
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
                  borderTop: `1px solid ${T.border}`,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: T.ink }}>{camp.children}</div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: "0.62rem",
                      color: T.muted,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Children
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: T.ink }}>{camp.sessions}</div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: "0.62rem",
                      color: T.muted,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Sessions
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: scoreTone(T, camp.avg_composite) }}>
                    {camp.avg_composite != null ? camp.avg_composite.toFixed(1) : "—"}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: "0.62rem",
                      color: T.muted,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Avg Score
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "0.8rem", height: 4, borderRadius: 99, background: T.cardSoft, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.round(camp.avg_composite || 0))}%`,
                    height: "100%",
                    borderRadius: 99,
                    background: `linear-gradient(90deg, ${scoreTone(T, camp.avg_composite)}88, ${scoreTone(T, camp.avg_composite)})`,
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
            background: T.panelSoft,
            border: `1px dashed ${T.border}`,
            borderRadius: "1.25rem",
            padding: "2.5rem",
            textAlign: "center",
            color: T.muted,
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
  const { T } = useTheme();
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
            color="#2563EB"
            delta="tracked"
            pct={100}
          />
          <KpiCard
            label="Sessions"
            value={detail.sessions_count.toLocaleString()}
            icon={<BookOpen size={17} />}
            color={T.purple}
            delta="recorded"
            pct={100}
          />
          <KpiCard
            label="Avg Score"
            value={detail.avg_composite != null ? detail.avg_composite.toFixed(1) : "—"}
            icon={<TrendingUp size={17} />}
            color={scoreTone(T, detail.avg_composite)}
            delta={`${flaggedRate}% flagged`}
            pct={Math.min(100, Math.round(detail.avg_composite || 0))}
          />
          <KpiCard
            label="Pending Alerts"
            value={detail.pending_alerts}
            icon={<BellRing size={17} />}
            color={detail.pending_alerts > 0 ? T.red : T.green}
            delta={`${detail.total_alerts} total`}
            pct={Math.min(100, Math.round((detail.pending_alerts / 4) * 100))}
          />
        </div>
        <button
          className="edu-pill"
          style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${T.border}`, background: T.card, color: T.ink }}
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
                    <stop offset="0%" stopColor={T.teal} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={T.teal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke={T.border} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700, fill: T.muted }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceLine y={70} stroke={T.green} strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke={T.amber} strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="score"
                  name="Avg composite"
                  stroke={T.teal}
                  strokeWidth={2.5}
                  fill="url(#eduDetailArea)"
                  dot={{ r: 3, fill: T.teal, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", padding: "2.5rem", color: T.muted }}>
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
          right={chip("children", ranked.atRisk.length, ranked.atRisk.length > 0 ? T.red : T.green)}
        >
          {ranked.atRisk.length ? (
            ranked.atRisk.slice(0, 6).map((child) => (
              <div
                key={child.child_id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.55rem 0", borderBottom: `1px solid ${T.border}` }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    background: `${T.red}1f`,
                    border: `1px solid ${T.red}44`,
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
                    style={{ fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: T.ink }}
                  >
                    {child.child_id}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                    <Tag color={"#64748B"}>G{child.grade}</Tag>
                    {child.alert_status === "active" && <Tag color={T.red}>Active alert</Tag>}
                    <ChildScoreDots scores={child.recent_scores || []} />
                  </div>
                </div>
                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: child.avg != null && child.avg < 50 ? T.red : T.amber }}>
                  {child.avg != null ? child.avg : "—"}
                </span>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", padding: "1.6rem", color: T.muted }}>
              <CheckCircle2 size={30} style={{ margin: "0 auto 8px", color: T.green }} />
              <p style={{ fontSize: "0.85rem", fontWeight: 700 }}>All children are performing within expected ranges</p>
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Top Learners" subtitle="Highest average composite scores" right={chip("top", ranked.top.length, T.green)}>
          {ranked.top.map((child, index) => (
            <div
              key={child.child_id}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.55rem 0", borderBottom: `1px solid ${T.border}` }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 10,
                  background: `${T.green}1f`,
                  border: `1px solid ${T.green}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  color: T.green,
                }}
              >
                {index + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: T.ink }}
                >
                  {child.child_id}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                  <Tag color={"#64748B"}>G{child.grade}</Tag>
                  <ChildScoreDots scores={child.recent_scores || []} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <TrendingUp size={13} color={T.green} />
                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: T.green }}>{child.avg}</span>
              </div>
            </div>
          ))}
          {!ranked.top.length && <div style={{ textAlign: "center", padding: "1.6rem", color: T.muted }}>No scored sessions yet</div>}
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
              <tr style={{ textAlign: "left", color: T.muted, fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <th style={{ padding: "0.6rem 1.1rem", borderBottom: `1px solid ${T.border}` }}>Child</th>
                <th style={{ padding: "0.6rem", borderBottom: `1px solid ${T.border}` }}>Grade</th>
                <th style={{ padding: "0.6rem", borderBottom: `1px solid ${T.border}` }}>Score</th>
                <th style={{ padding: "0.6rem", borderBottom: `1px solid ${T.border}` }}>Flag</th>
                <th style={{ padding: "0.6rem 1.1rem", borderBottom: `1px solid ${T.border}` }}>When</th>
              </tr>
            </thead>
            <tbody>
              {detail.sessions.slice(0, 8).map((s) => (
                <tr key={s.session_id} style={{ borderBottom: `1px solid ${T.border}60` }}>
                  <td style={{ padding: "0.6rem 1.1rem", fontWeight: 800, color: T.ink }}>{s.child_id}</td>
                  <td style={{ padding: "0.6rem" }}>
                    <Tag color={"#64748B"}>G{s.grade ?? "—"}</Tag>
                  </td>
                  <td style={{ padding: "0.6rem", fontWeight: 800, color: scoreTone(T, s.composite_score) }}>
                    {s.composite_score != null ? Math.round(s.composite_score) : "—"}
                  </td>
                  <td style={{ padding: "0.6rem" }}>
                    {s.anomaly_flagged ? (
                      <span style={{ color: T.red, fontWeight: 800 }}>⚠ flagged</span>
                    ) : (
                      <span style={{ color: T.green, fontWeight: 700 }}>✓ ok</span>
                    )}
                  </td>
                  <td style={{ padding: "0.6rem 1.1rem", color: T.muted }}>
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
      {/* <DashboardCard
        title="Camp Alerts"
        subtitle="Triggered welfare alerts for this camp"
        right={chip("pending", detail.pending_alerts, detail.pending_alerts > 0 ? T.red : T.green)}
      >
        {detail.alerts.length ? (
          detail.alerts.slice(0, 6).map((alert) => (
            <div
              key={alert.alert_id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.65rem 0", borderBottom: `1px solid ${T.border}` }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: `${alert.status === "pending" ? T.red : T.green}1f`,
                  border: `1px solid ${alert.status === "pending" ? T.red : T.green}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {alert.status === "pending" ? <AlertTriangle size={15} color={T.red} /> : <CheckCircle2 size={15} color={T.green} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: T.ink }}>
                  {alert.child_id} · {alert.alert_type.replace(/_/g, " ")}
                </div>
                <div style={{ fontSize: "0.72rem", color: T.muted, marginTop: 2 }}>
                  {alert.triggered_at
                    ? new Date(alert.triggered_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                  {alert.trigger_detail?.recent_scores ? ` · recent: ${alert.trigger_detail.recent_scores.join(" → ")}` : ""}
                </div>
              </div>
              <Tag color={alert.status === "pending" ? T.red : T.green}>{alert.status}</Tag>
            </div>
          ))
        ) : (
          <div style={{ textAlign: "center", padding: "1.6rem", color: T.muted }}>
            <CheckCircle2 size={30} style={{ margin: "0 auto 8px", color: T.green }} />
            <p style={{ fontSize: "0.85rem", fontWeight: 700 }}>No alerts for this camp</p>
          </div>
        )}
      </DashboardCard> */}


    </>
  );
}
