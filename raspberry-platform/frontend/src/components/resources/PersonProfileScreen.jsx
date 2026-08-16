import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, User, Users, CalendarDays, BadgeCheck, Waves, AlertTriangle,
  ClipboardCheck, Utensils, Loader2, Edit2, Trash2, X, Save, QrCode,
} from "lucide-react";
import ConfirmDialog from "../ui/feedback/ConfirmDialog";
import LoadingState from "../ui/feedback/LoadingState";
import ErrorState from "../ui/feedback/ErrorState";
import { useToast } from "../ui/feedback/Toast";
import { API, inputClass as inputClassBase } from "../ui/config";
import { COLORS, SHADOW_CARD } from "../../lib/tokens";
import QrCardModal from "./QrCardModal";

const TYPE_LABELS = {
  refugee: "Refugee", asylum_seeker: "Asylum Seeker", idp: "IDP",
  returned_refugee: "Returned Refugee", returned_idp: "Returned IDP",
  stateless: "Stateless", ooc: "Others of Concern",
};

/* ------------------------------------------------------------------ */
/*  SEMANTIC COLOUR MAP                                                 */
/* ------------------------------------------------------------------ */

const TONE = {
  brand:   { color: COLORS.brand, bg: `${COLORS.brand}14`, border: `${COLORS.brand}33` },
  warning: { color: '#D97706',    bg: '#FFFBEB',           border: '#FDE68A' },
  danger:  { color: '#DC2626',    bg: '#FEF2F2',           border: '#FECACA' },
  info:    { color: '#0284C7',    bg: '#F0F9FF',           border: '#BAE6FD' },
  violet:  { color: '#7C3AED',    bg: '#F5F3FF',           border: '#DDD6FE' },
  neutral: { color: COLORS.body,  bg: '#F5F6F5',            border: COLORS.line },
};

/* ------------------------------------------------------------------ */
/*  LOCAL PRIMITIVES — mirror the FloodWatch / ReliefOps design system  */
/* ------------------------------------------------------------------ */

function Chip({ children, tone = "neutral" }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide border"
      style={{ color: t.color, backgroundColor: t.bg, borderColor: t.border }}
    >
      {children}
    </span>
  );
}

function IconTile({ icon: Icon, tone = "brand", size = "md" }) {
  const t = TONE[tone] || TONE.brand;
  const dims = size === "sm" ? "w-7 h-7" : "w-8 h-8 sm:w-9 sm:h-9";
  return (
    <div className={`${dims} rounded-full flex items-center justify-center shrink-0 border`} style={{ backgroundColor: t.bg, borderColor: t.border }}>
      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: t.color }} strokeWidth={1.7} />
    </div>
  );
}

function Avatar({ name, size = "md" }) {
  const dims = size === "sm" ? "w-8 h-8 text-[11px]" : "w-14 h-14 sm:w-16 sm:h-16 text-[18px]";
  const initials = (name || "").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className={`${dims} rounded-xl flex items-center justify-center shrink-0 font-serif font-medium`}
      style={{ backgroundColor: `${COLORS.brand}14`, color: COLORS.brand, border: `1px solid ${COLORS.brand}33` }}
    >
      {initials || <User className="w-1/2 h-1/2" />}
    </div>
  );
}

