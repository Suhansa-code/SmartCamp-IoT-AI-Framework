"use client";

// Welfare Alert Dashboard — "nitec" reference layout
// Hero + widget-grid composition (search header · big left headline panel ·
// stacked right widget cards) with real alert data mapped into every slot.
// Alerts are picked from a dropdown and inspected in the detail card.

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ArrowUpRight, Radio, Users, Flame, ListChecks } from "lucide-react";
import SideNav from "@/components/common/SideNav";
import PageHeader from "@/components/common/PageHeader";
import { P, SEVERITY_RANK } from "@/data/theme.data";
import { MOCK_CAMPS, mockAlerts } from "@/data/alerts.data";
import AlertCard from "@/components/alert/AlertCard";
import ArrowChip from "@/components/alert/ArrowChip";
import Button from "@/components/common/Button";
import { daysSince } from "@/components/common/utils";

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamp, setSelectedCamp] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const detailRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/alerts?camp=${selectedCamp === "all" ? "" : selectedCamp}`);
      if (res.ok) {
        const data = await res.json();
        const transformed = data.alerts.map((a) => ({
          id: a.alert_id,
          childId: a.child_id.replace(/TEST-CHILD-/, "").replace(/CHILD-/, ""),
          campId: a.camp_id?.toLowerCase() ?? "unknown",
          campName: a.camp_id ?? "Unknown Camp",
          alertType: a.alert_type ?? "Unknown Alert",
          severity:
            a.alert_type?.includes("Low") || a.alert_type?.includes("low")
              ? "low"
              : a.alert_type?.includes("High") || a.alert_type?.includes("high")
                ? "high"
                : "medium",
          status: a.status === "pending" ? "pending" : "resolved",
          triggeredAt: new Date(a.triggered_at).getTime(),
          scores: (a.recent_scores || []).map((score, idx) => ({ session: idx + 1, score })),
        }));
        setAlerts(transformed);
      } else {
        throw new Error("API error");
      }
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
          background: P.outer,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          paddingLeft: "var(--rail-width, 236px)",
          transition: "padding-left 0.2s ease",
        }}
      >
        <SideNav />

        <main style={{ flex: 1 }}>
          {/* ══ Big rounded panel — mirrors the reference composition ══ */}
          <div
            style={{
              background: P.panel,
              padding: "clamp(1rem, 2vw, 1.75rem)",
              boxShadow: "0 30px 70px rgba(20,30,40,0.25)",
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
              pendingCount={pendingCount}
              escalatedCount={escalatedCount}
              onBellClick={() => {
                const a = alerts.find((x) => x.status === "pending");
                if (a) viewAlert(a.id);
              }}
              onEscalatedClick={() => {
                const a = alerts.find((x) => x.status === "escalated");
                if (a) viewAlert(a.id);
              }}
            />

            {/* ── Hero: left copy panel + right widget stack ── */}
            <div className="nitec-hero-grid">
              {/* Left hero copy */}
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

                <h1
                  style={{
                    fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)",
                    fontWeight: 800,
                    color: P.ink,
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


                <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", maxWidth: 360 }}>
                  <span style={{ fontSize: "1.4rem", fontWeight: 300, color: P.muted, flexShrink: 0 }}>02</span>
                  <div style={{ width: 34, height: 2, background: P.muted, marginTop: "0.9rem", flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: "0.95rem", fontWeight: 800, color: P.ink }}>Physco Awareness</p>
                    <p style={{ fontSize: "0.82rem", color: P.muted, marginTop: "2px", lineHeight: 1.5 }}>
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
                      background: `conic-gradient(${P.amber} 0deg ${pendingDeg}deg, ${P.purple} ${pendingDeg}deg ${pendingDeg + escalatedDeg}deg, ${P.teal} ${pendingDeg + escalatedDeg}deg 360deg)`,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      width: "68%",
                      height: "68%",
                      borderRadius: "50%",
                      background: P.panelSoft,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "inset 0 0 0 1px rgba(20,23,26,0.06)",
                    }}
                  >
                    <span style={{ fontSize: "1.6rem", fontWeight: 800, color: P.ink }}>{activeCount}</span>
                    <span style={{ fontSize: "0.6rem", fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
                      background: P.red,
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
                      background: P.card,
                      border: `2px solid ${P.dark}`,
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
                      background: P.green,
                      animation: "floatY 2.6s ease-in-out infinite 0.8s",
                    }}
                  />
                </div>

                {/* Camp filter row (stands in for the "Follow us on" row) */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "auto", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: P.muted }}>Filter camp:</span>
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
                          background: active ? P.dark : P.card,
                          color: active ? "#fff" : P.inkSoft,
                          border: `1px solid ${active ? P.dark : P.border}`,
                          fontSize: "0.6rem",
                          fontWeight: 800,
                          cursor: "pointer",
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
                <div style={{ background: P.card, borderRadius: "1.25rem", padding: "1.1rem 1.25rem", border: `1px solid ${P.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.7rem" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 800, color: P.ink }}>Select Alert</p>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        color: P.muted,
                        background: P.cardSoft,
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
                      background: P.cardSoft,
                      color: P.ink,
                      border: `1px solid ${P.border}`,
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
                    background: `linear-gradient(155deg, ${P.dark} 0%, #2A2F35 100%)`,
                    borderRadius: "1.25rem",
                    padding: "1.1rem 1.25rem",
                    color: "#fff",
                    cursor: mostCritical ? "pointer" : "default",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>Most Critical</p>
                    <ArrowChip dark />
                  </div>
                  {mostCritical ? (
                    <>
                      <p style={{ fontSize: "1.15rem", fontWeight: 800 }}>{mostCritical.childId}</p>
                      <p style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.7)" }}>{mostCritical.alertType}</p>
                    </>
                  ) : (
                    <p style={{ fontSize: "0.95rem", fontWeight: 700 }}>No Recodes</p>
                  )}
                </div>

                {/* Selected alert detail */}
                <div ref={detailRef} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: P.muted }}>Alert Detail</p>
                    <ArrowChip />
                  </div>
                  {selectedAlert ? (
                    <AlertCard alert={selectedAlert} onAction={handleAction} highlighted={false} />
                  ) : (
                    <div
                      style={{
                        background: P.card,
                        borderRadius: "1.25rem",
                        border: `1px solid ${P.border}`,
                        padding: "2rem",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <p style={{ fontSize: "1.2rem", fontWeight: 800, color: P.ink }}>No alerts</p>
                      <p style={{ fontSize: "0.84rem", color: P.muted }}>No Recodes</p>
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
                  background: P.card,
                  borderRadius: "1.25rem",
                  padding: "1.25rem",
                  border: `1px solid ${P.border}`,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "0.95rem", fontWeight: 800, color: P.ink }}>All Alerts</p>
                    <p style={{ fontSize: "0.78rem", color: P.muted, fontWeight: 600 }}>{alerts.length} total logged</p>
                  </div>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: P.cardSoft,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${P.border}`,
                    }}
                  >
                    <ListChecks size={16} color={P.ink} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {[
                    ["Pending", P.amber, pendingCount],
                    ["Escalated", P.purple, escalatedCount],
                    ["Resolved", P.teal, resolvedCount],
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
                  background: P.card,
                  borderRadius: "1.25rem",
                  padding: "1.25rem",
                  border: `1px solid ${P.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  alignItems: "flex-start",
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
                        background: ["#14B8A6", "#F59E0B", "#8B5CF6"][i],
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "0.68rem",
                        border: "2px solid #fff",
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
                      background: P.dark,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      border: "2px solid #fff",
                    }}
                  >
                    <Users size={14} />
                  </div>
                </div>
                <p style={{ fontSize: "1.3rem", fontWeight: 800, color: P.ink }}>3 Admins</p>
                <span
                  style={{
                    background: `${P.green}16`,
                    color: P.green,
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
                  background: P.card,
                  borderRadius: "1.25rem",
                  padding: "1.25rem",
                  border: `1px solid ${P.border}`,
                  cursor: trending ? "pointer" : "default",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      background: `${P.red}14`,
                      color: P.red,
                      borderRadius: "9999px",
                      padding: "3px 10px",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                    }}
                  >
                    <Flame size={12} /> Newest
                  </span>
                  <ArrowChip />
                </div>
                {trending ? (
                  <>
                    <p style={{ fontSize: "0.9rem", fontWeight: 800, color: P.ink }}>{trending.alertType}</p>
                    <p style={{ fontSize: "0.76rem", color: P.muted, fontWeight: 600 }}>
                      {trending.childId} · {trending.campName} · {daysSince(trending.triggeredAt)}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: "0.9rem", color: P.muted, fontWeight: 600 }}>No alerts yet</p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
