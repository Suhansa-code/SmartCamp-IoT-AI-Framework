import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Check,
  AlertCircle,
  PackagePlus,
  Printer,
  QrCode,
  UserPlus,
  UserCircle2,
  PackageX,
  Wrench,
  ArrowUpRight,
  Layers,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { COLORS, SHADOW_CARD, TONE } from "../../lib/tokens";
import { API } from "../ui/config";
import StatCard from "../ui/base/StatCard";

const STATUS = {
  success: { color: COLORS.brand, bg: COLORS.brandSoft, border: COLORS.brandMuted },
  error: { color: TONE.danger.color, bg: TONE.danger.bg, border: TONE.danger.border },
  pending: { color: TONE.warning.color, bg: TONE.warning.bg, border: TONE.warning.border },
  info: { color: TONE.info.color, bg: TONE.info.bg, border: TONE.info.border },
  neutral: { color: COLORS.body, bg: COLORS.grid, border: COLORS.line },
};

const STATUS_TONE = {
  AVAILABLE: "success",
  ASSIGNED: "info",
  LOST: "error",
  DAMAGED: "pending",
  INACTIVE: "neutral",
};

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "AVAILABLE", label: "Available" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "LOST", label: "Lost" },
  { value: "DAMAGED", label: "Damaged" },
];

/* ------------------------------------------------------------------ */
/*  SHARED PRIMITIVES                                                   */
/* ------------------------------------------------------------------ */

function IconTile({ icon: Icon, color }) {
  return (
    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.hairline }}>
      <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" style={{ color: color || COLORS.body }} strokeWidth={1.6} />
    </div>
  );
}

function Chip({ children, tone = "neutral" }) {
  const s = STATUS[tone];
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide border" style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}>
      {children}
    </span>
  );
}

function StatusChip({ status }) {
  const tone = STATUS_TONE[status] || "neutral";
  const Icon = status === "ASSIGNED" ? UserCircle2 : status === "LOST" ? PackageX : status === "DAMAGED" ? Wrench : status === "INACTIVE" ? ShieldOff : ShieldCheck;
  return (
    <Chip tone={tone}>
      <Icon className="w-3 h-3" /> {status || "UNKNOWN"}
    </Chip>
  );
}

