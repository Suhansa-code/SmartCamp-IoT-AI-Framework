import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Search, Users, AlertTriangle, CheckCircle,
  Clock, RefreshCw, ShieldCheck, CalendarDays,
  Activity, BookOpen, List, ArrowRight, ChevronRight,
} from "lucide-react";
import Button from "../ui/base/Button";
import DataTable from "../ui/display/DataTable";
import LoadingState from "../ui/feedback/LoadingState";
import ErrorState from "../ui/feedback/ErrorState";
import { useToast } from "../ui/feedback/Toast";
import { fetchChildDirectory, fetchChildEducation } from "@/components/psychoedu/lib/api";
import Card from "../ui/base/Card";
import SectionHeader from "../ui/base/SectionHeader";
import SearchInput from "../ui/base/SearchInput";
import Avatar from "../ui/base/Avatar";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function ChildEducationScreen() {
  const { addToast } = useToast();
  const [childId, setChildId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const [children, setChildren] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [childrenError, setChildrenError] = useState("");
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

  useEffect(() => {
    if (autoLoaded) return;
    const cachedChild =
      localStorage.getItem("selectedChildId") ||
      sessionStorage.getItem("selectedChildId");
    if (cachedChild) {
      setChildId(cachedChild);
      setAutoLoaded(true);
      loadChild(cachedChild);
    }
  }, [autoLoaded]);

  const stats = payload?.stats || {};
  const child = payload?.child || null;
  const sessions = payload?.sessions || [];
  const alerts = payload?.alerts || [];

  const alertSummary = {
    pending: alerts.filter((a) => a.status === "pending").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
    unsynced: alerts.filter((a) => Number(a.synced) !== 1).length,
  };

  return (
    <div className="space-y-4">
      {/* Header + Search */}
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-semibold text-slate-800">
                  Child Education
                </h2>
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  Session history, alerts & profile details
                </p>
              </div>
            </div>
          </div>
          <form
            className="flex w-full max-w-lg flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              loadChild(childId);
            }}
          >
            <SearchInput
              value={childId}
              onChange={setChildId}
              placeholder="Enter child ID, e.g. CAMP-B-000001"
            />
            <Button type="submit" loading={loading} size="md">
              Search
            </Button>
          </form>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <ErrorState message={error} className="mt-3 border-0 bg-red-50 p-3" />
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Child Profile (when selected) */}
      {child ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Back + Stats */}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setPayload(null);
                setChildId("");
              }}
            >
              ← Back
            </Button>
            <div className="flex-1" />
            <span className="text-[11px] text-slate-400">
              {child.child_id}
            </span>
          </div>

          {/* Stats Row */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Sessions", value: stats.total_sessions ?? child.total_sessions ?? 0, icon: BookOpen, color: "teal" },
              { label: "Pending Alerts", value: alertSummary.pending, icon: AlertTriangle, color: "amber" },
              { label: "Resolved", value: alertSummary.resolved, icon: CheckCircle, color: "sky" },
              { label: "Sync State", value: Number(child.synced) === 1 ? "Synced" : "Pending", icon: Activity, color: "teal" },
            ].map((item, i) => (
              <Card key={item.label} className="relative overflow-hidden group hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-300">
                <div className={`absolute -right-5 -top-5 w-20 h-20 bg-gradient-to-br ${
                  item.color === "amber" ? "from-amber-500/10 to-orange-500/10" :
                  item.color === "sky" ? "from-sky-500/10 to-blue-500/10" :
                  "from-teal-500/10 to-sky-500/10"
                } rounded-full group-hover:scale-150 transition-transform duration-500`} />
                <div className="relative">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <item.icon className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{item.label}</span>
                  </div>
                  <span className="text-xl font-bold text-slate-800 font-mono tracking-tight">{item.value}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Profile + Alerts Grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Child Record */}
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
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                    <span className="text-xs font-semibold text-slate-700">{value}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Alert Overview */}
            <Card>
              <SectionHeader icon={AlertTriangle} title="Alert Overview" subtitle="Triggered alerts" />

              <div className="space-y-2">
                {alerts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No alerts for this child</p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.alert_id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400">{alert.alert_id?.slice(0, 12)}...</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${
                            alert.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-100" :
                            alert.status === "resolved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                            {alert.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(alert.triggered_at)}
                        </span>
                        {alert.resolved_at && (
                          <span>Resolved: {formatDate(alert.resolved_at)}</span>
                        )}
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

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 sm:px-4 py-2.5 font-semibold">Session</th>
                    <th className="px-3 sm:px-4 py-2.5 font-semibold">Date / Time</th>
                    <th className="px-3 sm:px-4 py-2.5 font-semibold">Gate</th>
                    <th className="px-3 sm:px-4 py-2.5 font-semibold">Flags</th>
                    <th className="px-3 sm:px-4 py-2.5 font-semibold">Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-8 text-center text-xs text-slate-400">
                        No sessions found.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                      <tr key={s.session_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 sm:px-4 py-3">
                          <div className="font-mono text-xs text-slate-700">{s.session_id?.slice(0, 16)}...</div>
                          <div className="text-[10px] text-slate-400">{s.content_session_id || "-"}</div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-slate-600">
                          <div className="text-xs">{s.session_date || "-"}</div>
                          <div className="text-[10px] text-slate-400">{s.session_time || "-"}</div>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                            {s.gate_decision || "-"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${
                              Number(s.anomaly_flagged) === 1
                                ? "bg-red-50 text-red-700 border-red-100"
                                : "bg-slate-50 text-slate-500 border-slate-200"
                            }`}>
                              {Number(s.anomaly_flagged) === 1 ? "Anomaly" : "Normal"}
                            </span>
                            {Number(s.alert_triggered) === 1 && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                                Alert
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${
                              s.session_complete === 1
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-slate-50 text-slate-500 border-slate-200"
                            }`}>
                              {s.session_complete === 1 ? "Done" : "Open"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${
                            Number(s.synced) === 1
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-slate-50 text-slate-600 border border-slate-200"
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {Number(s.synced) === 1 ? "Synced" : "Pending"}
                          </span>
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
        /* Children Directory */
        <Card>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <SectionHeader icon={List} title="Children Directory" subtitle={`${children.length} enrolled`} />
            <Button variant="secondary" size="sm" onClick={fetchChildren}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>

          {childrenError && (
            <ErrorState
              message={childrenError}
              onRetry={fetchChildren}
              retryText="Retry"
              className="border-0 bg-red-50 p-3 mb-3"
            />
          )}

          <DataTable
            columns={[
              {
                key: "child_id",
                label: "Child ID",
                render: (val, row) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={val} size="sm" />
                    <span className="font-medium text-slate-900">{val}</span>
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
                render: (val) => (
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                    val === "active" ? "bg-red-50 text-red-700 border border-red-100" :
                    val === "resolved" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                    "bg-slate-50 text-slate-500 border border-slate-200"
                  }`}>
                    {val || "none"}
                  </span>
                ),
              },
              {
                key: "synced",
                label: "Sync",
                render: (val) => (
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${
                    Number(val) === 1
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      : "bg-slate-50 text-slate-600 border border-slate-200"
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {Number(val) === 1 ? "Synced" : "Pending"}
                  </span>
                ),
              },
            ]}
            data={children}
            loading={childrenLoading}
            searchPlaceholder="Search by child ID or res ID..."
            searchKeys={["child_id", "res_id"]}
            pageSize={10}
            emptyMessage="No children found"
            onRowClick={(row) => loadChild(row.child_id)}
            mobileCard={(row) => (
              <div className="flex items-center gap-3">
                <Avatar name={row.child_id} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{row.child_id}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                      row.alert_status === "active" ? "bg-red-50 text-red-700 border-red-100" :
                      "bg-slate-50 text-slate-500 border-slate-200"
                    }`}>
                      {row.alert_status || "none"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                    <span>Grade {row.grade}</span>
                    <span className="text-slate-300">·</span>
                    <span>{row.total_sessions ?? 0} sessions</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            )}
          />
        </Card>
      )}
    </div>
  );
}

export default ChildEducationScreen;
