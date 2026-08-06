import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, User, Users, CalendarDays, BadgeCheck, Waves, AlertTriangle,
  ClipboardCheck, Utensils, Loader2, Edit2, Trash2, X, Save, RefreshCw,
} from "lucide-react";
import Button from "../ui/base/Button";
import ConfirmDialog from "../ui/feedback/ConfirmDialog";
import LoadingState from "../ui/feedback/LoadingState";
import ErrorState from "../ui/feedback/ErrorState";
import { useToast } from "../ui/feedback/Toast";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TYPE_LABELS = {
  refugee: "Refugee", asylum_seeker: "Asylum Seeker", idp: "IDP",
  returned_refugee: "Returned Refugee", returned_idp: "Returned IDP",
  stateless: "Stateless", ooc: "Others of Concern",
};

const inputClass =
  "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 transition-all text-sm text-slate-800";

function InfoField({ label, icon: Icon, editing, value, children }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        {Icon && <Icon className="w-3 h-3" />}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      {editing ? children : <p className="text-sm font-semibold text-slate-800">{value || "—"}</p>}
    </div>
  );
}

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
        <p className="text-sm text-slate-500">Person not found</p>
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
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-slate-800 truncate">{person.full_name}</h2>
          <p className="text-[11px] text-slate-400">Profile &amp; history</p>
        </div>
        {!editing && (
          <div className="flex items-center gap-1.5 shrink-0">
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
            <button onClick={cancelEdit} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="w-8 h-8 rounded-lg bg-teal-600 hover:bg-teal-700 flex items-center justify-center transition-colors text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* ── Avatar & Name ── */}
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-base sm:text-lg font-bold shrink-0 shadow-md shadow-teal-500/25">
          {person.full_name?.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={editForm.full_name}
              onChange={(e) => updateField("full_name", e.target.value)}
              className={`${inputClass} font-semibold`}
              placeholder="Full name"
            />
          ) : (
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">{person.full_name}</h3>
          )}
          {editErrors.full_name && <p className="text-[11px] text-red-500 mt-0.5">{editErrors.full_name}</p>}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5">
            {person.pre_registered ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                <BadgeCheck className="w-3 h-3" /> Pre-registered
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                New
              </span>
            )}
            {person.wristband_barcode && (
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {person.wristband_barcode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 text-[11px] sm:text-xs font-medium py-1.5 sm:py-2 rounded-md transition-all ${
              activeTab === tab.key
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
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
                className={inputClass}
              />
              {editErrors.age && <p className="text-[11px] text-red-500 mt-0.5">{editErrors.age}</p>}
            </InfoField>

            <InfoField label="Gender" icon={GenderIcon} editing={editing}
              value={person.gender === "M" ? "Male" : person.gender === "F" ? "Female" : "Other"}>
              <select value={editForm.gender} onChange={(e) => updateField("gender", e.target.value)} className={inputClass}>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </InfoField>

            <InfoField label="Type" icon={BadgeCheck} editing={editing}
              value={TYPE_LABELS[person.person_type] || person.person_type}>
              <select value={editForm.person_type} onChange={(e) => updateField("person_type", e.target.value)} className={inputClass}>
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
                <button type="button" onClick={() => updateField("family_size", Math.max(1, Number(editForm.family_size || 1) - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-sm font-bold transition-colors">−</button>
                <span className="text-sm font-bold w-6 text-center tabular-nums">{editForm.family_size || 1}</span>
                <button type="button" onClick={() => updateField("family_size", Math.min(20, Number(editForm.family_size || 1) + 1))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-sm font-bold transition-colors">+</button>
              </div>
              {editErrors.family_size && <p className="text-[11px] text-red-500 mt-0.5">{editErrors.family_size}</p>}
            </InfoField>
          </div>

          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => updateField("is_pregnant", editForm.is_pregnant ? 0 : 1)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  editForm.is_pregnant ? "bg-violet-50 border-violet-200 text-violet-700" : "bg-white border-slate-200 text-slate-500"
                }`}>
                <Waves className="w-3.5 h-3.5" /> Pregnant
              </button>
              <button type="button" onClick={() => updateField("has_chronic_illness", editForm.has_chronic_illness ? 0 : 1)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  editForm.has_chronic_illness ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-slate-200 text-slate-500"
                }`}>
                <AlertTriangle className="w-3.5 h-3.5" /> Chronic Illness
              </button>
            </div>
          ) : (
            (person.is_pregnant > 0 || person.has_chronic_illness > 0) && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {person.is_pregnant > 0 && (
                  <span className="bg-violet-50 text-violet-700 text-xs font-medium px-2.5 py-1 rounded-md border border-violet-100 flex items-center gap-1.5">
                    <Waves className="w-3.5 h-3.5" /> Pregnant
                  </span>
                )}
                {person.has_chronic_illness > 0 && (
                  <span className="bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-md border border-amber-100 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Chronic Illness
                  </span>
                )}
              </div>
            )
          )}

          {editing ? (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Medical Notes</label>
              <textarea rows={2} value={editForm.medical_notes}
                onChange={(e) => updateField("medical_notes", e.target.value)}
                className={`${inputClass} resize-none`} placeholder="Optional" />
            </div>
          ) : person.medical_notes ? (
            <div className="text-xs text-slate-600 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2.5">
              <span className="font-semibold text-amber-700">Notes: </span>{person.medical_notes}
            </div>
          ) : null}

          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1">
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
            <p className="text-sm text-slate-400 text-center py-8">No check-in records</p>
          ) : (
            <div className="space-y-2">
              {checkins.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-teal-50 flex items-center justify-center border border-teal-100 shrink-0">
                    <ClipboardCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-800">Check-in #{c.id}</p>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      {c.checkin_time ? new Date(c.checkin_time).toLocaleString() : "—"}
                      {c.wristband_barcode && <span className="ml-1.5 font-mono">{c.wristband_barcode}</span>}
                    </p>
                  </div>
                  {c.is_new_arrival > 0 && (
                    <span className="text-[10px] font-medium text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 shrink-0">
                      New
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Distributions Tab ── */}
      {activeTab === "distributions" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {distributions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No distribution records</p>
          ) : (
            <div className="space-y-2">
              {distributions.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100 shrink-0">
                    <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-800 capitalize">{d.resource_type}</p>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      {d.distributed_at ? new Date(d.distributed_at).toLocaleString() : "—"}
                    </p>
                  </div>
                  {d.quantity && <span className="text-xs font-medium text-slate-600 shrink-0">{d.quantity}</span>}
                </div>
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
    </div>
  );
}
