"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import SideNav from "@/components/common/SideNav";
import PageHeader, { HeaderShell } from "@/components/common/PageHeader";
import DashboardCard from "@/components/dashboard/DashboardCard";
import DataTable from "@/components/common/DataTable/DataTable";
import Button from "@/components/common/Button";
import { useTheme } from "@/components/common/ThemeProvider";
import { CAMP_META } from "@/data/education.data";
import {
  GraduationCap, Users, BookOpen, BellRing, ArrowLeft, TrendingUp,
  RefreshCw, AlertTriangle, CheckCircle2, ChevronDown,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

const tooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E9EDF3",
  borderRadius: "0.75rem",
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "#1E3A5F",
  boxShadow: "0 12px 30px rgba(20,30,40,0.14)",
};

function campMeta(id) {
  if (CAMP_META[id]) return CAMP_META[id];
  const pretty = (id || "").replace(/^CAMP[_-]?B?[_-]?/i, "").replace(/[_-]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()).trim();
  return { name: pretty || id, location: "Sector", code: (pretty || id).slice(0, 3).toUpperCase() };
}

function scoreTone(T, v) {
  return v == null ? T.muted : v >= 70 ? T.green : v >= 50 ? T.amber : T.red;
}

export default function EducationPage() {
  const router = useRouter();
  const { T } = useTheme();
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCampId, setSelectedCampId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadCamps = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/education/camps`);
      const payload = res.ok ? await res.json() : null;
      setCamps(Array.isArray(payload?.camps) ? payload.camps : []);
    } catch {
      setCamps([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadCamps(); }, [loadCamps]);

  const loadDetail = useCallback(async (campId) => {
    if (!campId) { setDetail(null); return; }
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/education/camps/${encodeURIComponent(campId)}`);
      const payload = res.ok ? await res.json() : null;
      setDetail(payload?.camp || null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { loadDetail(selectedCampId); }, [selectedCampId, loadDetail]);

  const totals = useMemo(() => camps.reduce((acc, c) => ({
    children: acc.children + (c.children || 0),
    sessions: acc.sessions + (c.sessions || 0),
    alerts: acc.alerts + (c.pending_alerts || 0),
  }), { children: 0, sessions: 0, alerts: 0 }), [camps]);

  const avgScore = useMemo(() => {
    const scored = camps.filter((c) => c.avg_composite != null);
    if (!scored.length) return null;
    return Math.round((scored.reduce((s, c) => s + c.avg_composite, 0) / scored.length) * 10) / 10;
  }, [camps]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return camps;
    return camps.filter((c) => {
      const m = campMeta(c.id);
      return m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || c.id?.toLowerCase().includes(q);
    });
  }, [camps, search]);

  const goBack = () => { setSelectedCampId(null); setDetail(null); };

  // ── Detail view ──
  if (selectedCampId && detail) {
    return <DetailView detail={detail} meta={campMeta(selectedCampId)} onBack={goBack} T={T} />;
  }

  // ── Camp DataTable columns ──
  const campColumns = [
    { key: "name", label: "Camp", sortable: true, render: (_v, row) => {
      const m = campMeta(row.id);
      return <span style={{ fontWeight: 600 }}>{m.name}</span>;
    }},
    { key: "code", label: "Code", sortable: true, render: (_v, row) => {
      const m = campMeta(row.id);
      return <span style={{ fontFamily: "monospace", fontSize: "0.68rem", color: T.muted }}>{m.code}</span>;
    }},
    { key: "children", label: "Children", sortable: true, numeric: true },
    { key: "sessions", label: "Sessions", sortable: true, numeric: true },
    { key: "avg_composite", label: "Avg Score", sortable: true, numeric: true, render: (v) => (
      <span style={{ color: scoreTone(T, v), fontWeight: 600 }}>{v != null ? v.toFixed(1) : "—"}</span>
    )},
    { key: "pending_alerts", label: "Alerts", sortable: true, numeric: true, render: (v) => (
      <span style={{ color: v > 0 ? T.red : T.green, fontWeight: 600 }}>{v || 0}</span>
    )},
    { key: "avg_accuracy", label: "Accuracy", sortable: true, numeric: true, render: (v) => (
      <span style={{ color: v >= 70 ? T.green : v >= 50 ? T.amber : T.muted }}>{v != null ? `${v}%` : "—"}</span>
    )},
  ];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius:9999px; }
      `}</style>
      <div style={{ minHeight: "100svh", background: T.outer, fontFamily: "'Inter',sans-serif", color: T.ink, paddingLeft: "var(--rail-width, 236px)", transition: "padding-left 0.2s ease" }}>
        <SideNav />
        <div className="header-wrapper">
          <main style={{ background: T.panel, width: "100%", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <HeaderShell>
              <PageHeader
                title="Education"
                subtitle={`${camps.length} camps · ${totals.children.toLocaleString()} children · ${totals.sessions.toLocaleString()} sessions`}
                search={{ value: search, onChange: setSearch, placeholder: "Search camps…", onRefresh: () => loadCamps(true), refreshing }}
              />
            </HeaderShell>

            <div style={{ padding: "0 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* KPI Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                {[
                  { label: "Camps", value: camps.length, color: T.teal },
                  { label: "Children", value: totals.children.toLocaleString(), color: "#16A34A" },
                  { label: "Sessions", value: totals.sessions.toLocaleString(), color: T.purple },
                  { label: "Avg Score", value: avgScore != null ? avgScore.toFixed(1) : "—", color: scoreTone(T, avgScore) },
                ].map((kpi) => (
                  <div key={kpi.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "0.9rem", padding: "1rem 1.15rem" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{kpi.label}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Camps DataTable */}
              <DataTable
                columns={campColumns}
                data={list}
                title="Camps"
                subtitle={`${list.length} of ${camps.length} camps`}
                searchKeys={["id"]}
                searchPlaceholder="Filter camps…"
                loading={loading}
                emptyMessage="No education data synced yet"
                onRowClick={(row) => setSelectedCampId(row.id)}
                selectedRow={selectedCampId}
                rowKey="id"
                pageSize={15}
              />
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Detail View — single camp education data
// ════════════════════════════════════════════════════════════════════════════
function DetailView({ detail, meta, onBack, T }) {
  const flaggedRate = detail.sessions_count ? Math.round((detail.flagged_sessions / detail.sessions_count) * 100) : 0;

  const trend = useMemo(() => {
    const asc = [...(detail.sessions || [])].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const byDay = new Map();
    for (const s of asc) {
      if (s.composite_score == null) continue;
      const day = s.created_at ? new Date(s.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "now";
      const entry = byDay.get(day) || { total: 0, count: 0 };
      entry.total += s.composite_score;
      entry.count += 1;
      byDay.set(day, entry);
    }
    return Array.from(byDay.entries()).map(([date, e]) => ({ date, score: Math.round(e.total / e.count) })).slice(-14);
  }, [detail]);

  const childAvg = (child) => child.recent_scores?.length ? Math.round(child.recent_scores.reduce((s, x) => s + (x.composite_score || 0), 0) / child.recent_scores.length) : null;

  const ranked = useMemo(() => {
    const children = (detail.children || []).map((c) => ({ ...c, avg: childAvg(c) }));
    const atRisk = children.filter((c) => c.alert_status === "active" || (c.avg != null && c.avg < 50)).sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0));
    const top = children.filter((c) => c.avg != null).sort((a, b) => b.avg - a.avg).slice(0, 5);
    return { atRisk, top };
  }, [detail]);

  // Session columns
  const sessionColumns = [
    { key: "child_id", label: "Child", sortable: true },
    { key: "composite_score", label: "Composite", sortable: true, numeric: true, render: (v) => (
      <span style={{ color: scoreTone(T, v), fontWeight: 600 }}>{v != null ? v.toFixed(1) : "—"}</span>
    )},
    { key: "task_score", label: "Task", sortable: true, numeric: true, render: (v) => v != null ? v.toFixed(1) : "—" },
    { key: "passive_score", label: "Passive", sortable: true, numeric: true, render: (v) => v != null ? v.toFixed(1) : "—" },
    { key: "gate_decision", label: "Gate", sortable: true, render: (v) => {
      const color = v === "PASS" ? T.green : v === "PASS_RECOVERED" ? T.teal : T.red;
      return <span style={{ color, fontWeight: 600, fontSize: "0.7rem" }}>{v || "—"}</span>;
    }},
    { key: "z_score", label: "Z", sortable: true, numeric: true, render: (v) => v != null ? v.toFixed(2) : "—" },
    { key: "if_score", label: "IF", sortable: true, numeric: true, render: (v) => v != null ? v.toFixed(2) : "—" },
    { key: "created_at", label: "Date", sortable: true, render: (v) => v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—" },
  ];

  // Children columns
  const childColumns = [
    { key: "child_id", label: "Child ID", sortable: true },
    { key: "grade", label: "Grade", sortable: true, numeric: true, render: (v) => `G${v ?? "—"}` },
    { key: "baseline_score", label: "Baseline", sortable: true, numeric: true, render: (v) => v != null ? v.toFixed(1) : "—" },
    { key: "total_sessions", label: "Sessions", sortable: true, numeric: true },
    { key: "alert_status", label: "Status", sortable: true, render: (v) => {
      const color = v === "active" ? T.red : T.green;
      return <span style={{ color, fontWeight: 600, fontSize: "0.7rem" }}>{v || "normal"}</span>;
    }},
    { key: "avg", label: "Avg Score", sortable: true, numeric: true, render: (v) => (
      <span style={{ color: scoreTone(T, v), fontWeight: 600 }}>{v != null ? v : "—"}</span>
    )},
  ];

  // Signals columns
  const signalColumns = [
    { key: "child_id", label: "Child", sortable: true },
    { key: "accuracy_rate", label: "Accuracy", sortable: true, numeric: true, render: (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—" },
    { key: "false_tap_rate", label: "False Tap", sortable: true, numeric: true, render: (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—" },
    { key: "avg_reaction_time", label: "Reaction", sortable: true, numeric: true, render: (v) => v != null ? `${v.toFixed(0)}ms` : "—" },
    { key: "idle_time_ratio", label: "Idle", sortable: true, numeric: true, render: (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—" },
    { key: "completion_ratio", label: "Completion", sortable: true, numeric: true, render: (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—" },
  ];

  // Gate decisions columns
  const gateColumns = [
    { key: "child_id", label: "Child", sortable: true },
    { key: "composite_score", label: "Score", sortable: true, numeric: true, render: (v) => (
      <span style={{ color: scoreTone(T, v), fontWeight: 600 }}>{v != null ? v.toFixed(1) : "—"}</span>
    )},
    { key: "decision", label: "Decision", sortable: true, render: (v) => {
      const color = v === "PASS" ? T.green : v === "PASS_RECOVERED" ? T.teal : T.red;
      return <span style={{ color, fontWeight: 600, fontSize: "0.7rem" }}>{v || "—"}</span>;
    }},
    { key: "attempt_number", label: "Attempt", sortable: true, numeric: true },
    { key: "decided_at", label: "Date", sortable: true, render: (v) => v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—" },
  ];

  const childrenWithAvg = (detail.children || []).map((c) => ({ ...c, avg: childAvg(c) }));

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius:9999px; }
      `}</style>
      <div style={{ minHeight: "100svh", background: T.outer, fontFamily: "'Inter',sans-serif", color: T.ink, paddingLeft: "var(--rail-width, 236px)", transition: "padding-left 0.2s ease" }}>
        <SideNav />
        <div className="header-wrapper">
          <main style={{ background: T.panel, width: "100%", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <HeaderShell>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.ink, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}>
                  <ArrowLeft size={14} /> Back
                </button>
                <div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>{meta.name}</div>
                  <div style={{ fontSize: "0.72rem", color: T.muted }}>{meta.code} · {meta.location}</div>
                </div>
              </div>
            </HeaderShell>

            <div style={{ padding: "0 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* KPI Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                {[
                  { label: "Children", value: detail.children_count, color: "#16A34A" },
                  { label: "Sessions", value: detail.sessions_count, color: T.purple },
                  { label: "Avg Score", value: detail.avg_composite?.toFixed(1) || "—", color: scoreTone(T, detail.avg_composite) },
                  { label: "Pending Alerts", value: detail.pending_alerts, color: detail.pending_alerts > 0 ? T.red : T.green },
                ].map((kpi) => (
                  <div key={kpi.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "0.9rem", padding: "1rem 1.15rem" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{kpi.label}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Score Trend Chart */}
              <DashboardCard title="Score Trend" subtitle="Average composite per day" bodyStyle={{ height: 220 }}>
                {trend.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="eduArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.teal} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={T.teal} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 8" stroke={T.border} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 600, fill: T.muted }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <ReferenceLine y={70} stroke={T.green} strokeDasharray="4 4" />
                      <ReferenceLine y={50} stroke={T.amber} strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="score" name="Avg composite" stroke={T.teal} strokeWidth={2} fill="url(#eduArea)" dot={{ r: 3, fill: T.teal }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.muted, fontSize: "0.84rem" }}>
                    Not enough data for trend
                  </div>
                )}
              </DashboardCard>

              {/* Children DataTable */}
              <DataTable
                columns={childColumns}
                data={childrenWithAvg}
                title="Children"
                subtitle={`${detail.children_count} enrolled`}
                searchKeys={["child_id"]}
                searchPlaceholder="Search children…"
                rowKey="child_id"
                pageSize={10}
              />

              {/* Sessions DataTable */}
              <DataTable
                columns={sessionColumns}
                data={detail.sessions || []}
                title="Sessions"
                subtitle={`${detail.sessions_count} recorded`}
                searchKeys={["child_id"]}
                searchPlaceholder="Search sessions…"
                rowKey="session_id"
                pageSize={10}
              />

              {/* Behavioral Signals */}
              {(detail.behavioral_signals || []).length > 0 && (
                <DataTable
                  columns={signalColumns}
                  data={detail.behavioral_signals}
                  title="Behavioral Signals"
                  subtitle={`${detail.behavioral?.signal_count || 0} signals collected`}
                  searchKeys={["child_id"]}
                  searchPlaceholder="Search signals…"
                  rowKey="signal_id"
                  pageSize={10}
                />
              )}

              {/* Gate Decisions */}
              {(detail.gate_decisions_list || []).length > 0 && (
                <DataTable
                  columns={gateColumns}
                  data={detail.gate_decisions_list}
                  title="Gate Decisions"
                  subtitle={`${detail.gate_decisions} decisions recorded`}
                  searchKeys={["child_id"]}
                  searchPlaceholder="Search decisions…"
                  rowKey="decision_id"
                  pageSize={10}
                />
              )}

              {/* At Risk / Top Learners */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <DashboardCard title="Needs Attention" subtitle="Scores below 50 or active alerts">
                  {ranked.atRisk.length ? ranked.atRisk.slice(0, 5).map((child) => (
                    <div key={child.child_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: T.ink }}>{child.child_id}</div>
                        <div style={{ fontSize: "0.66rem", color: T.muted, marginTop: 2 }}>G{child.grade} · {child.total_sessions} sessions</div>
                      </div>
                      <span style={{ fontSize: "0.95rem", fontWeight: 700, color: child.avg != null && child.avg < 50 ? T.red : T.amber }}>{child.avg ?? "—"}</span>
                    </div>
                  )) : (
                    <div style={{ textAlign: "center", padding: "1.5rem", color: T.muted, fontSize: "0.82rem" }}>
                      <CheckCircle2 size={24} style={{ margin: "0 auto 6px", color: T.green }} />
                      All children performing well
                    </div>
                  )}
                </DashboardCard>

                <DashboardCard title="Top Learners" subtitle="Highest average scores">
                  {ranked.top.length ? ranked.top.map((child, i) => (
                    <div key={child.child_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0", borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: `${T.green}1a`, border: `1px solid ${T.green}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700, color: T.green }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: T.ink }}>{child.child_id}</div>
                        <div style={{ fontSize: "0.66rem", color: T.muted, marginTop: 2 }}>G{child.grade} · {child.total_sessions} sessions</div>
                      </div>
                      <span style={{ fontSize: "0.95rem", fontWeight: 700, color: T.green }}>{child.avg}</span>
                    </div>
                  )) : (
                    <div style={{ textAlign: "center", padding: "1.5rem", color: T.muted, fontSize: "0.82rem" }}>No scored sessions yet</div>
                  )}
                </DashboardCard>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
