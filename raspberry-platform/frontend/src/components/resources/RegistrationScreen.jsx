import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  CheckCircle,
  UserPlus,
  ScanLine,
  Activity,
  ArrowRight,
  ShieldCheck,
  User,
  Users,
  CalendarDays,
  Waves,
  Loader2,
  Check,
  AlertTriangle,
  BadgeCheck,
  Search,
  UserCheck,
  Link2,
  List,
  RefreshCw,
} from "lucide-react";
import Button from "../ui/base/Button";
import DataTable from "../ui/display/DataTable";
import ConfirmDialog from "../ui/feedback/ConfirmDialog";
import LoadingState from "../ui/feedback/LoadingState";
import ErrorState from "../ui/feedback/ErrorState";
import PersonProfileScreen from "./PersonProfileScreen";
import { useToast } from "../ui/feedback/Toast";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const STEPS = [
  { key: "scan", label: "Scan", icon: Fingerprint },
  { key: "identity", label: "Identity", icon: ShieldCheck },
  { key: "complete", label: "Wristband", icon: CheckCircle },
];

function stateStep(scanState) {
  if (scanState === "idle" || scanState === "scanning") return 0;
  if (scanState === "found" || scanState === "not_found") return 1;
  if (scanState === "success") return 2;
  return 0;
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-0">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`relative flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-300 ${
                  done
                    ? "border-teal-600 bg-teal-600 text-white"
                    : active
                      ? "border-teal-600 bg-teal-50 text-teal-600 shadow-[0_0_0_5px_rgba(13,148,136,0.12)]"
                      : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {done ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className={`mt-1.5 text-[10px] sm:text-xs font-semibold tracking-wide ${
                  active || done ? "text-teal-700" : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 sm:w-16 mx-1 sm:mx-2 mb-5 rounded-full transition-colors duration-500 ${
                  i < current ? "bg-teal-500" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScanningVisual({ scanState, onScan }) {
  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative mb-8">
        <motion.div
          animate={{
            scale: scanState === "scanning" ? [1, 1.07, 1] : 1,
          }}
          transition={{ duration: 2, repeat: scanState === "scanning" ? Infinity : 0 }}
          className={`w-48 h-48 sm:w-52 sm:h-52 rounded-full border-2 flex items-center justify-center relative overflow-hidden transition-colors duration-500 ${
            scanState === "scanning"
              ? "border-teal-300 bg-teal-50"
              : scanState === "found"
                ? "border-emerald-400 bg-emerald-50"
                : scanState === "not_found"
                  ? "border-amber-300 bg-amber-50"
                  : scanState === "success"
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
          }`}
        >
          <Fingerprint
            className={`w-16 h-16 sm:w-20 sm:h-20 transition-colors duration-500 ${
              scanState === "scanning"
                ? "text-teal-600"
                : scanState === "found"
                  ? "text-emerald-600"
                  : scanState === "not_found"
                    ? "text-amber-500"
                    : scanState === "success"
                      ? "text-emerald-600"
                      : "text-slate-300"
            }`}
          />

          <AnimatePresence>
            {scanState === "scanning" && (
              <motion.div
                initial={{ top: "-10%" }}
                animate={{ top: "110%" }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-0.5 bg-teal-500 shadow-[0_0_12px_rgba(13,148,136,0.6)] z-20"
              />
            )}
          </AnimatePresence>
        </motion.div>

        {scanState === "scanning" && (
          <>
            <motion.div
              animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 rounded-full border border-teal-300 pointer-events-none"
            />
            <motion.div
              animate={{ scale: [1, 1.8], opacity: [0.2, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
              className="absolute inset-0 rounded-full border border-teal-200 pointer-events-none"
            />
          </>
        )}
      </div>

      <div className="text-center w-full">
        <h3
          className={`text-base font-semibold mb-1 transition-colors duration-300 ${
            scanState === "found"
              ? "text-emerald-700"
              : scanState === "not_found"
                ? "text-amber-600"
                : scanState === "success"
                  ? "text-emerald-700"
                  : "text-slate-700"
          }`}
        >
          {scanState === "idle" && "Ready to Scan"}
          {scanState === "scanning" && "Analyzing Biometrics"}
          {scanState === "found" && "Match Confirmed"}
          {scanState === "not_found" && "No Record Found"}
          {scanState === "success" && "Process Complete"}
        </h3>

        <p className="text-sm text-slate-400 min-h-5">
          {scanState === "idle" && "Place finger on the biometric pad to begin"}
          {scanState === "scanning" && "Reading fingerprint pattern…"}
          {scanState === "found" && "Identity verified against records"}
          {scanState === "not_found" && "Create a new profile to enroll"}
          {scanState === "success" && "Wristband issued successfully"}
        </p>
      </div>
    </div>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-teal-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 transition-all text-sm text-slate-800 placeholder-slate-400";

function NewPersonForm({ form, setForm, onSubmit, onCancel, submitting, error }) {
  const [errors, setErrors] = useState({});

  const update = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required";
    if (!form.age || Number(form.age) < 0 || Number(form.age) > 130)
      e.age = "Enter a valid age (0–130)";
    if (!form.family_size || Number(form.family_size) < 1)
      e.family_size = "Family size must be at least 1";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSubmit();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
          <UserPlus className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">New Registration</h2>
          <p className="text-xs text-slate-500">No fingerprint match — enroll this person</p>
        </div>
      </div>

      {error && (
        <ErrorState message={error} className="border-0 bg-red-50 p-3" />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Full Name" required>
            <input
              placeholder="e.g. John Doe"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              className={inputClass}
            />
            {errors.full_name && (
              <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {errors.full_name}
              </p>
            )}
          </Field>
        </div>

        <Field label="Age" required>
          <input
            type="number"
            min={0}
            max={130}
            placeholder="Years"
            value={form.age}
            onChange={(e) => update("age", e.target.value)}
            className={inputClass}
          />
          {errors.age && (
            <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errors.age}
            </p>
          )}
        </Field>

        <Field label="Gender" required>
          <select
            value={form.gender}
            onChange={(e) => update("gender", e.target.value)}
            className={inputClass}
          >
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="O">Other</option>
          </select>
        </Field>

        <div className="col-span-2">
          <Field label="Person Type" required>
            <select
              value={form.person_type}
              onChange={(e) => update("person_type", e.target.value)}
              className={inputClass}
            >
              <option value="refugee">Refugee</option>
              <option value="asylum_seeker">Asylum Seeker</option>
              <option value="idp">IDP (Internally Displaced)</option>
              <option value="returned_refugee">Returned Refugee</option>
              <option value="returned_idp">Returned IDP</option>
              <option value="stateless">Stateless Person</option>
              <option value="ooc">Others of Concern</option>
            </select>
          </Field>
        </div>

        <div className="col-span-2">
          <Field label="Family Size" required>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => update("family_size", Math.max(1, Number(form.family_size || 1) - 1))}
                className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors flex items-center justify-center"
                aria-label="Decrease family size"
              >
                −
              </button>
              <span className="text-lg font-bold text-slate-800 w-8 text-center tabular-nums">
                {form.family_size || 1}
              </span>
              <button
                type="button"
                onClick={() => update("family_size", Math.min(20, Number(form.family_size || 1) + 1))}
                className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors flex items-center justify-center"
                aria-label="Increase family size"
              >
                +
              </button>
            </div>
            {errors.family_size && (
              <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {errors.family_size}
              </p>
            )}
          </Field>
        </div>

        <div className="col-span-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => update("is_pregnant", form.is_pregnant ? 0 : 1)}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${
              form.is_pregnant
                ? "bg-violet-50 border-violet-200 text-violet-700"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Waves className="w-4 h-4" />
            Pregnant
          </button>
          <button
            type="button"
            onClick={() => update("has_chronic_illness", form.has_chronic_illness ? 0 : 1)}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${
              form.has_chronic_illness
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Chronic Illness
          </button>
        </div>

        <div className="col-span-2">
          <Field label="Medical Notes" hint="Optional — e.g. pregnancy stage, medication, allergies">
            <textarea
              rows={2}
              placeholder="e.g. Diabetes type 2, on insulin"
              value={form.medical_notes}
              onChange={(e) => update("medical_notes", e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-3 pt-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="button"
          loading={submitting}
          loadingText="Enrolling…"
          onClick={handleSubmit}
          className="flex-[2]"
        >
          Enroll &amp; Issue Wristband
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function Barcode({ value }) {
  const bars = Array.from({ length: 36 }, (_, i) => {
    const c = value.charCodeAt(i % value.length);
    return { w: 1 + (c % 3), gap: 1 + ((c >> 3) % 2) };
  });
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 inline-flex flex-col items-center">
      <div className="flex items-end" style={{ height: 44 }}>
        {bars.map((b, i) => (
          <div
            key={i}
            style={{ width: b.w, marginRight: b.gap }}
            className="bg-slate-900 h-full"
          />
        ))}
      </div>
      <div className="mt-2 text-xs font-mono font-bold text-slate-700 tracking-widest">
        {value}
      </div>
    </div>
  );
}

function NoMatchDecision({ onNew, onReturning }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full space-y-6">
      <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-amber-500" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-700">No Fingerprint Match</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          This fingerprint was not found in the camp database.
        </p>
      </div>

      <div className="w-full grid gap-3">
        <button
          onClick={onNew}
          className="w-full px-6 py-4 bg-teal-600 text-white text-sm font-semibold rounded-xl transition-all hover:bg-teal-700 active:scale-[0.98] shadow-md shadow-teal-600/20 text-left flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <div>New to the camp</div>
            <div className="text-xs font-normal text-teal-100">
              Register as a brand-new person and enroll
            </div>
          </div>
          <ArrowRight className="w-4 h-4 ml-auto" />
        </button>

        <button
          onClick={onReturning}
          className="w-full px-6 py-4 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all hover:bg-slate-50 active:scale-[0.98] text-left flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <div>Returning member</div>
            <div className="text-xs font-normal text-slate-400">
              Fingerprint failed — search existing records
            </div>
          </div>
          <ArrowRight className="w-4 h-4 ml-auto text-slate-300" />
        </button>
      </div>
    </div>
  );
}

function ReturningSearch({ query, setQuery, results, onSearch, onSelect, searching, error, onBack, selected }) {
  return (
    <div className="flex flex-col h-full space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
          <UserCheck className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-800">Returning Member</h2>
          <p className="text-xs text-slate-500 truncate">
            Search by name, fingerprint ID, or wristband
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
        >
          Back
        </button>
      </div>

      <form onSubmit={onSearch} className="space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            <Search className={`w-4 h-4 ${searching ? "text-teal-500 animate-pulse" : "text-slate-400"}`} />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Kasun Perera, FP_0001, WB000001"
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 transition-all text-sm text-slate-800 placeholder-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">×</span>
            </button>
          )}
        </div>

        <Button
          type="submit"
          loading={searching}
          loadingText="Searching…"
          disabled={!query.trim()}
          className="w-full"
        >
          <Search className="w-4 h-4" />
          Search Records
        </Button>
      </form>

      {error && (
        <ErrorState message={error} className="border-0 bg-red-50 p-3" />
      )}

      <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px]">
        {!searching && results.length === 0 && !error && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">
              {selected ? "No results — adjust your search" : "Search to find an existing record"}
            </p>
          </div>
        )}
        {results.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-teal-200 hover:bg-teal-50/50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {p.full_name.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">{p.full_name}</div>
              <div className="text-[11px] text-slate-400">
                {p.age}y · {p.gender} · {p.wristband_barcode || "no wristband"}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

function RegistrationScreen() {
  const { addToast } = useToast();
  const [scanState, setScanState] = useState("idle");
  const [notFoundView, setNotFoundView] = useState("decision");
  const [profile, setProfile] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [qosInfo, setQosInfo] = useState(null);
  const [wristband, setWristband] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [regError, setRegError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [returningPerson, setReturningPerson] = useState(null);

  const [newPersonForm, setNewPersonForm] = useState({
    full_name: "",
    age: "",
    gender: "M",
    person_type: "refugee",
    family_size: 1,
    is_pregnant: 0,
    has_chronic_illness: 0,
    medical_notes: "",
  });

  const [persons, setPersons] = useState([]);
  const [personsLoading, setPersonsLoading] = useState(true);
  const [personsError, setPersonsError] = useState("");
  const [viewingPersonId, setViewingPersonId] = useState(null);
  const [showReenrollConfirm, setShowReenrollConfirm] = useState(false);
  const abortRef = useRef(null);

  const fetchPersons = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPersonsLoading(true);
    setPersonsError("");
    fetch(`${API}/api/register`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setPersons(data.persons || []);
        setPersonsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setPersonsError(err.message || "Failed to load registrations");
          setPersonsLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    fetchPersons();
  }, [fetchPersons]);

  const handleScanFingerprint = async () => {
    setScanState("scanning");
    setStatusMessage("Initializing biometric scan...");

    try {
      const res = await fetch(`${API}/api/fingerprint/scan`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Scanner service unavailable");
      const data = await res.json();

      setTimeout(() => {
        if (data.matched) {
          setProfile(data.person);
          setScanState("found");
          setStatusMessage(`Identity verified: ${data.person.full_name}`);
        } else {
          setProfile(null);
          setNotFoundView("decision");
          setScanState("not_found");
          setStatusMessage("No profile found. How would you like to continue?");
        }
      }, 1500);
    } catch (err) {
      setScanState("idle");
      setStatusMessage("Scanner offline or error");
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(`${API}/api/fingerprint/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (data.error) {
        setSearchError(data.error);
        setSearchResults([]);
      } else {
        setSearchResults(data.results || []);
      }
    } catch (err) {
      setSearchError("Search failed: " + err.message);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectReturning = (person) => {
    setReturningPerson(person);
    setProfile(person);
    setSearchResults([]);
    setNotFoundView("returning_profile");
    setStatusMessage(`Found: ${person.full_name}`);
  };

  const handleReenroll = async () => {
    if (!returningPerson) return;
    setSubmitting(true);
    setStatusMessage("Re-enrolling fingerprint…");
    try {
      const linkRes = await fetch(`${API}/api/fingerprint/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: returningPerson.id }),
      });
      const linkData = await linkRes.json();
      if (linkData.error) throw new Error(linkData.error);

      setProfile(linkData.person);
      setReturningPerson(null);
      setNotFoundView("decision");
      setStatusMessage(`Fingerprint re-enrolled: ${linkData.person.full_name}`);
      setScanState("found");
    } catch (err) {
      setStatusMessage("Re-enroll failed: " + err.message);
      addToast("Re-enroll failed: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckin = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: profile.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Check-in failed");
      }
      const data = await res.json();
      setQosInfo(data.mqtt);
      setWristband(data.wristband_barcode || "");
      setStatusMessage(`Wristband assigned: ${data.wristband_barcode}`);
      setScanState("success");
      addToast("Check-in successful", "success");
      fetchPersons();
    } catch (err) {
      setStatusMessage("Check-in failed: " + err.message);
      setScanState("found");
      addToast("Check-in failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterNew = async () => {
    setSubmitting(true);
    setRegError("");
    try {
      const res = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPersonForm),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Registration failed";
        if (data.fields) {
          const fieldErrors = Object.values(data.fields).join(". ");
          setRegError(fieldErrors);
        } else {
          setRegError(msg);
        }
        addToast(msg, "error");
        return;
      }
      setProfile(data.person);
      setQosInfo(data.mqtt);
      setWristband(data.wristband_barcode || "");
      setStatusMessage(`Wristband assigned: ${data.wristband_barcode}`);
      setScanState("success");
      addToast(`${data.person.full_name} registered successfully`, "success");
      fetchPersons();
    } catch (err) {
      const msg = "Registration failed: " + err.message;
      setRegError(msg);
      addToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setScanState("idle");
    setNotFoundView("decision");
    setProfile(null);
    setStatusMessage("");
    setQosInfo(null);
    setWristband("");
    setSubmitting(false);
    setRegError("");
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setReturningPerson(null);
  };

  const currentStep = stateStep(scanState);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-[calc(100svh-3.5rem)]  text-slate-800 font-sans relative">

      <div className="max-w-7xl mx-auto sm:px-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-500/25">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight">
                Camp Registration Hub
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Biometric check-in and secure enrollment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-5 text-xs text-slate-500 bg-white/80 border border-slate-200/80 rounded-full px-3.5 py-1.5 w-fit shadow-sm">
            <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
            <span className="font-medium">{today}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <StepIndicator current={currentStep} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 sm:gap-5 lg:gap-6 ">

          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-5 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[320px] lg:min-h-[420px]"
          >
            <ScanningVisual scanState={scanState} />

            {scanState === "idle" && (
              <Button
                onClick={handleScanFingerprint}
                size="lg"
                className="mt-7 w-full"
              >
                <Fingerprint className="w-4 h-4" />
                Initiate Scan
              </Button>
            )}
            {scanState === "idle" && import.meta.env.DEV && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setScanState("not_found");
                  setNotFoundView("new");
                  setStatusMessage("");
                }}
                className="mt-3 w-full text-slate-500"
              >
                <UserPlus className="w-4 h-4" />
                Test Registration
              </Button>
            )}
            {scanState !== "idle" && (
              <Button
                variant="secondary"
                size="lg"
                onClick={reset}
                className="mt-7 w-full text-slate-500"
              >
                Reset
              </Button>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-5 sm:p-6 lg:p-8 min-h-[280px] lg:min-h-[420px] flex flex-col justify-center"
          >
            <AnimatePresence mode="wait">
              {(scanState === "idle" || scanState === "scanning") && (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center text-center h-full space-y-5"
                >
                  <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                    <ShieldCheck className="w-8 h-8 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-500">Awaiting Input</h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-xs">
                      Scan a fingerprint to pull up a profile or create a new registration.
                    </p>
                  </div>
                  {scanState === "scanning" && (
                    <div className="flex items-center gap-2 text-xs font-medium text-teal-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Contacting biometric scanner…
                    </div>
                  )}
                  {scanState === "idle" && statusMessage && (
                    <div className="flex items-center gap-2 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 w-full justify-center">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {statusMessage}
                    </div>
                  )}
                </motion.div>
              )}

              {scanState === "found" && profile && (
                <motion.div
                  key="found"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  className="space-y-6"
                >
                  <div className="flex items-start gap-5">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-md shadow-teal-500/25">
                      {profile.full_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
                        {profile.full_name}
                      </h2>
                      <div className="flex items-center gap-1.5 mt-1.5 text-emerald-700 text-xs font-medium bg-emerald-50 w-fit px-2.5 py-1 rounded-md border border-emerald-100">
                        <CheckCircle className="w-3.5 h-3.5" /> Identity Verified
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg px-4 py-3.5 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Age & Gender</span>
                      </div>
                      <p className="text-base font-semibold text-slate-800">
                        {profile.age} yrs · {profile.gender}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-4 py-3.5 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                        <Users className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Family</span>
                      </div>
                      <p className="text-base font-semibold text-slate-800">
                        {profile.family_size} Members
                      </p>
                    </div>
                    {profile.person_type && (
                      <div className="col-span-2 bg-slate-50 rounded-lg px-4 py-3.5 border border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <BadgeCheck className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">Person Type</span>
                        </div>
                        <p className="text-base font-semibold text-slate-800 capitalize">
                          {profile.person_type.replace(/_/g, " ")}
                        </p>
                      </div>
                    )}
                  </div>

                  {(profile.is_pregnant || profile.has_chronic_illness) && (
                    <div className="flex flex-wrap gap-2">
                      {profile.is_pregnant && (
                        <span className="bg-violet-50 text-violet-700 text-xs font-medium px-3 py-1.5 rounded-md border border-violet-100 flex items-center gap-1.5">
                          <Waves className="w-3.5 h-3.5" /> Pregnant
                        </span>
                      )}
                      {profile.has_chronic_illness && (
                        <span className="bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-md border border-amber-100 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Chronic Illness
                        </span>
                      )}
                    </div>
                  )}

                  {profile.medical_notes && (
                    <div className="text-xs text-slate-500 bg-amber-50/60 border border-amber-100 rounded-lg px-4 py-3">
                      <span className="font-semibold text-amber-700">Notes: </span>
                      {profile.medical_notes}
                    </div>
                  )}

                  <Button
                    onClick={handleCheckin}
                    loading={submitting}
                    loadingText="Processing…"
                    className="w-full"
                  >
                    Confirm Check-in &amp; Assign Wristband
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              )}

              {scanState === "not_found" && (
                <motion.div
                  key="not_found"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  {notFoundView === "decision" && (
                    <NoMatchDecision
                      onNew={() => setNotFoundView("new")}
                      onReturning={() => setNotFoundView("returning")}
                    />
                  )}

                  {notFoundView === "new" && (
                    <NewPersonForm
                      form={newPersonForm}
                      setForm={setNewPersonForm}
                      onSubmit={handleRegisterNew}
                      onCancel={() => { setNotFoundView("decision"); setRegError(""); }}
                      submitting={submitting}
                      error={regError}
                    />
                  )}

                  {notFoundView === "returning" && (
                    <ReturningSearch
                      query={searchQuery}
                      setQuery={setSearchQuery}
                      results={searchResults}
                      onSearch={handleSearch}
                      onSelect={handleSelectReturning}
                      searching={searching}
                      error={searchError}
                      onBack={() => setNotFoundView("decision")}
                      selected={returningPerson}
                    />
                  )}

                  {notFoundView === "returning_profile" && profile && (
                    <div className="space-y-6">
                      <div className="flex items-start gap-5">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-md shadow-teal-500/25">
                          {profile.full_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
                            {profile.full_name}
                          </h2>
                          <div className="flex items-center gap-1.5 mt-1.5 text-amber-700 text-xs font-medium bg-amber-50 w-fit px-2.5 py-1 rounded-md border border-amber-100">
                            <UserCheck className="w-3.5 h-3.5" /> Returning Member Found
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5">
                            Fingerprint failed — re-enroll to bind this person to a new fingerprint
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-lg px-4 py-3.5 border border-slate-100">
                          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                            <User className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider">Age & Gender</span>
                          </div>
                          <p className="text-base font-semibold text-slate-800">
                            {profile.age} yrs · {profile.gender}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-lg px-4 py-3.5 border border-slate-100">
                          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                            <Users className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider">Family</span>
                          </div>
                          <p className="text-base font-semibold text-slate-800">
                            {profile.family_size} Members
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => setShowReenrollConfirm(true)}
                        loading={submitting}
                        loadingText="Re-enrolling fingerprint…"
                        className="w-full"
                      >
                        <Link2 className="w-4 h-4" />
                        Re-enroll Fingerprint
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => { setReturningPerson(null); setNotFoundView("returning"); }}
                        className="w-full text-slate-500"
                      >
                        Not this person — search again
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {scanState === "success" && (
                <motion.div
                  key="success"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="flex flex-col items-center text-center space-y-5"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center"
                  >
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </motion.div>

                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">Ready to Go</h2>
                    <p className="text-sm text-emerald-700 mt-2 bg-emerald-50 px-5 py-2 rounded-lg border border-emerald-100 font-medium">
                      {statusMessage}
                    </p>
                  </div>

                  {wristband && <Barcode value={wristband} />}

                  {profile && (
                    <p className="text-xs text-slate-500">
                      Registered: <span className="font-semibold text-slate-700">{profile.full_name}</span>
                    </p>
                  )}

                  {qosInfo && (
                    <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      Syncing to cloud (QoS {qosInfo.final_qos})
                    </div>
                  )}

                  <Button onClick={reset}>
                    Process Next Person
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/90 backdrop-blur-xl border mt-4 border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-4 sm:p-5 lg:p-6"
        >
          {viewingPersonId ? (
            <PersonProfileScreen
              personId={viewingPersonId}
              onBack={() => { setViewingPersonId(null); fetchPersons(); }}
              onUpdated={() => fetchPersons()}
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                    <List className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-semibold text-slate-800">Registered Users</h2>
                    <p className="text-[10px] sm:text-[11px] text-slate-400">{persons.length} total in camp</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={fetchPersons}>
                  <span className="hidden sm:inline">Refresh</span>
                  <span className="sm:hidden text-[11px]">↻</span>
                </Button>
              </div>

              {personsError && (
                <div className="flex items-center gap-2 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 mb-3">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1">{personsError}</span>
                  <Button variant="secondary" size="sm" onClick={fetchPersons}>
                    <RefreshCw className="w-3 h-3" /> Retry
                  </Button>
                </div>
              )}

              <DataTable
                columns={[
                  {
                    key: "full_name",
                    label: "Name",
                    render: (val, row) => (
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {val?.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{val}</span>
                      </div>
                    ),
                  },
                  { key: "age", label: "Age" },
                  {
                    key: "gender",
                    label: "Gender",
                    render: (val) => (val === "M" ? "Male" : val === "F" ? "Female" : "Other"),
                  },
                  {
                    key: "person_type",
                    label: "Type",
                    render: (val) => (
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 capitalize">
                        {val?.replace(/_/g, " ") || "—"}
                      </span>
                    ),
                  },
                  { key: "family_size", label: "Family" },
                  {
                    key: "wristband_barcode",
                    label: "Wristband",
                    render: (val) => (
                      <span className="font-mono text-xs">{val || "—"}</span>
                    ),
                  },
                  {
                    key: "pre_registered",
                    label: "Status",
                    render: (val) => (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                          val
                            ? "bg-teal-100 text-teal-700"
                            : "bg-sky-50 text-sky-600 border border-sky-100"
                        }`}
                      >
                        {val ? "Pre-registered" : "New"}
                      </span>
                    ),
                  },
                  {
                    key: "created_at",
                    label: "Registered",
                    render: (val) =>
                      val ? new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—",
                  },
                ]}
                data={persons}
                loading={personsLoading}
                searchPlaceholder="Search by name or fingerprint ID..."
                searchKeys={["full_name", "fingerprint_id"]}
                filters={[
                  {
                    key: "person_type",
                    label: "All Types",
                    options: [
                      { value: "refugee", label: "Refugee" },
                      { value: "asylum_seeker", label: "Asylum Seeker" },
                      { value: "idp", label: "IDP" },
                      { value: "returned_refugee", label: "Returned Refugee" },
                      { value: "returned_idp", label: "Returned IDP" },
                      { value: "stateless", label: "Stateless" },
                      { value: "ooc", label: "Others of Concern" },
                    ],
                  },
                ]}
                pageSize={8}
                emptyMessage="No registered users yet"
                onRowClick={(row) => setViewingPersonId(row.id)}
                mobileCard={(row) => (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {row.full_name?.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{row.full_name}</span>
                        {row.pre_registered ? (
                          <span className="text-[10px] font-medium text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 shrink-0">Pre</span>
                        ) : (
                          <span className="text-[10px] font-medium text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 shrink-0">New</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span>{row.age}y · {row.gender === "M" ? "M" : row.gender === "F" ? "F" : "O"}</span>
                        <span className="text-slate-300">·</span>
                        <span className="capitalize">{row.person_type?.replace(/_/g, " ")}</span>
                        <span className="text-slate-300">·</span>
                        <span>Fam: {row.family_size}</span>
                      </div>
                      {row.wristband_barcode && (
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{row.wristband_barcode}</div>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </div>
                )}
              />
            </>
          )}
        </motion.div>

        <ConfirmDialog
          isOpen={showReenrollConfirm}
          onClose={() => setShowReenrollConfirm(false)}
          onConfirm={() => { setShowReenrollConfirm(false); handleReenroll(); }}
          title="Re-enroll Fingerprint?"
          message="This will overwrite the existing fingerprint link for this person."
          confirmText="Re-enroll"
          variant="warning"
        />
      </div>
    </div>
  );
}

export default RegistrationScreen;
