"use client";

// Welfare Alert Dashboard — "nitec" reference layout
// Hero + widget-grid composition (search header · big left headline panel ·
// stacked right widget cards) with real alert data mapped into every slot.
// Alerts are picked from a dropdown and inspected in the detail card.

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ArrowUpRight, Radio, Users, Flame, ListChecks, AlertTriangle } from "lucide-react";
import SideNav from "@/components/common/SideNav";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable/DataTable";
import { useTheme } from "@/components/common/ThemeProvider";
import { SEVERITY_RANK, SEVERITY_COLOR, STATUS_COLOR } from "@/data/theme.data";
import { MOCK_CAMPS, mockAlerts } from "@/data/alerts.data";
import AlertCard from "@/components/alert/AlertCard";
import ArrowChip from "@/components/alert/ArrowChip";
import Button from "@/components/common/Button";
import { daysSince } from "@/components/common/utils";
import { API_BASE, DISASTER_API_BASE, withQuery } from "@/lib/apiBase";

// ── Alert table columns ─────────────────────────────────────────────────────
const ALERT_COLUMNS = [
  {
    key: "childId",
    label: "Child ID",
    sortable: true,
    render: (v) => (
      <span style={{ fontWeight: 700, color: "#0F172A" }}>{v || "—"}</span>
    ),
  },
  {
    key: "alertType",
    label: "Alert Type",
    sortable: true,
    render: (v) => (
      <span style={{ fontWeight: 600, fontSize: "0.78rem" }}>{v}</span>
    ),
  },
  {
    key: "severity",
    label: "Severity",
    sortable: true,
    render: (v) => {
      const color = SEVERITY_COLOR[v] || "#64748B";
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            background: `${color}14`,
            border: `1px solid ${color}44`,
            color,
          }}
        >
          {v}
        </span>
      );
    },
  },
  {
    key: "campName",
    label: "Camp",
    sortable: true,
    render: (v) => (
      <span style={{ fontWeight: 600, color: "#0F172A" }}>{v || "—"}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (v) => {
      const meta = {
        pending: { color: "#D97706", label: "Pending" },
        escalated: { color: "#8B5CF6", label: "Escalated" },
        resolved: { color: "#16A34A", label: "Resolved" },
      }[v] || { color: "#64748B", label: v };
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            background: `${meta.color}14`,
            border: `1px solid ${meta.color}44`,
            color: meta.color,
          }}
        >
          {meta.label}
        </span>
      );
    },
  },
  {
    key: "triggeredAt",
    label: "Triggered",
    sortable: true,
    numeric: true,
    render: (v) => {
      if (!v) return "—";
      const d = new Date(v);
      return (
        <div style={{ fontSize: "0.72rem" }}>
          <div style={{ fontWeight: 600 }}>{d.toLocaleDateString()}</div>
          <div style={{ color: "#64748B", fontSize: "0.65rem" }}>
            {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      );
    },
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { T } = useTheme();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamp, setSelectedCamp] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const detailRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const [eduRes, disasterRes] = await Promise.allSettled([
        fetch(`${API_BASE}${withQuery('/api/alerts', { camp: selectedCamp === "all" ? "" : selectedCamp })}`),
        fetch(`${DISASTER_API_BASE}/api/disaster/alerts?status=ACTIVE`),
      ]);

      const transformed = [];

      if (eduRes.status === 'fulfilled' && eduRes.value.ok) {
        const data = await eduRes.value.json();
        for (const a of data.alerts || []) {
          transformed.push({
            id: a.alert_id,
            childId: a.child_id?.replace(/TEST-CHILD-/, '').replace(/CHILD-/, '') ?? '—',
            campId: a.camp_id?.toLowerCase() ?? 'unknown',
            campName: a.camp_id ?? 'Unknown Camp',
            alertType: a.alert_type ?? 'Unknown Alert',
            severity:
              a.alert_type?.includes('Low') || a.alert_type?.includes('low')
                ? 'low'
                : a.alert_type?.includes('High') || a.alert_type?.includes('high')
                  ? 'high'
                  : 'medium',
            status: a.status === 'escalated' ? 'escalated' : a.status === 'resolved' ? 'resolved' : 'pending',
            triggeredAt: new Date(a.triggered_at).getTime(),
            scores: (a.recent_scores || []).map((score, idx) => ({ session: idx + 1, score })),
            source: 'education',
          });
        }
      }

      if (disasterRes.status === 'fulfilled' && disasterRes.value.ok) {
        const data = await disasterRes.value.json();
        for (const a of data.alerts || []) {
          const severityMap = { CRITICAL: 'high', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };
          const displayValue = a.temperature != null
            ? `${a.temperature}°C`
            : a.humidity != null
              ? `${a.humidity}%`
              : '—';
          transformed.push({
            id: a.alert_id || a.event_id,
            childId: displayValue,
            campId: a.camp_id?.toLowerCase() ?? 'unknown',
            campName: a.camp_name ?? a.camp_id ?? 'Unknown Camp',
            alertType: a.title ?? a.alert_type ?? 'Disaster Alert',
            severity: severityMap[a.severity] ?? 'medium',
            status: a.status === 'RESOLVED' ? 'resolved' : a.status === 'ACKNOWLEDGED' ? 'escalated' : 'pending',
            triggeredAt: new Date(a.created_at).getTime(),
            scores: [],
            source: 'disaster',
          });
        }
      }

      setAlerts(transformed.length > 0 ? transformed : mockAlerts());
    } catch (err) {
      console.log("Fetching real alerts failed, using mock data:", err.message);
      setAlerts(mockAlerts());
    } finally {
      setLoading(false);
    }
  }, [selectedCamp]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  function handleAction(alertId, action) {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id !== alertId) return a;
        if (action === "review") return { ...a, status: "resolved" };
        if (action === "escalate") return { ...a, status: "escalated" };
        return a;
      }),
    );
  }

  const pendingCount = alerts.filter((a) => a.status === "pending").length;
  const escalatedCount = alerts.filter((a) => a.status === "escalated").length;
  const resolvedCount = alerts.filter((a) => a.status === "resolved").length;
  const totalCount = alerts.length || 1;
  const activeCount = pendingCount + escalatedCount;

  const mostCritical = useMemo(() => {
    const open = alerts.filter((a) => a.status !== "resolved");
    if (!open.length) return null;
    return [...open].sort((a, b) => {
      const rank = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
      if (rank !== 0) return rank;
      return (a.scores.at(-1)?.score ?? 0) - (b.scores.at(-1)?.score ?? 0);
    })[0];
  }, [alerts]);

  const trending = useMemo(() => {
    if (!alerts.length) return null;
    return [...alerts].sort((a, b) => b.triggeredAt - a.triggeredAt)[0];
  }, [alerts]);

  const pendingDeg = (pendingCount / totalCount) * 360;
  const escalatedDeg = (escalatedCount / totalCount) * 360;

  const searchMatches = (a) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return a.childId.toLowerCase().includes(q) || a.campName.toLowerCase().includes(q) || a.alertType.toLowerCase().includes(q);
  };

  const dropdownAlerts = alerts.filter(searchMatches);
  const selectedAlert = dropdownAlerts.find((a) => a.id === selectedAlertId) ?? dropdownAlerts[0] ?? null;

  function viewAlert(id) {
    setSelectedAlertId(id);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .nitec-hero-grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: 1.25rem; }
        .nitec-bottom-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
        @media (max-width: 900px) {
          .nitec-hero-grid { grid-template-columns: 1fr; }
          .nitec-bottom-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .hero-donut-wrap { display: none !important; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100svh",
          background: T.bg,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          paddingLeft: "var(--rail-width, 236px)",
          transition: "padding-left 0.2s ease, background 0.2s",
        }}
      >
        <SideNav />

        <main style={{ flex: 1 }}>
          {/* ══ Big rounded panel — mirrors the reference composition ══ */}
          <div
            style={{
              background: T.panel,
              padding: "clamp(1rem, 2vw, 1.75rem)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            {/* ── Header: logo · search · icons · admin ── */}
            <PageHeader
              title="Welfare Alerts"
              subtitle={`${activeCount} active · ${pendingCount} pending · ${escalatedCount} escalated`}
              search={{
                value: search,
                onChange: setSearch,
                placeholder: "Search child ID, camp, alert type…",
                onRefresh: fetchAlerts,
                refreshing: loading,
              }}
            />

            {/* ── Hero: left copy panel + right widget stack ── */}
            <div className="nitec-hero-grid">
              {/* Left hero copy */}
              <div
                style={{
                  background: T.card,
                  borderRadius: "1.5rem",
                  padding: "clamp(1.25rem, 3vw, 2.25rem)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  position: "relative",
                  overflow: "hidden",
                  border: `1px solid ${T.border}`,
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
                    color: T.textSoft,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <Radio size={13} color={T.green} /> Live Monitoring
                </span>

                <h1
                  style={{
                    fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)",
                    fontWeight: 800,
                    color: T.textPrimary,
                    lineHeight: 1.08,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Welfare Alerts
                  <br />
                  Overview.
                </h1>

{/* Score Trend Mentioned Pharagraph */}
                <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", maxWidth: 360 }}>
                  <span style={{ fontSize: "1.4rem", fontWeight: 300, color: T.muted, flexShrink: 0 }}>01</span>
                  <div style={{ width: 34, height: 2, background: T.muted, marginTop: "0.9rem", flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: "0.95rem", fontWeight: 800, color: T.textPrimary }}>Score Trends</p>
                    <p style={{ fontSize: "0.82rem", color: T.muted, marginTop: "2px", lineHeight: 1.5 }}>
                      Inhibition, tap-accuracy &amp; reaction-time drift tracked every session — so at-risk children surface before it becomes a
                      pattern.
                    </p>
                  </div>
                </div>


                <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", maxWidth: 360 }}>
                  <span style={{ fontSize: "1.4rem", fontWeight: 300, color: T.muted, flexShrink: 0 }}>02</span>
                  <div style={{ width: 34, height: 2, background: T.muted, marginTop: "0.9rem", flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: "0.95rem", fontWeight: 800, color: T.textPrimary }}>Physco Awareness</p>
                    <p style={{ fontSize: "0.82rem", color: T.muted, marginTop: "2px", lineHeight: 1.5 }}>
                      Child's physcology level alert trigger when the physco attemps are falling down in certain level
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    const target = mostCritical ?? alerts[0];
                    if (target) viewAlert(target.id);
                  }}
                  icon={<ArrowUpRight size={15} />}
                >
                  View Critical Alert
                </Button>

                {/* Decorative stat donut, standing in for the hero product shot */}
                <div
                  style={{
                    position: "absolute",
                    right: "clamp(0.5rem, 3vw, 2.5rem)",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 190,
                    height: 190,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  className="hero-donut-wrap"
                >
                  <div
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background: `conic-gradient(${T.amber} 0deg ${pendingDeg}deg, ${T.purple} ${pendingDeg}deg ${pendingDeg + escalatedDeg}deg, ${T.teal} ${pendingDeg + escalatedDeg}deg 360deg)`,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      width: "68%",
                      height: "68%",
                      borderRadius: "50%",
                      background: T.bg,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: "1.6rem", fontWeight: 800, color: T.textPrimary }}>{activeCount}</span>
                    <span style={{ fontSize: "0.6rem", fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Active
                    </span>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: -8,
                      left: 10,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: T.red,
                      animation: "floatY 3.2s ease-in-out infinite",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 4,
                      right: -10,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: T.card,
                      border: `2px solid ${T.border}`,
                      animation: "floatY 4s ease-in-out infinite 0.4s",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "20%",
                      right: -18,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: T.green,
                      animation: "floatY 2.6s ease-in-out infinite 0.8s",
                    }}
                  />
                </div>

                {/* Camp filter row (stands in for the "Follow us on" row) */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "auto", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: T.muted }}>Filter camp:</span>
                  {MOCK_CAMPS.map((c) => {
                    const active = selectedCamp === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCamp(c.id)}
                        title={c.name}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: active ? T.textPrimary : T.card,
                          color: active ? T.bg : T.textSoft,
                          border: `1px solid ${active ? T.textPrimary : T.border}`,
                          fontSize: "0.6rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {c.code === "ALL" ? "✦" : c.code.slice(0, 2)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right widget stack */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Alert selection dropdown */}
                <div style={{ background: T.card, borderRadius: "1.25rem", padding: "1.1rem 1.25rem", border: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.7rem" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 800, color: T.textPrimary }}>Select Alert</p>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        color: T.muted,
                        background: T.bar,
                        borderRadius: "9999px",
                        padding: "2px 8px",
                      }}
                    >
                      {dropdownAlerts.length}
                    </span>
                  </div>
                  <select
                    value={selectedAlert?.id ?? ""}
                    onChange={(e) => setSelectedAlertId(e.target.value)}
                    aria-label="Select alert"
                    style={{
                      width: "100%",
                      background: T.bar,
                      color: T.textPrimary,
                      border: `1px solid ${T.border}`,
                      borderRadius: "0.75rem",
                      padding: "9px 12px",
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {dropdownAlerts.length === 0 && <option value="">No alerts</option>}
                    {dropdownAlerts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.childId} — {a.alertType}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Most critical */}
                <div
                  onClick={() => mostCritical && viewAlert(mostCritical.id)}
                  style={{
                    background: T.mode === 'dark'
                      ? `linear-gradient(155deg, #0F172A 0%, #1E293B 100%)`
                      : `linear-gradient(155deg, #F8FAFC 0%, #E2E8F0 100%)`,
                    borderRadius: "1.25rem",
                    padding: "1.1rem 1.25rem",
                    border: T.mode === 'dark' ? 'none' : `1px solid ${T.border}`,
                    color: T.mode === 'dark' ? '#fff' : '#0F172A',
                    cursor: mostCritical ? "pointer" : "default",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: T.mode === 'dark' ? "rgba(255,255,255,0.65)" : '#475569' }}>Most Critical</p>
                    <ArrowChip dark={T.mode === 'light'} />
                  </div>
                  {mostCritical ? (
                    <>
                      <p style={{ fontSize: "1.15rem", fontWeight: 800 }}>{mostCritical.childId}</p>
                      <p style={{ fontSize: "0.76rem", color: T.mode === 'dark' ? "rgba(255,255,255,0.7)" : '#64748B' }}>{mostCritical.alertType}</p>
                    </>
                  ) : (
                    <p style={{ fontSize: "0.95rem", fontWeight: 700 }}>No Recodes</p>
                  )}
                </div>

                {/* Selected alert detail */}
                <div ref={detailRef} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: T.muted }}>Alert Detail</p>
                    <ArrowChip dark={T.mode === 'dark'} />
                  </div>
                  {selectedAlert ? (
                    <AlertCard alert={selectedAlert} onAction={handleAction} highlighted={false} />
                  ) : (
                    <div
                      style={{
                        background: T.card,
                        borderRadius: "1.25rem",
                        border: `1px solid ${T.border}`,
                        padding: "2rem",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <p style={{ fontSize: "1.2rem", fontWeight: 800, color: T.textPrimary }}>No alerts</p>
                      <p style={{ fontSize: "0.84rem", color: T.muted }}>No Recodes</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Bottom row: 3 summary cards ── */}
            <div className="nitec-bottom-grid">
              <div
                onClick={() => {
                  const target = mostCritical ?? alerts[0];
                  if (target) viewAlert(target.id);
                }}
                style={{
                  background: T.card,
                  borderRadius: "1.25rem",
                  padding: "1.25rem",
                  border: `1px solid ${T.border}`,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  transition: "background 0.2s, border 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "0.95rem", fontWeight: 800, color: T.textPrimary }}>All Alerts</p>
                    <p style={{ fontSize: "0.78rem", color: T.muted, fontWeight: 600 }}>{alerts.length} total logged</p>
                  </div>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: T.bar,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <ListChecks size={16} color={T.textPrimary} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {[
                    ["Pending", T.amber, pendingCount],
                    ["Escalated", T.purple, escalatedCount],
                    ["Resolved", T.teal, resolvedCount],
                  ].map(([label, color, n]) => (
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
                      }}
                    >
                      {n} {label}
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  background: T.card,
                  borderRadius: "1.25rem",
                  padding: "1.25rem",
                  border: `1px solid ${T.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  alignItems: "flex-start",
                  transition: "background 0.2s, border 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", marginLeft: 8 }}>
                  {["DP", "RM", "SK"].map((initials, i) => (
                    <div
                      key={initials}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        marginLeft: -8,
                        background: [T.teal, T.amber, T.purple][i],
                        color: T.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "0.68rem",
                        border: `2px solid ${T.card}`,
                      }}
                    >
                      {initials}
                    </div>
                  ))}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      marginLeft: -8,
                      background: T.textPrimary,
                      color: T.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      border: `2px solid ${T.card}`,
                    }}
                  >
                    <Users size={14} />
                  </div>
                </div>
                <p style={{ fontSize: "1.3rem", fontWeight: 800, color: T.textPrimary }}>3 Admins</p>
                <span
                  style={{
                    background: `${T.green}16`,
                    color: T.green,
                    borderRadius: "9999px",
                    padding: "3px 10px",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                >
                  ● On duty now
                </span>
              </div>

              <div
                onClick={() => trending && viewAlert(trending.id)}
                style={{
                  background: T.card,
                  borderRadius: "1.25rem",
                  padding: "1.25rem",
                  border: `1px solid ${T.border}`,
                  cursor: trending ? "pointer" : "default",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  transition: "background 0.2s, border 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      background: `${T.red}14`,
                      color: T.red,
                      borderRadius: "9999px",
                      padding: "3px 10px",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                    }}
                  >
                    <Flame size={12} /> Newest
                  </span>
                  <ArrowChip dark={T.mode === 'dark'} />
                </div>
                {trending ? (
                  <>
                    <p style={{ fontSize: "0.9rem", fontWeight: 800, color: T.textPrimary }}>{trending.alertType}</p>
                    <p style={{ fontSize: "0.76rem", color: T.muted, fontWeight: 600 }}>
                      {trending.childId} · {trending.campName} · {daysSince(trending.triggeredAt)}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: "0.9rem", color: T.muted, fontWeight: 600 }}>No alerts yet</p>
                )}
              </div>
            </div>

            {/* ── Alert Records Table ─────────────────────────── */}
            <div style={{ marginTop: "0.5rem" }}>
              <DataTable
                columns={ALERT_COLUMNS}
                data={dropdownAlerts}
                title="Alert Records"
                subtitle={`${dropdownAlerts.length} alerts · ${selectedCamp === "all" ? "All camps" : selectedCamp.toUpperCase()}`}
                filterOptions={[
                  { key: "all", label: "All" },
                  { key: "pending", label: "Pending" },
                  { key: "escalated", label: "Escalated" },
                  { key: "resolved", label: "Resolved" },
                ]}
                filterKey="status"
                searchKeys={["childId", "campName", "alertType"]}
                searchPlaceholder="Search by child ID, camp, or alert type…"
                loading={loading}
                emptyMessage={alerts.length === 0 ? "No alerts found" : "No alerts match your filters"}
                rowKey="id"
                onRowClick={(row) => viewAlert(row.id)}
                selectedRow={selectedAlert?.id}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