function Button({ variant = "primary", size = "md", loading, loadingText, children, className = "", ...props }) {
  const sizeCls = size === "sm" ? "text-[11.5px] py-1.5 px-3" : "text-[12.5px] py-2.5 px-4";
  const style =
    variant === "primary" ? { backgroundColor: COLORS.brand, color: "#fff" } :
    variant === "danger" ? { backgroundColor: TONE.danger.bg, color: TONE.danger.color, border: `1px solid ${TONE.danger.border}` } :
    { backgroundColor: "transparent", color: COLORS.body, border: `1px solid ${COLORS.line}` };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-opacity disabled:opacity-40 hover:opacity-90 ${sizeCls} ${className}`}
      style={style}
    >
      {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {loadingText || "Working…"}</> : children}
    </button>
  );
}

function InfoField({ label, icon: Icon, editing, value, children }) {
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: COLORS.line, backgroundColor: "#FAFAF9" }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: COLORS.muted }}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">{label}</span>
      </div>
      {editing ? children : <p className="text-[13.5px] font-semibold" style={{ color: COLORS.ink }}>{value}</p>}
    </div>
  );
}

function RecordRow({ icon: Icon, tone, title, meta, right }) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border" style={{ borderColor: COLORS.line, backgroundColor: "#FAFAF9" }}>
      <IconTile icon={Icon} tone={tone} />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] sm:text-[13px] font-semibold" style={{ color: COLORS.ink }}>{title}</p>
        <p className="text-[10.5px] sm:text-[11px] truncate" style={{ color: COLORS.muted }}>{meta}</p>
      </div>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                                */
/* ------------------------------------------------------------------ */

export default function PersonProfileScreen({ personId, onBack, onUpdated }) {
  const { addToast } = useToast();
  const [person, setPerson] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState(null);

  const fetchProfile = () => {
    setLoading(true);
    setFetchError("");
    Promise.all([
      fetch(`${API}/api/register/${personId}`).then((r) => {
        if (!r.ok) throw new Error("Failed to load profile");
        return r.json();
      }),
      fetch(`${API}/api/register/${personId}/checkins`).then((r) => {
        if (!r.ok) return { checkins: [] };
        return r.json();
      }),
    ])
      .then(([personData, checkinData]) => {
        setPerson(personData);
        setCheckins(checkinData.checkins || []);
        if (personData.wristband_barcode) {
          fetch(`${API}/api/wristband/${personData.wristband_barcode}/history`)
            .then((r) => r.json())
            .then((d) => setDistributions(d.distributions || []))
            .catch(() => setDistributions([]));
        }
      })
      .catch((err) => setFetchError(err.message || "Failed to load profile"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProfile(); }, [personId]);

  const startEdit = () => {
    setEditForm({
      full_name: person.full_name || "",
      age: person.age || "",
      gender: person.gender || "M",
      person_type: person.person_type || "refugee",
      family_size: person.family_size || 1,
      is_pregnant: person.is_pregnant || 0,
      has_chronic_illness: person.has_chronic_illness || 0,
      medical_notes: person.medical_notes || "",
    });
    setEditErrors({});
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setEditErrors({}); };

  const updateField = (field, value) => {
    setEditForm((f) => ({ ...f, [field]: value }));
    setEditErrors((e) => ({ ...e, [field]: undefined }));
  };

  const saveEdit = async () => {
    const e = {};
    if (!editForm.full_name.trim()) e.full_name = "Required";
    const age = Number(editForm.age);
    if (!editForm.age && editForm.age !== 0 || isNaN(age) || age < 0 || age > 130) e.age = "0–130";
    if (Number(editForm.family_size) < 1) e.family_size = "Min 1";
    if (Object.keys(e).length > 0) { setEditErrors(e); return; }

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/register/${personId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setEditErrors(data.fields);
        else addToast(data.error || "Save failed", "error");
        return;
      }
      setPerson(data);
      setEditing(false);
      addToast("Profile updated", "success");
      onUpdated?.();
    } catch (err) {
      addToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/register/${personId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast(data.error || "Delete failed", "error");
        return;
      }
      addToast("Person deactivated", "success");
      onBack();
      onUpdated?.();
    } catch { addToast("Delete failed", "error"); }
    setDeleting(false);
  };

  const openQr = async () => {
    setQrLoading(true);
    try {
      const res = await fetch(`${API}/api/register/${personId}/qrcode`);
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to load QR", "error");
        return;
      }
      setQrData(data);
    } catch (err) {
      addToast("Network error", "error");
    } finally {
      setQrLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 sm:h-64">
        <LoadingState size="sm" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="text-center py-8 sm:py-12 space-y-3">
        <ErrorState message={fetchError} onRetry={fetchProfile} retryText="Retry" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="text-center py-8 sm:py-12">
        <p className="text-[13px]" style={{ color: COLORS.muted }}>Person not found</p>
        <Button variant="secondary" onClick={onBack} className="mt-3">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
      </div>
    );
  }

  const tabs = [
    { key: "details", label: "Details" },
    { key: "checkins", label: `Check-ins (${checkins.length})` },
    { key: "distributions", label: `Dist. (${distributions.length})` },
  ];

  const GenderIcon = person.gender === "F" ? Users : User;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 border"
          style={{ borderColor: COLORS.line, color: COLORS.body }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13.5px] sm:text-[15px] font-semibold truncate" style={{ color: COLORS.ink }}>{person.full_name}</h2>
          <p className="text-[11px]" style={{ color: COLORS.muted }}>Profile &amp; history</p>
        </div>
        {!editing && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="secondary" size="sm" onClick={openQr} loading={qrLoading} loadingText="Loading…">
              <QrCode className="w-3.5 h-3.5" /> <span className="hidden sm:inline">QR</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={startEdit}>
              <Edit2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        {editing && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={cancelEdit}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors border"
              style={{ borderColor: COLORS.line, color: COLORS.muted }}
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity text-white disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: COLORS.brand }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* ── Avatar & Name ── */}
      <div className="flex items-start gap-3 sm:gap-4">
        <Avatar name={person?.full_name} />
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={editForm.full_name}
              onChange={(e) => updateField("full_name", e.target.value)}
              className={`${inputClassBase} font-semibold`}
              placeholder="Full name"
            />
          ) : (
            <h3 className="font-serif font-medium text-[18px] sm:text-[20px] tracking-tight" style={{ color: COLORS.ink }}>{person.full_name}</h3>
          )}
          {editErrors.full_name && <p className="text-[11px] mt-0.5" style={{ color: TONE.danger.color }}>{editErrors.full_name}</p>}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5">
            {person.pre_registered ? (
              <Chip tone="brand"><BadgeCheck className="w-3 h-3" /> Pre-registered</Chip>
            ) : (
              <Chip tone="info">New</Chip>
            )}
            {person.wristband_barcode && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md" style={{ color: COLORS.body, backgroundColor: "#F5F6F5" }}>
                {person.wristband_barcode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 rounded-lg p-1 border" style={{ backgroundColor: "#F5F6F5", borderColor: COLORS.line }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 text-[11px] sm:text-[12px] font-semibold py-1.5 sm:py-2 rounded-md transition-all"
            style={activeTab === tab.key
              ? { backgroundColor: "#fff", color: COLORS.brand, boxShadow: SHADOW_CARD }
              : { color: COLORS.muted }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {activeTab === "details" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <InfoField label="Age" icon={User} editing={editing} value={`${person.age} yrs`}>
              <input
                type="number" min={0} max={130}
                value={editForm.age}
                onChange={(e) => updateField("age", e.target.value)}
                className={inputClassBase}
              />
              {editErrors.age && <p className="text-[11px] mt-0.5" style={{ color: TONE.danger.color }}>{editErrors.age}</p>}
            </InfoField>

            <InfoField label="Gender" icon={GenderIcon} editing={editing}
              value={person.gender === "M" ? "Male" : person.gender === "F" ? "Female" : "Other"}>
              <select value={editForm.gender} onChange={(e) => updateField("gender", e.target.value)} className={inputClassBase}>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </InfoField>

            <InfoField label="Type" icon={BadgeCheck} editing={editing}
              value={TYPE_LABELS[person.person_type] || person.person_type}>
              <select value={editForm.person_type} onChange={(e) => updateField("person_type", e.target.value)} className={inputClassBase}>
                <option value="refugee">Refugee</option>
                <option value="asylum_seeker">Asylum Seeker</option>
                <option value="idp">IDP</option>
                <option value="returned_refugee">Returned Refugee</option>
                <option value="returned_idp">Returned IDP</option>
                <option value="stateless">Stateless</option>
                <option value="ooc">Others of Concern</option>
              </select>
            </InfoField>

            <InfoField label="Family" icon={Users} editing={editing} value={`${person.family_size} members`}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateField("family_size", Math.max(1, Number(editForm.family_size || 1) - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold transition-colors border"
                  style={{ backgroundColor: "#F5F6F5", borderColor: COLORS.line, color: COLORS.body }}
                >−</button>
                <span className="text-[13px] font-bold w-6 text-center tabular-nums font-mono" style={{ color: COLORS.ink }}>{editForm.family_size || 1}</span>
                <button
                  type="button"
                  onClick={() => updateField("family_size", Math.min(20, Number(editForm.family_size || 1) + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold transition-colors border"
                  style={{ backgroundColor: "#F5F6F5", borderColor: COLORS.line, color: COLORS.body }}
                >+</button>
              </div>
              {editErrors.family_size && <p className="text-[11px] mt-0.5" style={{ color: TONE.danger.color }}>{editErrors.family_size}</p>}
            </InfoField>
          </div>

          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button" onClick={() => updateField("is_pregnant", editForm.is_pregnant ? 0 : 1)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all"
                style={editForm.is_pregnant ? { backgroundColor: TONE.violet.bg, borderColor: TONE.violet.border, color: TONE.violet.color } : { backgroundColor: "#fff", borderColor: COLORS.line, color: COLORS.muted }}
              >
                <Waves className="w-3.5 h-3.5" /> Pregnant
              </button>
              <button
                type="button" onClick={() => updateField("has_chronic_illness", editForm.has_chronic_illness ? 0 : 1)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all"
                style={editForm.has_chronic_illness ? { backgroundColor: TONE.warning.bg, borderColor: TONE.warning.border, color: TONE.warning.color } : { backgroundColor: "#fff", borderColor: COLORS.line, color: COLORS.muted }}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Chronic Illness
              </button>
            </div>
          ) : (
            (person.is_pregnant > 0 || person.has_chronic_illness > 0) && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {person.is_pregnant > 0 && <Chip tone="violet"><Waves className="w-3.5 h-3.5" /> Pregnant</Chip>}
                {person.has_chronic_illness > 0 && <Chip tone="warning"><AlertTriangle className="w-3.5 h-3.5" /> Chronic Illness</Chip>}
              </div>
            )
          )}

          {editing ? (
            <div>
              <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider mb-1" style={{ color: COLORS.muted }}>Medical Notes</label>
              <textarea rows={2} value={editForm.medical_notes}
                onChange={(e) => updateField("medical_notes", e.target.value)}
                className={`${inputClassBase} resize-none`} placeholder="Optional" />
            </div>
          ) : person.medical_notes ? (
            <div className="text-[12.5px] rounded-lg px-3 py-2.5 border" style={{ color: COLORS.body, backgroundColor: TONE.warning.bg, borderColor: TONE.warning.border }}>
              <span className="font-semibold" style={{ color: TONE.warning.color }}>Notes: </span>{person.medical_notes}
            </div>
          ) : null}

          <div className="text-[11px] flex flex-wrap items-center gap-1 font-mono" style={{ color: COLORS.muted }}>
            <CalendarDays className="w-3 h-3" />
            <span>Registered: {person.created_at ? new Date(person.created_at).toLocaleDateString() : "—"}</span>
            {person.last_checkin && (
              <span className="hidden sm:inline"> · Last check-in: {new Date(person.last_checkin).toLocaleDateString()}</span>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Check-ins Tab ── */}
      {activeTab === "checkins" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {checkins.length === 0 ? (
            <p className="text-[13px] text-center py-8" style={{ color: COLORS.muted }}>No check-in records</p>
          ) : (
            <div className="space-y-2">
              {checkins.map((c) => (
                <RecordRow
                  key={c.id}
                  icon={ClipboardCheck}
                  tone="brand"
                  title={`Check-in #${c.id}`}
                  meta={`${c.checkin_time ? new Date(c.checkin_time).toLocaleString() : "—"}${c.wristband_barcode ? "  ·  " + c.wristband_barcode : ""}`}
                  right={c.is_new_arrival > 0 && <Chip tone="info">New</Chip>}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Distributions Tab ── */}
      {activeTab === "distributions" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {distributions.length === 0 ? (
            <p className="text-[13px] text-center py-8" style={{ color: COLORS.muted }}>No distribution records</p>
          ) : (
            <div className="space-y-2">
              {distributions.map((d) => (
                <RecordRow
                  key={d.id}
                  icon={Utensils}
                  tone="warning"
                  title={<span className="capitalize">{d.resource_type}</span>}
                  meta={d.distributed_at ? new Date(d.distributed_at).toLocaleString() : "—"}
                  right={d.quantity && <span className="text-[12px] font-semibold font-mono" style={{ color: COLORS.body }}>{d.quantity}</span>}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      <ConfirmDialog
        open={showDelete}
        title="Deactivate Person"
        message={`Deactivate "${person.full_name}"? This removes them from the active registry and deactivates their wristband.`}
        confirmLabel={deleting ? "Deactivating..." : "Deactivate"}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />

      <QrCardModal data={qrData} onClose={() => setQrData(null)} />
    </div>
  );
}