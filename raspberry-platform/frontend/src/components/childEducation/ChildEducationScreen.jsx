import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldCheck,
  CalendarDays,
  BookOpen,
  List,
  ChevronRight,
  ChevronDown,
  User,
  Search,
  SlidersHorizontal,
  ArrowLeft,
} from "lucide-react";
import DataTable from "../ui/display/DataTable";
import ErrorState from "../ui/feedback/ErrorState";
import { useToast } from "../ui/feedback/Toast";
import { fetchChildDirectory, fetchChildEducation } from "@/components/psychoedu/lib/api";
import { COLORS, SHADOW_CARD, TONE } from "../../lib/tokens";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

/* ------------------------------------------------------------------ */
/*  LOCAL PRIMITIVES — mirror the FloodWatch / ReliefOps design system  */
/* ------------------------------------------------------------------ */

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl bg-white p-4 sm:p-5 lg:p-6 ${className}`}>
      {children}
    </div>
  );
}

function IconTile({ icon: Icon, tone = "brand", size = "md" }) {
  const t = TONE[tone] || TONE.brand;
  const dims = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-11 h-11" : "w-9 h-9";
  return (
    <div className={`${dims} rounded-lg flex items-center justify-center shrink-0`} style={{ backgroundColor: t.bg }}>
      <Icon className={size === "lg" ? "w-5 h-5" : "w-4 h-4"} style={{ color: t.color }} strokeWidth={1.7} />
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-3 sm:mb-4">
      <IconTile icon={icon} />
      <div>
        <h2 className="text-[13px] sm:text-[14px] font-medium" style={{ color: COLORS.ink }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] sm:text-[11.5px]" style={{ color: COLORS.muted }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function Chip({ children, tone = "neutral" }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold tracking-wide border"
      style={{ color: t.color, backgroundColor: t.bg, borderColor: t.border }}
    >
      {children}
    </span>
  );
}

function Avatar({ name, size = "md" }) {
  const dims = size === "sm" ? "w-8 h-8 text-[11px]" : "w-11 h-11 text-[14px]";
  const initials = (name || "")
    .split(/[\s-]/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`${dims} rounded-lg flex items-center justify-center shrink-0 font-medium`}
      style={{ backgroundColor: COLORS.brandSoft, color: COLORS.brand }}
    >
      {initials || <User className="w-1/2 h-1/2" />}
    </div>
  );
}

function Button({ variant = "primary", size = "md", loading, loadingText, children, className = "", ...props }) {
  const sizeCls = size === "sm" ? "text-[11.5px] py-1.5 px-3" : "text-[12.5px] py-2.5 px-4";
  const style =
    variant === "primary"
      ? { backgroundColor: COLORS.brand, color: "#fff" }
      : { backgroundColor: "transparent", color: COLORS.body, border: `1px solid ${COLORS.line}` };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-opacity disabled:opacity-40 hover:opacity-90 ${sizeCls} ${className}`}
      style={style}
    >
      {loading ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {loadingText || "Working…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full py-2.5 px-3.5 rounded-lg border text-[13px] font-medium focus:outline-none transition-colors"
      style={{ borderColor: COLORS.line, color: COLORS.ink, backgroundColor: "#FAFAF9" }}
    />
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  const t = TONE[tone] || TONE.brand;
  return (
    <Card className="relative overflow-hidden group">
      <div
        className="absolute -right-5 -top-5 w-20 h-20 rounded-full group-hover:scale-150 transition-transform duration-500"
        style={{ backgroundColor: t.bg }}
      />
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: COLORS.muted }}>
            {label}
          </span>
        </div>
        <span className="text-[19px] font-semibold tracking-tight" style={{ color: COLORS.ink }}>
          {value}
        </span>
      </div>
    </Card>
  );
}

function FieldRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: COLORS.grid }}>
      <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: COLORS.muted }}>
        {label}
      </span>
      <span className="text-[12px] font-medium" style={{ color: COLORS.ink }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN SCREEN                                                         */
/* ------------------------------------------------------------------ */

function ChildEducationScreen() {
  const { addToast } = useToast();
  const [childId, setChildId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [children, setChildren] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [childrenError, setChildrenError] = useState("");
  const [dirSearch, setDirSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState("");
  const abortRef = useRef(null);

  const fetchChildren = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setChildrenLoading(true);
    setChildrenError("");
    fetchChildDirectory(1, 100)
      .then((data) => {
        setChildren(data.children || []);
        setChildrenLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setChildrenError(err.message || "Failed to load children");
          setChildrenLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const loadChild = async (value) => {
    const searchValue = (value || childId).trim();
    if (!searchValue) {
      setError("Enter a child ID to search.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchChildEducation(searchValue);
      setPayload(data);
      setChildId(searchValue);
    } catch (err) {
      setPayload(null);
      setError(err?.message || "Unable to load child education data.");
      addToast(err?.message || "Failed to load child data", "error");
    } finally {
      setLoading(false);
    }
  };

  const stats = payload?.stats || {};
  const child = payload?.child || null;
  const sessions = payload?.sessions || [];
  const alerts = payload?.alerts || [];

  const alertSummary = {
    pending: alerts.filter((a) => a.status === "pending").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  };

  const latestZScore = sessions.length > 0 ? sessions[0].z_score : null;

  return (
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>
      <div className="sm:px-5 lg:px-6 py-2 sm:py-5 space-y-4 sm:space-y-6">
        {/* ================= HEADER + SEARCH ================= */}
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="font-medium text-[24px] sm:text-[28px] leading-[1.1] tracking-tight">Child Education</h1>
                <p className="text-[12px] mt-1" style={{ color: COLORS.muted }}>
                  {child ? child.child_id : "Session history, alerts & profile details"}
                </p>
              </div>
            </div>

            {child ? (
              <button
                onClick={() => { setPayload(null); setChildId(""); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12.5px] font-semibold transition-colors hover:opacity-80 self-start"
                style={{ borderColor: COLORS.line, color: COLORS.body, backgroundColor: "transparent" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
                Back
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="w-4 h-4" style={{ color: COLORS.muted }} />
                  </div>
                  <input
                    type="text"
                    value={dirSearch}
                    onChange={(e) => setDirSearch(e.target.value)}
                    placeholder="Search by child ID or res ID..."
                    className="w-full sm:w-72 pl-9 pr-3 py-2 rounded-lg border text-[13px] focus:outline-none transition-colors"
                    style={{ backgroundColor: "#FAFAF9", borderColor: COLORS.line, color: COLORS.ink }}
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <SlidersHorizontal className="w-4 h-4" style={{ color: COLORS.muted }} />
                  </div>
                  <select
                    value={alertFilter}
                    onChange={(e) => setAlertFilter(e.target.value)}
                    className="w-full sm:w-auto pl-9 pr-8 py-2 rounded-lg border text-[13px] font-medium focus:outline-none transition-colors appearance-none cursor-pointer"
                    style={{ backgroundColor: "#FAFAF9", borderColor: COLORS.line, color: COLORS.body }}
                  >
                    <option value="">All Alerts</option>
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                    <option value="none">None</option>
                  </select>
                  <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none">
                    <ChevronDown className="w-3.5 h-3.5" style={{ color: COLORS.muted }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <ErrorState
                  title="Could not load child"
                  message={error}
                  className="mt-3 border-0 p-3"
                  style={{ backgroundColor: TONE.danger.bg, color: TONE.danger.color }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ================= CHILD PROFILE ================= */}
        {child ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-4 sm:space-y-6">

            {/* Stats Row */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              <StatCard label="Total Sessions" value={stats.total_sessions ?? child.total_sessions ?? 0} icon={BookOpen} tone="brand" />
              <StatCard label="Pending Alerts" value={alertSummary.pending} icon={AlertTriangle} tone="warning" />
              <StatCard label="Resolved" value={alertSummary.resolved} icon={CheckCircle} tone="info" />
            </div>

            {/* Profile + Alerts Grid */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <SectionHeader icon={ShieldCheck} title="Child Record" subtitle={child.child_id} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["Res ID", child.res_id],
                    ["Camp ID", child.camp_id],
                    ["Grade", child.grade],
                    ["Language", child.language],
                    ["Zone", child.zone_id || "-"],
                    ["Enrolled", formatDate(child.enrolled_at)],
                    ["Baseline", child.baseline_score],
                    ["Alert Status", child.alert_status],
                    ["Consecutive Low", child.consecutive_low],
                    ["SDQ Band", child.sdq_band],
                    ["QR Available", child.qr_code_data ? "Yes" : "No"],
                    ["Sessions Done", child.total_sessions],
                    ["Latest Z-Score", latestZScore != null ? Number(latestZScore).toFixed(2) : "-"],
                  ].map(([label, value]) => (
                    <FieldRow key={label} label={label} value={value} />
                  ))}
                </div>
              </Card>

              <Card>
                <SectionHeader icon={AlertTriangle} title="Alert Overview" subtitle="Triggered alerts" />
                <div className="space-y-2">
                  {alerts.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center" style={{ borderColor: COLORS.line, backgroundColor: "#FAFAF9" }}>
                      <CheckCircle className="w-5 h-5 mx-auto mb-2" style={{ color: COLORS.brand }} />
                      <p className="text-[12.5px]" style={{ color: COLORS.muted }}>
                        No alerts for this child
                      </p>
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <div key={alert.alert_id} className="rounded-lg border p-3" style={{ borderColor: COLORS.line, backgroundColor: "#FAFAF9" }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px]" style={{ color: COLORS.muted }}>
                            {alert.alert_id?.slice(0, 12)}...
                          </span>
                          <Chip tone={alert.status === "pending" ? "warning" : alert.status === "resolved" ? "brand" : "neutral"}>
                            {alert.status}
                          </Chip>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[10.5px]" style={{ color: COLORS.muted }}>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDate(alert.triggered_at)}
                          </span>
                          {alert.resolved_at && <span>Resolved: {formatDate(alert.resolved_at)}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Session History */}
            <Card>
              <SectionHeader icon={CalendarDays} title="Session History" subtitle={`${sessions.length} recorded sessions`} />
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: COLORS.line }}>
                <table className="min-w-full text-left text-[12.5px]">
                  <thead style={{ backgroundColor: "#FAFAF9" }}>
                    <tr className="border-b" style={{ borderColor: COLORS.hairline }}>
                      {["Session", "Date / Time", "Gate", "Z-Score", "Flags", "Sync"].map((h) => (
                        <th
                          key={h}
                          className="px-3 sm:px-4 py-3 font-medium text-[11px] uppercase tracking-wider"
                          style={{ color: COLORS.muted }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-[12.5px]" style={{ color: COLORS.muted }}>
                          No sessions found.
                        </td>
                      </tr>
                    ) : (
                      sessions.map((s) => (
                        <tr key={s.session_id} className="border-t transition-colors" style={{ borderColor: COLORS.hairline }}>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="text-[12px]" style={{ color: COLORS.ink }}>
                              {s.session_id?.slice(0, 16)}...
                            </div>
                            <div className="text-[11px]" style={{ color: COLORS.muted }}>
                              {s.content_session_id || "-"}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3" style={{ color: COLORS.body }}>
                            <div className="text-[12.5px]">{s.session_date || "-"}</div>
                            <div className="text-[10px]" style={{ color: COLORS.muted }}>
                              {s.session_time || "-"}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            <Chip>{s.gate_decision || "-"}</Chip>
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            {s.z_score != null ? (
                              <span
                                className="text-[12px] font-medium"
                                style={{
                                  color: s.z_score < -2.0 ? TONE.danger.color : s.z_score < -1.0 ? TONE.warning.color : COLORS.brand,
                                }}
                              >
                                {Number(s.z_score).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[12px]" style={{ color: COLORS.muted }}>-</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              <Chip tone={Number(s.anomaly_flagged) === 1 ? "danger" : "neutral"}>
                                {Number(s.anomaly_flagged) === 1 ? "Anomaly" : "Normal"}
                              </Chip>
                              {Number(s.alert_triggered) === 1 && <Chip tone="warning">Alert</Chip>}
                              <Chip tone={s.session_complete === 1 ? "brand" : "neutral"}>{s.session_complete === 1 ? "Done" : "Open"}</Chip>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        ) : (
          /* ================= CHILDREN DIRECTORY ================= */
          <div>
            {childrenError && (
              <div className="mb-3">
                <ErrorState
                  title="Could not load children"
                  message={childrenError}
                  onRetry={fetchChildren}
                  retryText="Retry"
                  className="border-0 p-3"
                  style={{ backgroundColor: TONE.danger.bg, color: TONE.danger.color }}
                />
              </div>
            )}

            <DataTable
              columns={[
                {
                  key: "child_id",
                  label: "Child ID",
                  render: (val) => (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={val} size="sm" />
                      <span className="font-medium" style={{ color: COLORS.ink }}>
                        {val}
                      </span>
                    </div>
                  ),
                },
                { key: "res_id", label: "Res ID" },
                { key: "grade", label: "Grade" },
                { key: "camp_id", label: "Camp" },
                { key: "total_sessions", label: "Sessions" },
                {
                  key: "alert_status",
                  label: "Alert",
                  render: (val) => <Chip tone={val === "active" ? "danger" : val === "resolved" ? "brand" : "neutral"}>{val || "none"}</Chip>,
                },
              ]}
              data={children.filter((row) => {
                if (alertFilter && row.alert_status !== alertFilter) return false;
                if (dirSearch) {
                  const q = dirSearch.toLowerCase();
                  const matchId = row.child_id?.toLowerCase().includes(q);
                  const matchRes = row.res_id?.toLowerCase().includes(q);
                  if (!matchId && !matchRes) return false;
                }
                return true;
              })}
              loading={childrenLoading}
              searchPlaceholder=""
              searchKeys={[]}
              pageSize={10}
              emptyMessage="No children found"
              onRowClick={(row) => loadChild(row.child_id)}
              mobileCard={(row) => (
                <div className="flex items-center gap-3">
                  <Avatar name={row.child_id} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold truncate" style={{ color: COLORS.ink }}>
                        {row.child_id}
                      </span>
                      <Chip tone={row.alert_status === "active" ? "danger" : "neutral"}>{row.alert_status || "none"}</Chip>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: COLORS.muted }}>
                      <span>Grade {row.grade}</span>
                      <span style={{ color: COLORS.line }}>·</span>
                      <span>{row.total_sessions ?? 0} sessions</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: COLORS.muted }} />
                </div>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ChildEducationScreen;