function PrimaryButton({ children, loading, loadingText, className = "", ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold py-2.5 px-4 text-white transition-opacity disabled:opacity-40 hover:opacity-90 ${className}`}
      style={{ backgroundColor: COLORS.brand }}
    >
      {loading ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> {loadingText || "Working…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function GhostButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold py-2.5 px-4 border transition-colors hover:opacity-80 ${className}`}
      style={{ borderColor: COLORS.line, color: COLORS.brand, backgroundColor: "#fff" }}
    >
      {children}
    </button>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        className="relative bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"
        style={{ boxShadow: SHADOW_CARD }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>{title}</h3>
            {subtitle && <p className="text-[12px] mt-0.5" style={{ color: COLORS.muted }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border" style={{ borderColor: COLORS.line, color: COLORS.body }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  STAT CARD                                                           */
/* ------------------------------------------------------------------ */

// function StatCard({ label, value, icon: Icon, hint, accent }) {
//   return (
//     <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: COLORS.line }}>
//       <div className="flex items-center justify-between mb-3">
//         <span className="text-[10.5px] uppercase tracking-[0.08em] font-mono" style={{ color: COLORS.muted }}>
//           {label}
//         </span>
//         <div className="w-7 h-7 rounded-md border flex items-center justify-center" style={{ borderColor: COLORS.line }}>
//           <Icon className="w-3.5 h-3.5" style={{ color: accent || COLORS.brand }} strokeWidth={1.7} />
//         </div>
//       </div>
//       <p className="font-serif font-medium text-[24px] sm:text-[28px] leading-none tracking-tight" style={{ color: COLORS.ink }}>
//         {value}
//       </p>
//       {hint && <p className="text-[11px] font-mono mt-2" style={{ color: COLORS.muted }}>{hint}</p>}
//     </div>
//   );
// }

/* ------------------------------------------------------------------ */
/*  ASSIGN MODAL                                                        */
/* ------------------------------------------------------------------ */

function AssignModal({ wristband, onClose, onAssigned }) {
  const [persons, setPersons] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (query = "") => {
    try {
      const res = await fetch(`${API}/api/register?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setPersons((data.persons || data || []).filter((p) => p && p.id));
    } catch (e) {
      setError("Failed to load registered persons.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (person) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/wristbands/${wristband.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: person.id }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        setError(data.message || "Assignment failed.");
        return;
      }
      onAssigned(data.wristband || person);
      onClose();
    } catch (e) {
      setError("Assignment failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = persons.filter((p) => !q || (p.full_name || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal title="Assign wristband" subtitle={`${wristband.wristband_id || wristband.barcode} → registered person`} onClose={onClose}>
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="w-3.5 h-3.5" style={{ color: COLORS.muted }} />
        </div>
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); load(e.target.value); }}
          placeholder="Search persons…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-[13px] focus:outline-none"
          style={{ borderColor: COLORS.line, color: COLORS.ink }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border mb-3 text-[12.5px] font-medium" style={{ color: STATUS.error.color, backgroundColor: STATUS.error.bg, borderColor: STATUS.error.border }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => assign(p)}
            disabled={busy}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors disabled:opacity-50"
            style={{ borderColor: COLORS.line, backgroundColor: "#FAFAF9" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ backgroundColor: `${COLORS.brand}14`, color: COLORS.brand }}>
              {(p.full_name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: COLORS.ink }}>{p.full_name}</p>
              <p className="text-[11px] " style={{ color: COLORS.muted }}>#{p.id} · {p.person_type || "resident"}</p>
            </div>
            <UserPlus className="w-4 h-4 shrink-0" style={{ color: COLORS.brand }} strokeWidth={1.8} />
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-[12.5px] text-center py-6" style={{ color: COLORS.muted }}>No persons match.</p>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  QR MODAL                                                            */
/* ------------------------------------------------------------------ */

function QrModal({ wristband, onClose }) {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/wristbands/${wristband.id}/qrcode`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { if (d.success && d.data_url) setQr(d); else setError(d.message || "QR generation failed."); } })
      .catch(() => { if (!cancelled) setError("QR generation failed."); });
    return () => { cancelled = true; };
  }, [wristband.id]);

  return (
    <Modal title="Wristband QR" subtitle={qr ? `${qr.qr_identifier}` : (wristband.wristband_id || wristband.barcode)} onClose={onClose}>
      <div className="flex flex-col items-center">
        {qr ? (
          <img src={qr.data_url} alt="wristband-qr" className="w-56 h-56" />
        ) : error ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[12.5px] font-medium" style={{ color: STATUS.error.color, backgroundColor: STATUS.error.bg, borderColor: STATUS.error.border }}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        ) : (
          <div className="w-56 h-56 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: COLORS.muted }} />
          </div>
        )}
        {qr && (
          <div className="mt-4 w-full">
            <a
              href={qr.data_url}
              download={`qr-${wristband.wristband_id || wristband.barcode || "wristband"}.png`}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-semibold py-2.5"
              style={{ borderColor: COLORS.line, color: COLORS.brand }}
            >
              Download PNG
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  TABLE ROW                                                           */
/* ------------------------------------------------------------------ */

function WristbandRow({ wb, onShowQr, onAssign, onUnassign, onStatus, index }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (label, fn) => {
    setBusy(label);
    setError("");
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(""); }
  };

  const isUsable = wb.status === "AVAILABLE";

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="border-t align-middle"
      style={{ borderColor: COLORS.hairline }}
    >
      <td className="px-4 sm:px-5 py-3">
        <p className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>
          {wb.wristband_id}
        </p>
        <p className="text-[10.5px] " style={{ color: COLORS.muted }}>
          {wb.qr_identifier || "—"}
        </p>
      </td>
      <td className="px-4 sm:px-5 py-3">
        <StatusChip status={wb.status} />
      </td>
      <td className="px-4 sm:px-5 py-3">
        {wb.assigned_person ? (
          <p className="text-[12.5px] font-semibold flex items-center gap-1.5" style={{ color: COLORS.ink }}>
            <UserCircle2 className="w-3.5 h-3.5" style={{ color: COLORS.brand }} /> {wb.assigned_person}
          </p>
        ) : (
          <span className="text-[12.5px]" style={{ color: COLORS.muted }}>—</span>
        )}
        {wb.assigned_at && (
          <p className="text-[10.5px]  mt-0.5" style={{ color: COLORS.muted }}>
            {wb.assigned_at}
          </p>
        )}
      </td>
      <td className="px-4 sm:px-5 py-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onShowQr(wb)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-[11.5px] font-semibold transition-opacity hover:opacity-70"
            style={{ borderColor: COLORS.line, color: COLORS.body }}
          >
            <QrCode className="w-3 h-3" /> QR
          </button>
          {isUsable && (
            <button
              onClick={() => onAssign(wb)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-[11.5px] font-semibold transition-opacity hover:opacity-70"
              style={{ borderColor: `${COLORS.brand}33`, color: COLORS.brand, backgroundColor: `${COLORS.brand}0A` }}
            >
              <UserPlus className="w-3 h-3" /> Assign
            </button>
          )}
          {wb.status === "ASSIGNED" && (
            <button
              onClick={() => run("unassign", () => onUnassign(wb))}
              disabled={busy === "unassign"}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-[11.5px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ borderColor: COLORS.line, color: COLORS.body }}
            >
              {busy === "unassign" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowUpRight className="w-3 h-3" />} Unassign
            </button>
          )}
          {isUsable && (
            <>
              <button
                onClick={() => run("lost", () => onStatus(wb, "LOST"))}
                disabled={busy === "lost"}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-[11.5px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ borderColor: COLORS.line, color: STATUS.error.color }}
              >
                {busy === "lost" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <PackageX className="w-3 h-3" />} Lost
              </button>
              <button
                onClick={() => run("damaged", () => onStatus(wb, "DAMAGED"))}
                disabled={busy === "damaged"}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-[11.5px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ borderColor: COLORS.line, color: STATUS.pending.color }}
              >
                {busy === "damaged" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />} Damaged
              </button>
            </>
          )}
        </div>
        {error && (
          <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: STATUS.error.color }}>
            <AlertCircle className="w-3 h-3 shrink-0" /> {error}
          </p>
        )}
      </td>
    </motion.tr>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function WristbandsScreen() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [batchCount, setBatchCount] = useState(10);
  const [batchBusy, setBatchBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [qrTarget, setQrTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadList = useCallback(async (query = q, filter = status) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (filter) params.set("status", filter);
      const res = await fetch(`${API}/api/wristbands?${params.toString()}`);
      const data = await res.json();
      setRows(data.wristbands || []);
    } catch (e) {
      notify("Failed to load wristbands.", "error");
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    fetch(`${API}/api/wristbands/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadList(q, status), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, status, loadList]);

  const refreshAll = async () => {
    fetch(`${API}/api/wristbands/stats`).then((r) => r.json()).then(setStats).catch(() => {});
    await loadList(q, status);
  };

  const handleBatch = async () => {
    setBatchBusy(true);
    try {
      const res = await fetch(`${API}/api/wristbands/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: Number(batchCount) || 10 }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        notify(data.message || "Batch generation failed.", "error");
        return;
      }
      notify(`${data.count} wristband(s) printed (${data.total} total).`);
      await refreshAll();
    } catch (e) {
      notify("Batch generation failed: " + e.message, "error");
    } finally {
      setBatchBusy(false);
    }
  };

  const openPrintSheet = () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const url = `${API}/api/wristbands/export?${params.toString()}`;
    const w = window.open(url, "_blank", "noopener");
    if (w) w.focus();
  };

  const handleAssignDone = (wristband) => {
    notify(`Assigned to ${wristband?.assigned_person_name || "person"}.`);
    refreshAll();
  };

  const handleUnassign = async (wb) => {
    const res = await fetch(`${API}/api/wristbands/${wb.id}/unassign`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.message || "Unassign failed.");
    notify("Wristband released back to stock.");
    refreshAll();
  };

  const handleStatus = async (wb, next) => {
    const res = await fetch(`${API}/api/wristbands/${wb.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.message || "Update failed.");
    notify(`${wb.wristband_id} marked ${next}.`);
    refreshAll();
  };

  const assignmentPct = stats?.assignment_percentage ?? 0;

  return (
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>
      <div className="sm:px-5 lg:px-6">
        {/* ================= TITLE ROW ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:py-7">
          <div>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.muted }}>
              Camp operations
            </p>
            <h1 className="font-medium text-[26px] sm:text-[32px] lg:text-[36px] leading-[1.1] tracking-tight">
              Wristband Inventory
            </h1>
            <p className="text-[12px] mt-2" style={{ color: COLORS.muted }}>
              Pre-print, assign, and track QR wristbands across the camp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="500"
                value={batchCount}
                onChange={(e) => setBatchCount(e.target.value)}
                aria-label="Number of wristbands to generate"
                className="w-20 px-2.5 py-2.5 rounded-lg border text-[13px] focus:outline-none"
                style={{ borderColor: COLORS.line, color: COLORS.ink, backgroundColor: COLORS.grid }}
              />
              <PrimaryButton onClick={handleBatch} loading={batchBusy} loadingText="Printing">
                <PackagePlus className="w-3.5 h-3.5" /> Print batch
              </PrimaryButton>
            </div>
            <GhostButton onClick={openPrintSheet}>
              <Printer className="w-3.5 h-3.5" /> QR print sheet
            </GhostButton>
          </div>
        </div>

        {/* ================= STATS ================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <StatCard label="Total printed" value={stats?.total ?? "—"} icon={Layers} hint={`${assignmentPct}% in use`} />
          <StatCard label="Available (stock)" value={stats?.available ?? "—"} icon={ShieldCheck} hint="Usable unassigned bands" />
          <StatCard label="Assigned" value={stats?.assigned ?? "—"} icon={UserCircle2} hint={`${stats?.assigned ?? 0} people hold bands`} />
          <StatCard label="Lost / disabled" value={stats?.unavailable ?? "—"} icon={ShieldOff} accent={STATUS.error.color} hint="Lost · damaged · inactive" />
        </div>

        {/* ================= TOOLBAR ================= */}
        <div className="mt-4 sm:mt-6 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4" style={{ color: COLORS.muted }} />
            </div>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by band, QR, or person…"
              className="w-full pl-10 pr-11 py-2.5 rounded-lg border text-[13px] focus:outline-none transition-colors"
              style={{ borderColor: COLORS.line, color: COLORS.ink, backgroundColor: COLORS.grid }}
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search" className="absolute inset-y-0 right-3 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.hairline, color: COLORS.body }}>
                  <X className="w-3 h-3" />
                </div>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border p-1 flex items-center" style={{ borderColor: COLORS.line }}>
              <Layers className="w-3.5 h-3.5 mx-2" style={{ color: COLORS.muted }} />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter by status"
                className="py-2 pr-6 pl-1 rounded-lg text-[12.5px] font-semibold focus:outline-none bg-transparent"
                style={{ color: COLORS.ink }}
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => loadList(q, status)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold py-2.5 px-3.5 border transition-colors hover:opacity-80"
              style={{ borderColor: COLORS.line, color: COLORS.body }}
              aria-label="Refresh list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ================= TABLE ================= */}
        <div className="mt-4 sm:mt-5 rounded-xl border overflow-hidden" style={{ borderColor: COLORS.line }}>
          <div className="px-4 sm:px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: COLORS.hairline }}>
            <IconTile icon={QrCode} color={COLORS.brand} />
            <div>
              <h2 className="text-[13.5px] sm:text-[14px] font-semibold" style={{ color: COLORS.ink }}>
                Registered wristbands
              </h2>
              <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.muted }}>
                {rows.length} shown · filter and manage lifecycle
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-medium uppercase tracking-wider" style={{ color: COLORS.muted, backgroundColor: COLORS.grid }}>
                  <th className="px-4 sm:px-5 py-3">Wristband</th>
                  <th className="px-4 sm:px-5 py-3">Status</th>
                  <th className="px-4 sm:px-5 py-3">Assigned person</th>
                  <th className="px-4 sm:px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((wb, i) => (
                  <WristbandRow
                    key={wb.id}
                    wb={wb}
                    index={i}
                    onShowQr={setQrTarget}
                    onAssign={setAssignTarget}
                    onUnassign={handleUnassign}
                    onStatus={handleStatus}
                  />
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 sm:px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <PackagePlus className="w-6 h-6" style={{ color: COLORS.muted }} />
                        <p className="text-[13px] font-medium" style={{ color: COLORS.muted }}>
                          No wristbands match this view.
                        </p>
                        <p className="text-[11.5px]" style={{ color: COLORS.muted }}>
                          Print a batch above to add stock.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= FOOTER NOTE ================= */}
        <p className="text-[11px] mt-4 pb-6 flex items-center gap-1.5" style={{ color: COLORS.muted }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          QR payloads carry only the opaque band identifier — no personal data is embedded.
        </p>
      </div>

      {/* ================= MODALS ================= */}
      <AnimatePresence>
        {qrTarget && <QrModal wristband={qrTarget} onClose={() => setQrTarget(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {assignTarget && (
          <AssignModal
            wristband={assignTarget}
            onClose={() => setAssignTarget(null)}
            onAssigned={handleAssignDone}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[13px] font-medium"
            style={{
              color: STATUS[toast.type]?.color || COLORS.body,
              backgroundColor: STATUS[toast.type]?.bg || "#fff",
              borderColor: STATUS[toast.type]?.border || COLORS.line,
              boxShadow: SHADOW_CARD,
            }}
          >
            {toast.type === "error" ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
