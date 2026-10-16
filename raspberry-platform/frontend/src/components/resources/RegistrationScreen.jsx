import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  CheckCircle,
  UserPlus,
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
  X,
  QrCode,
  Camera,
  GraduationCap,
  Usb,
  Wifi,
  WifiOff,
} from "lucide-react";
import DataTable from "../ui/display/DataTable";
import ConfirmDialog from "../ui/feedback/ConfirmDialog";
import ErrorState from "../ui/feedback/ErrorState";
import PersonProfileScreen from "./PersonProfileScreen";
import QrCardModal from "./QrCardModal";
import QRScanner from "./QRScanner";
import { useToast } from "../ui/feedback/Toast";
import { API, inputClass as inputClassBase } from "../ui/config";
import { COLORS, TONE, SHADOW_CARD } from "../../lib/tokens";
import useFingerprintDevice, { ENROLL_STEP_LABEL } from "../../lib/useFingerprintDevice";

const STEPS = [
  { key: "scan", label: "Scan", icon: Fingerprint },
  { key: "identity", label: "Identity", icon: ShieldCheck },
  { key: "enroll", label: "Fingerprint", icon: Link2 },
  { key: "complete", label: "Wristband", icon: CheckCircle },
];

function stateStep(scanState) {
  if (scanState === "idle" || scanState === "scanning") return 0;
  if (scanState === "found" || scanState === "not_found") return 1;
  if (scanState === "enrolling") return 2;
  if (scanState === "success") return 3;
  return 0;
}

/* ------------------------------------------------------------------ */
/*  LOCAL PRIMITIVES — mirror the FloodWatch / ReliefOps design system  */
/* ------------------------------------------------------------------ */

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl bg-gray-50/80 ${className}`}>
      {children}
    </div>
  );
}

function Chip({ children, tone = "neutral" }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ color: t.color, backgroundColor: t.bg }}
    >
      {children}
    </span>
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

function Avatar({ name, size = "md" }) {
  const dims = size === "sm" ? "w-8 h-8 text-[11px]" : size === "lg" ? "w-16 h-16 text-[20px]" : "w-11 h-11 text-[14px]";
  const initials = (name || "").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
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
  const sizeCls = size === "sm" ? "text-[11.5px] py-1.5 px-3" : size === "lg" ? "text-[13.5px] py-3 px-5" : "text-[12.5px] py-2.5 px-4";
  const style = variant === "primary"
    ? { backgroundColor: COLORS.brand, color: "#fff" }
    : { backgroundColor: "transparent", color: COLORS.body, border: `1px solid ${COLORS.line}` };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${sizeCls} ${className}`}
      style={style}
    >
      {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {loadingText || "Working…"}</> : children}
    </button>
  );
}

function SearchField({ value, onChange, onClear, placeholder, searching }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
        <Search className="w-4 h-4" style={{ color: searching ? COLORS.brand : COLORS.muted }} />
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-11 py-2.5 rounded-lg border text-[13px] font-medium focus:outline-none transition-colors"
        style={{ borderColor: COLORS.line, color: COLORS.ink, backgroundColor: COLORS.grid }}
      />
      {value && (
        <button type="button" onClick={onClear} className="absolute inset-y-0 right-3 flex items-center justify-center" aria-label="Clear search">
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.hairline, color: COLORS.body }}>
            <X className="w-3 h-3" />
          </div>
        </button>
      )}
    </div>
  );
}

function InlineBanner({ tone = "danger", icon: Icon = AlertTriangle, children }) {
  const t = TONE[tone] || TONE.danger;
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg text-[13px] font-medium" style={{ color: t.color, backgroundColor: t.bg }}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  STEP INDICATOR                                                      */
/* ------------------------------------------------------------------ */

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
                className="relative flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-300"
                style={
                  done
                    ? { borderColor: COLORS.brand, backgroundColor: COLORS.brand, color: "#fff" }
                    : active
                      ? { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft, color: COLORS.brand }
                      : { borderColor: COLORS.line, backgroundColor: "#fff", color: COLORS.muted }
                }
              >
                {done ? <Check className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
              </div>
              <span className="mt-1.5 text-[10px] sm:text-[11px] font-medium tracking-wide" style={{ color: active || done ? COLORS.brand : COLORS.muted }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-0.5 w-8 sm:w-16 mx-1 sm:mx-2 mb-5 rounded-full transition-colors duration-500"
                style={{ backgroundColor: i < current ? COLORS.brand : COLORS.line }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SCANNING VISUAL                                                     */
/* ------------------------------------------------------------------ */

function ScanningVisual({ scanState }) {
  const ring =
    scanState === "scanning" ? { borderColor: `${COLORS.brand}55`, backgroundColor: `${COLORS.brand}0A` } :
    scanState === "found" ? { borderColor: `${COLORS.brand}66`, backgroundColor: `${COLORS.brand}0F` } :
    scanState === "not_found" ? { borderColor: TONE.warning.border, backgroundColor: TONE.warning.bg } :
    scanState === "success" ? { borderColor: `${COLORS.brand}55`, backgroundColor: `${COLORS.brand}0F` } :
    { borderColor: COLORS.line, backgroundColor: COLORS.grid };

  const iconColor =
    scanState === "scanning" || scanState === "found" || scanState === "success" ? COLORS.brand :
    scanState === "not_found" ? COLORS.warning : COLORS.muted;

  const titleColor =
    scanState === "found" || scanState === "success" ? COLORS.brand :
    scanState === "not_found" ? COLORS.warning : COLORS.ink;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative mb-8">
        <motion.div
          animate={{ scale: scanState === "scanning" ? [1, 1.07, 1] : 1 }}
          transition={{ duration: 2, repeat: scanState === "scanning" ? Infinity : 0 }}
          className="w-36 h-36 sm:w-48 sm:h-48 lg:w-52 lg:h-52 rounded-full border-2 flex items-center justify-center relative overflow-hidden transition-colors duration-500"
          style={ring}
        >
          <Fingerprint className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 transition-colors duration-500" style={{ color: iconColor }} />

          <AnimatePresence>
            {scanState === "scanning" && (
              <motion.div
                initial={{ top: "-10%" }}
                animate={{ top: "110%" }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-0.5 z-20"
                style={{ backgroundColor: COLORS.brand, boxShadow: `0 0 12px ${COLORS.brand}99` }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {scanState === "scanning" && (
          <>
            <motion.div
              animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 rounded-full border pointer-events-none"
              style={{ borderColor: `${COLORS.brand}66` }}
            />
            <motion.div
              animate={{ scale: [1, 1.8], opacity: [0.2, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
              className="absolute inset-0 rounded-full border pointer-events-none"
              style={{ borderColor: `${COLORS.brand}33` }}
            />
          </>
        )}
      </div>

      <div className="text-center w-full">
        <h3 className="text-[15px] font-semibold mb-1 transition-colors duration-300" style={{ color: titleColor }}>
          {scanState === "idle" && "Ready to Scan"}
          {scanState === "scanning" && "Analyzing Biometrics"}
          {scanState === "found" && "Match Confirmed"}
          {scanState === "not_found" && "No Record Found"}
          {scanState === "enrolling" && "Enrolling Fingerprint"}
          {scanState === "success" && "Process Complete"}
        </h3>

        <p className="text-[13px] min-h-5" style={{ color: COLORS.muted }}>
          {scanState === "idle" && "Place finger on the biometric pad to begin"}
          {scanState === "scanning" && "Reading fingerprint pattern…"}
          {scanState === "found" && "Identity verified against records"}
          {scanState === "not_found" && "Create a new profile to enroll"}
          {scanState === "enrolling" && "Capturing this person's fingerprint"}
          {scanState === "success" && "Wristband issued successfully"}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SENSOR STATUS CHIP                                                  */
/* ------------------------------------------------------------------ */

function SensorStatus({ status, streamOnline }) {
  if (!status) {
    return <Chip tone="neutral"><WifiOff className="w-3.5 h-3.5" /> Scanner status unknown</Chip>;
  }
  if (status.device?.connected) {
    return (
      <Chip tone="brand">
        <Usb className="w-3.5 h-3.5" />
        Sensor on {status.device.port?.split("/").pop() || "serial"}
        {status.device.template_count != null && ` · ${status.device.template_count} templates`}
      </Chip>
    );
  }
  return (
    <Chip tone="warning">
      {streamOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      Simulation mode — no scanner attached
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/*  ENROLLMENT PROGRESS                                                 */
/* ------------------------------------------------------------------ */

function EnrollProgress({ step, slot }) {
  return (
    <div
      className="w-full rounded-lg px-4 py-3 border flex items-center gap-3"
      style={{ color: TONE.info.color, backgroundColor: TONE.info.bg, borderColor: TONE.info.border }}
    >
      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">{ENROLL_STEP_LABEL[step] || "Capturing fingerprint…"}</p>
        {slot != null && (
          <p className="text-[11px]  mt-0.5" style={{ color: COLORS.muted }}>Sensor slot #{slot}</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FORM FIELD                                                          */
/* ------------------------------------------------------------------ */

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: COLORS.muted }}>
        {label}
        {required && <span className="ml-0.5" style={{ color: COLORS.brand }}>*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px]" style={{ color: COLORS.muted }}>{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NEW PERSON FORM                                                     */
/* ------------------------------------------------------------------ */

/**
 * A blank intake form. Kept at module scope so `reset()` can hand the desk a
 * genuinely empty form between arrivals — carrying the previous person's name,
 * age or wristband into the next registration is how duplicate records happen.
 */
const EMPTY_PERSON_FORM = {
  full_name: "", age: "", gender: "M", person_type: "refugee",
  family_size: 1, is_pregnant: 0, has_chronic_illness: 0, medical_notes: "",
  wristband_qr: "", grade: 3, school_going: 1,
};

function NewPersonForm({ form, setForm, onSubmit, onCancel, submitting, error }) {
  const [errors, setErrors] = useState({});
  const [scanningQr, setScanningQr] = useState(false);
  const [qrChecking, setQrChecking] = useState(false);

  // ── Wristband code pulled from the printed pool ──
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolLeft, setPoolLeft] = useState(null);
  const [autoAssigned, setAutoAssigned] = useState(false);

  const update = (field, value) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "age") {
        if (Number(value) < 18) {
          next.is_pregnant = 0;
          next.has_chronic_illness = 0;
        } else {
          next.school_going = 1;
          next.grade = 3;
        }
      }
      return next;
    });
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  /**
   * Take the next unassigned code off the printed pool and drop it into the form.
   *
   * Nothing is reserved server-side, so two desks can pull the same code; the
   * registration POST is the point of truth and answers 409 if it lost the race
   * (the screen then clears the field and this runs again). `skip` avoids handing
   * back the code the desk just rejected.
   */
  const fetchNextWristband = useCallback(async ({ skip } = {}) => {
    setPoolLoading(true);
    setErrors((e) => ({ ...e, wristband_qr: undefined }));
    try {
      const res = await fetch(`${API}/api/wristbands/available`);
      const data = await res.json();
      const rows = data.wristbands || [];
      setPoolLeft(rows.length);

      const codeOf = (w) => w.qr_identifier || w.wristband_id || w.barcode || "";
      const next = rows.map(codeOf).find((c) => c && c !== skip);

      if (!next) {
        setForm((f) => ({ ...f, wristband_qr: "" }));
        setAutoAssigned(false);
        return null;
      }
      setForm((f) => ({ ...f, wristband_qr: next }));
      setAutoAssigned(true);
      return next;
    } catch {
      setPoolLeft(null);
      setAutoAssigned(false);
      setErrors((e) => ({ ...e, wristband_qr: "Could not reach the wristband pool — enter or scan a code" }));
      return null;
    } finally {
      setPoolLoading(false);
    }
  }, [setForm]);

  // Pull a code as the form opens, unless the desk already scanned a printed card.
  const autoFetchedRef = useRef(false);
  useEffect(() => {
    if (autoFetchedRef.current) return;
    autoFetchedRef.current = true;
    if (!form.wristband_qr) fetchNextWristband();
  }, [form.wristband_qr, fetchNextWristband]);

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required";
    if (!form.age || Number(form.age) < 0 || Number(form.age) > 130) e.age = "Enter a valid age (0–130)";
    if (!form.family_size || Number(form.family_size) < 1) e.family_size = "Family size must be at least 1";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSubmit();
  };

  const verifyAndSetWristband = async (code) => {
    setScanningQr(false);
    if (!code) return;
    setQrChecking(true);
    try {
      const res = await fetch(`${API}/api/qr/${encodeURIComponent(code)}/lookup`);
      const data = await res.json();
      if (data.state === "available") {
        setAutoAssigned(false);
        update("wristband_qr", code);
      } else if (data.state === "assigned") {
        setErrors((e) => ({ ...e, wristband_qr: `Wristband already assigned to ${data.person?.full_name || "someone"}` }));
      } else if (data.state === "inactive") {
        setErrors((e) => ({ ...e, wristband_qr: "This wristband is inactive" }));
      } else {
        setErrors((e) => ({ ...e, wristband_qr: "QR code not recognized" }));
      }
    } catch {
      setErrors((e) => ({ ...e, wristband_qr: "Failed to verify wristband" }));
    } finally {
      setQrChecking(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: COLORS.hairline }}>
        <IconTile icon={UserPlus} />
        <div>
          <h2 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>New Registration</h2>
          <p className="text-[12px]" style={{ color: COLORS.muted }}>No fingerprint match — enroll this person</p>
        </div>
      </div>

      {error && <InlineBanner tone="danger">{error}</InlineBanner>}

      <div className="grid grid-cols-2 gap-3">
        {form.wristband_qr && (
          <div className="col-span-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[12.5px] font-medium" style={{ color: TONE.brand.color, backgroundColor: TONE.brand.bg, borderColor: TONE.brand.border }}>
              <QrCode className="w-4 h-4 shrink-0" />
              <span className="flex-1">
                Wristband <span className="font-semibold">{form.wristband_qr}</span>
                {autoAssigned ? " was pulled from the printed pool" : " is empty"} — it will be activated for this person on registration.
              </span>
            </div>
          </div>
        )}

        <div className="col-span-2">
          <Field
            label="Printed Wristband QR"
            hint={form.wristband_qr
              ? `Will assign wristband ${form.wristband_qr} on registration${autoAssigned && poolLeft != null ? ` · ${poolLeft} in the pool` : ""}`
              : poolLeft === 0
                ? "Printed pool is empty — a new wristband will be issued automatically on registration"
                : "Auto-filled from the printed pool — or scan the card, type a code, or leave blank to auto-issue"}
          >
            {scanningQr ? (
              <QRScanner
                onScan={verifyAndSetWristband}
                onCancel={() => setScanningQr(false)}
              />
            ) : (
              <div className="flex gap-2">
                <input
                  placeholder={poolLoading ? "Fetching next code…" : "e.g. CAMP-WB-0001"}
                  value={form.wristband_qr || ""}
                  onChange={(e) => { setAutoAssigned(false); update("wristband_qr", e.target.value); }}
                  className={inputClassBase}
                />
                <button
                  type="button"
                  onClick={() => fetchNextWristband({ skip: form.wristband_qr || undefined })}
                  disabled={poolLoading || qrChecking}
                  aria-label="Fetch next available wristband code"
                  title="Fetch next available wristband code"
                  className="shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-40"
                  style={{ borderColor: COLORS.line, color: COLORS.brand }}
                >
                  <RefreshCw className={`w-4 h-4 ${poolLoading ? "animate-spin" : ""}`} />
                </button>
                <Button type="button" variant="secondary" onClick={() => { setErrors((e) => ({ ...e, wristband_qr: undefined })); setScanningQr(true); }} className="shrink-0 px-3" aria-label="Scan QR">
                  <Camera className="w-4 h-4" />
                </Button>
                {form.wristband_qr && (
                  <button
                    type="button"
                    onClick={() => { setAutoAssigned(false); update("wristband_qr", ""); setErrors((e) => ({ ...e, wristband_qr: undefined })); }}
                    aria-label="Clear QR"
                    className="shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center"
                    style={{ borderColor: COLORS.line, color: COLORS.muted }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </Field>
          {errors.wristband_qr && <p className="mt-1 text-[11px] flex items-center gap-1" style={{ color: TONE.danger.color }}><AlertTriangle className="w-3 h-3" /> {errors.wristband_qr}</p>}
        </div>

        <div className="col-span-2">
          <Field label="Full Name" required>
            <input placeholder="e.g. John Doe" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className={inputClassBase} />
            {errors.full_name && <p className="mt-1 text-[11px] flex items-center gap-1" style={{ color: TONE.danger.color }}><AlertTriangle className="w-3 h-3" /> {errors.full_name}</p>}
          </Field>
        </div>

        <Field label="Age" required>
          <input type="number" min={0} max={130} placeholder="Years" value={form.age} onChange={(e) => update("age", e.target.value)} className={inputClassBase} />
          {errors.age && <p className="mt-1 text-[11px] flex items-center gap-1" style={{ color: TONE.danger.color }}><AlertTriangle className="w-3 h-3" /> {errors.age}</p>}
        </Field>

        <Field label="Gender" required>
          <select value={form.gender} onChange={(e) => update("gender", e.target.value)} className={inputClassBase}>
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="O">Other</option>
          </select>
        </Field>

        {Number(form.age) < 18 && Number(form.age) >= 0 && form.age !== "" && (
          <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="School Going">
              <button
                type="button"
                onClick={() => update("school_going", form.school_going ? 0 : 1)}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-medium transition-all active:scale-[0.98] w-full"
                style={form.school_going ? { backgroundColor: TONE.brand.bg, borderColor: TONE.brand.border, color: TONE.brand.color } : { backgroundColor: "#fff", borderColor: COLORS.line, color: COLORS.muted }}
              >
                <GraduationCap className="w-4 h-4" /> {form.school_going ? "School Going" : "Not School Going"}
              </button>
            </Field>

            {form.school_going ? (
              <Field label="Grade" required>
                <input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="1–12"
                  value={form.grade}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") { update("grade", ""); return; }
                    const n = Number(v);
                    if (n >= 1 && n <= 12) update("grade", n);
                  }}
                  className={inputClassBase}
                />
                {errors.grade && <p className="mt-1 text-[11px] flex items-center gap-1" style={{ color: TONE.danger.color }}><AlertTriangle className="w-3 h-3" /> {errors.grade}</p>}
              </Field>
            ) : (
              <div />
            )}
          </div>
        )}

        <div className="col-span-2">
          <Field label="Person Type" required>
            <select value={form.person_type} onChange={(e) => update("person_type", e.target.value)} className={inputClassBase}>
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
                className="w-9 h-9 rounded-lg font-bold transition-colors flex items-center justify-center border"
                style={{ backgroundColor: "#F5F6F5", color: COLORS.body, borderColor: COLORS.line }}
                aria-label="Decrease family size"
              >
                −
              </button>
              <span className="text-[17px] font-bold w-8 text-center tabular-nums" style={{ color: COLORS.ink }}>{form.family_size || 1}</span>
              <button
                type="button"
                onClick={() => update("family_size", Math.min(20, Number(form.family_size || 1) + 1))}
                className="w-9 h-9 rounded-lg font-bold transition-colors flex items-center justify-center border"
                style={{ backgroundColor: "#F5F6F5", color: COLORS.body, borderColor: COLORS.line }}
                aria-label="Increase family size"
              >
                +
              </button>
            </div>
            {errors.family_size && <p className="mt-1 text-[11px] flex items-center gap-1" style={{ color: TONE.danger.color }}><AlertTriangle className="w-3 h-3" /> {errors.family_size}</p>}
          </Field>
        </div>

        {Number(form.age) >= 18 && (
        <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => update("is_pregnant", form.is_pregnant ? 0 : 1)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-medium transition-all active:scale-[0.98]"
            style={form.is_pregnant ? { backgroundColor: TONE.violet.bg, borderColor: TONE.violet.border, color: TONE.violet.color } : { backgroundColor: "#fff", borderColor: COLORS.line, color: COLORS.muted }}
          >
            <Waves className="w-4 h-4" /> Pregnant
          </button>
          <button
            type="button"
            onClick={() => update("has_chronic_illness", form.has_chronic_illness ? 0 : 1)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-medium transition-all active:scale-[0.98]"
            style={form.has_chronic_illness ? { backgroundColor: TONE.warning.bg, borderColor: TONE.warning.border, color: TONE.warning.color } : { backgroundColor: "#fff", borderColor: COLORS.line, color: COLORS.muted }}
          >
            <AlertTriangle className="w-4 h-4" /> Chronic Illness
          </button>
        </div>
        )}

        <div className="col-span-2">
          <Field label="Medical Notes" hint="Optional — e.g. pregnancy stage, medication, allergies">
            <textarea rows={2} placeholder="e.g. Diabetes type 2, on insulin" value={form.medical_notes} onChange={(e) => update("medical_notes", e.target.value)} className={`${inputClassBase} resize-none`} />
          </Field>
        </div>
      </div>

      <div className="flex gap-3 pt-3">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="button" loading={submitting} loadingText="Enrolling…" onClick={handleSubmit} className="flex-2">
          Enroll &amp; Issue Wristband <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BARCODE                                                             */
/* ------------------------------------------------------------------ */

function Barcode({ value }) {
  const bars = Array.from({ length: 36 }, (_, i) => {
    const c = value.charCodeAt(i % value.length);
    return { w: 1 + (c % 3), gap: 1 + ((c >> 3) % 2) };
  });
  return (
    <div className="rounded-xl p-4 inline-flex flex-col items-center border" style={{ borderColor: COLORS.line, backgroundColor: "#fff" }}>
      <div className="flex items-end" style={{ height: 44 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ width: b.w, marginRight: b.gap, backgroundColor: COLORS.ink }} className="h-full" />
        ))}
      </div>
      <div className="mt-2 text-[12px] font-bold tracking-widest" style={{ color: COLORS.ink }}>{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NO MATCH DECISION                                                   */
/* ------------------------------------------------------------------ */

function NoMatchDecision({ onNew, onReturning, detail }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full space-y-6">
      <div className="w-16 h-16 rounded-full flex items-center justify-center border" style={{ backgroundColor: TONE.warning.bg, borderColor: TONE.warning.border }}>
        <AlertTriangle className="w-7 h-7" style={{ color: TONE.warning.color }} />
      </div>
      <div>
        <h3 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>No Fingerprint Match</h3>
        <p className="text-[13px] mt-1 max-w-xs" style={{ color: COLORS.muted }}>
          {detail || "This fingerprint was not found in the camp database."}
        </p>
      </div>

      <div className="w-full grid gap-3">
        <button
          onClick={onNew}
          className="w-full px-5 py-4 text-white text-[13.5px] font-semibold rounded-xl transition-all active:scale-[0.98] text-left flex items-center gap-4 hover:opacity-90"
          style={{ backgroundColor: COLORS.brand }}
        >
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <div>New to the camp</div>
            <div className="text-[11.5px] font-normal text-white/80">Register as a brand-new person and enroll</div>
          </div>
          <ArrowRight className="w-4 h-4 ml-auto" />
        </button>

        <button
          onClick={onReturning}
          className="w-full px-5 py-4 text-[13.5px] font-semibold rounded-xl transition-all active:scale-[0.98] text-left flex items-center gap-4 border hover:opacity-80"
          style={{ backgroundColor: "#fff", borderColor: COLORS.line, color: COLORS.ink }}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#F5F6F5" }}>
            <UserCheck className="w-5 h-5" style={{ color: COLORS.muted }} />
          </div>
          <div>
            <div>Returning member</div>
            <div className="text-[11.5px] font-normal" style={{ color: COLORS.muted }}>Fingerprint failed — search existing records</div>
          </div>
          <ArrowRight className="w-4 h-4 ml-auto" style={{ color: COLORS.muted }} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RETURNING SEARCH                                                    */
/* ------------------------------------------------------------------ */

function ReturningSearch({ query, setQuery, results, onSearch, onSelect, searching, error, onBack, selected }) {
  return (
    <div className="flex flex-col h-full space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: COLORS.hairline }}>
        <IconTile icon={UserCheck} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>Returning Member</h2>
          <p className="text-[12px] truncate" style={{ color: COLORS.muted }}>Search by name, fingerprint ID, or wristband</p>
        </div>
        <button onClick={onBack} className="text-[12px] font-semibold transition-colors" style={{ color: COLORS.muted }}>Back</button>
      </div>

      <form onSubmit={onSearch} className="space-y-3">
        <SearchField value={query} onChange={setQuery} onClear={() => setQuery("")} placeholder="e.g. Kasun Perera, FP_0001, WB000001" searching={searching} />
        <Button type="submit" loading={searching} loadingText="Searching…" disabled={!query.trim()} className="w-full">
          <Search className="w-4 h-4" /> Search Records
        </Button>
      </form>

      {error && <InlineBanner tone="danger">{error}</InlineBanner>}

      <div className="flex-1 overflow-y-auto space-y-2 max-h-75">
        {!searching && results.length === 0 && !error && (
          <div className="text-center py-8">
            <p className="text-[13px]" style={{ color: COLORS.muted }}>{selected ? "No results — adjust your search" : "Search to find an existing record"}</p>
          </div>
        )}
        {results.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
            style={{ backgroundColor: "#FAFAF9", borderColor: COLORS.line }}
          >
            <Avatar name={p.full_name} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: COLORS.ink }}>{p.full_name}</div>
              <div className="text-[11px]" style={{ color: COLORS.muted }}>{p.age}y · {p.gender} · {p.wristband_barcode || "no wristband"}</div>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" style={{ color: COLORS.muted }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PROFILE FIELD TILE                                                  */
/* ------------------------------------------------------------------ */

function ProfileTile({ icon: Icon, label, value, className = "" }) {
  return (
    <div className={`rounded-lg px-4 py-3.5 border ${className}`} style={{ backgroundColor: "#FAFAF9", borderColor: COLORS.line }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: COLORS.muted }}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-[15px] font-semibold capitalize" style={{ color: COLORS.ink }}>{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN SCREEN                                                         */
/* ------------------------------------------------------------------ */

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

  const [newPersonForm, setNewPersonForm] = useState(EMPTY_PERSON_FORM);

  const [persons, setPersons] = useState([]);
  const [personsLoading, setPersonsLoading] = useState(true);
  const [personsError, setPersonsError] = useState("");
  const [viewingPersonId, setViewingPersonId] = useState(null);
  const [showReenrollConfirm, setShowReenrollConfirm] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrBound, setQrBound] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [wristbandScanForCheckin, setWristbandScanForCheckin] = useState(false);
  const abortRef = useRef(null);

  // ── Live fingerprint hardware ──
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStep, setEnrollStep] = useState(null);
  const [enrollSlot, setEnrollSlot] = useState(null);
  const [enrollNotice, setEnrollNotice] = useState(null);
  const [deviceLog, setDeviceLog] = useState([]);
  const [showFeed, setShowFeed] = useState(false);
  const scanStateRef = useRef(scanState);
  const enrollContextRef = useRef(null);
  const wristbandRef = useRef("");
  scanStateRef.current = scanState;
  wristbandRef.current = wristband;

  const fetchPersons = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPersonsLoading(true);
    setPersonsError("");
    fetch(`${API}/api/register`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then((data) => {
        setPersons((data.persons || []).map((p) => ({
          ...p,
          enrollment_status: p.fingerprint_slot != null ? "enrolled" : "not_enrolled",
        })));
        setPersonsLoading(false);
      })
      .catch((err) => { if (err.name !== "AbortError") { setPersonsError(err.message || "Failed to load registrations"); setPersonsLoading(false); } });
  }, []);

  useEffect(() => { fetchPersons(); }, [fetchPersons]);

  const applyScanResult = useCallback((data) => {
    if (data.matched && data.person) {
      setProfile(data.person);
      setQrBound(false);
      setScanState("found");
      setStatusMessage(`Identity verified: ${data.person.full_name}`);
    } else {
      setProfile(null);
      setNotFoundView("decision");
      setScanState("not_found");
      setStatusMessage(data.message || "No profile found. How would you like to continue?");
    }
  }, []);

  const finishEnroll = useCallback((data) => {
    const context = enrollContextRef.current;

    // A cancel, a clear or a skip drops the context. The sensor still reports the
    // aborted capture a moment later, and without this guard that late frame
    // repaints a red "enrollment failed" over a screen that has already moved on.
    if (context == null) return;

    setEnrolling(false);
    setEnrollStep(null);
    setEnrollSlot(null);
    enrollContextRef.current = null;

    if (!data.success) {
      const text = `Enrollment failed: ${data.error || "sensor error"}`;
      setStatusMessage(text);
      setEnrollNotice({ tone: "danger", text });
      addToast(data.error || "Enrollment failed", "error");
      // On the registration path the person and wristband already exist, so the
      // desk stays on the fingerprint step to retry or skip — never loses them.
      return;
    }

    if (data.person) setProfile(data.person);
    setStatusMessage(`Fingerprint enrolled on slot #${data.slot}`);
    setEnrollNotice({ tone: "brand", text: `Fingerprint enrolled on slot #${data.slot}`, icon: CheckCircle });
    addToast(`Fingerprint enrolled on slot #${data.slot}`, "success");
    fetchPersons();

    if (context === "register") {
      setStatusMessage(`Wristband assigned: ${wristbandRef.current}`);
      setScanState("success");
    } else if (context === "reenroll") {
      setReturningPerson(null);
      setNotFoundView("decision");
      setScanState("found");
    }
  }, [addToast, fetchPersons]);

  const { status: deviceStatus, streamOnline, deviceConnected } = useFingerprintDevice({
    onScanResult: (data) => {
      // The pad can be touched at any moment — only act when the desk is waiting.
      if (scanStateRef.current !== "scanning" && scanStateRef.current !== "idle") return;
      applyScanResult(data);
    },
    onEnrollProgress: (data) => {
      setEnrolling(true);
      setEnrollStep(data.step);
      if (data.slot != null) setEnrollSlot(data.slot);
    },
    onEnrollResult: finishEnroll,
    onDeviceError: (data) => addToast(data.message || "Sensor error", "error"),
    onDeviceEvent: (data) => {
      // Keep the raw frames: with unverified firmware this is the only way to see
      // what the sensor actually says.
      setDeviceLog((log) => [
        { at: new Date().toLocaleTimeString(), raw: JSON.stringify(data) },
        ...log,
      ].slice(0, 60));
    },
  });

  /** Capture a template on the sensor and bind it to a person. Progress arrives over SSE. */
  const startEnroll = async (personId, context) => {
    enrollContextRef.current = context;
    setEnrolling(true);
    setEnrollStep("STARTED");
    setEnrollSlot(null);
    setEnrollNotice(null);
    try {
      const res = await fetch(`${API}/api/fingerprint/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: personId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrollment could not be started");
      setEnrollSlot(data.slot);
      setStatusMessage(`Enrolling on sensor slot #${data.slot} — follow the prompts`);
    } catch (err) {
      setEnrolling(false);
      setEnrollStep(null);
      enrollContextRef.current = null;
      setStatusMessage(`Enrollment failed: ${err.message}`);
      setEnrollNotice({ tone: "danger", text: `Enrollment failed: ${err.message}` });
      addToast(err.message, "error");
    }
  };

  /**
   * Bind the captured slot by hand. Some firmware captures a print but never
   * announces it; without this the desk would wait out the timeout for nothing.
   */
  const confirmEnrollManually = async () => {
    try {
      const res = await fetch(`${API}/api/fingerprint/enroll/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrollSlot != null ? { slot: enrollSlot } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not link the fingerprint");
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  /**
   * Put the sensor and the screen back to a clean "ready to capture" state.
   *
   * Local state is dropped up front rather than waiting on the SSE reply: when
   * the stream is down or the firmware never answers a cancel, waiting leaves the
   * desk stuck on a spinner it cannot dismiss.
   */
  const clearEnroll = useCallback(async ({ silent = false } = {}) => {
    enrollContextRef.current = null;
    setEnrolling(false);
    setEnrollStep(null);
    setEnrollSlot(null);
    setEnrollNotice(null);
    if (!silent) setStatusMessage("Sensor cleared — ready to capture again");
    try {
      await fetch(`${API}/api/fingerprint/enroll/cancel`, { method: "POST" });
    } catch {
      // Best effort: the sensor times out on its own, and the screen is already clear.
    }
  }, []);

  /**
   * Finish a registration without a template. Some arrivals genuinely cannot be
   * enrolled — infants, bandaged or amputated hands — and the desk must not be
   * blocked. The roster flags them so staff can come back to it.
   */
  const skipEnrollment = async () => {
    await clearEnroll({ silent: true });
    setEnrollNotice({
      tone: "warning",
      text: "Registered without a fingerprint — enrol later from the person's profile",
    });
    setStatusMessage(wristband ? `Wristband assigned: ${wristband}` : "Registration complete");
    setScanState("success");
  };

  /** Clear whatever the sensor is holding, then start a fresh capture for this person. */
  const retryEnrollment = async () => {
    if (!profile) return;
    await clearEnroll({ silent: true });
    startEnroll(profile.id, "register");
  };

  const handleScanFingerprint = async () => {
    setScanState("scanning");
    setStatusMessage("Initializing biometric scan...");
    try {
      const res = await fetch(`${API}/api/fingerprint/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scanner service unavailable");

      // Hardware answers asynchronously — the match lands on the SSE stream.
      if (data.status === "SCANNING") {
        setStatusMessage(data.message || "Place finger on the sensor");
        return;
      }

      // Simulator resolves inline; hold the scan animation briefly so it reads.
      setTimeout(() => applyScanResult(data), 1200);
    } catch (err) {
      setScanState("idle");
      setStatusMessage(err.message || "Scanner offline or error");
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
      if (data.error) { setSearchError(data.error); setSearchResults([]); }
      else { setSearchResults(data.results || []); }
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

  const openPersonQr = async (personId) => {
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

  const handleQrScan = async (code) => {
    setQrScanning(false);
    if (!code) return;
    setQrCode(code);
    setStatusMessage("");
    setRegError("");
    try {
      const res = await fetch(`${API}/api/qr/${encodeURIComponent(code)}/lookup`);
      const data = await res.json();
      if (data.state === "assigned") {
        setProfile(data.person);
        setQrBound(true);
        setScanState("found");
        setStatusMessage(`Profile loaded: ${data.person.full_name}`);
      } else if (data.state === "available") {
        setNewPersonForm({ ...EMPTY_PERSON_FORM, wristband_qr: code });
        setScanState("not_found");
        setNotFoundView("new");
        setStatusMessage("This wristband is empty — register the person to activate it");
      } else if (data.state === "inactive") {
        addToast("Wristband is inactive", "error");
        setStatusMessage("This wristband is inactive");
      } else {
        addToast("QR not recognized", "error");
        setStatusMessage("QR code not recognized");
      }
    } catch (err) {
      addToast("QR lookup failed", "error");
      setStatusMessage("QR lookup failed");
    }
  };

  const handleReenroll = async () => {
    if (!returningPerson) return;
    setStatusMessage("Re-enrolling fingerprint…");
    await startEnroll(returningPerson.id, "reenroll");
  };

  const handleCheckin = async () => {
    setWristbandScanForCheckin(true);
    setQrScanning(true);
  };

  const handleCheckinWristbandScan = async (barcode) => {
    setQrScanning(false);
    setWristbandScanForCheckin(false);
    if (!barcode) return;
    setSubmitting(true);
    try {
      const checkinRes = await fetch(`${API}/api/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: profile.id }),
      });
      if (!checkinRes.ok) {
        const data = await checkinRes.json().catch(() => ({}));
        throw new Error(data.error || "Check-in failed");
      }
      const checkinData = await checkinRes.json();
      setQosInfo(checkinData.mqtt);

      const assignRes = await fetch(`${API}/api/wristbands/assign-by-barcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, person_id: profile.id }),
      });
      const assignData = await assignRes.json();
      if (!assignRes.ok) {
        throw new Error(assignData.message || "Wristband assignment failed");
      }

      setWristband(barcode);
      setStatusMessage(`Wristband assigned: ${barcode}`);
      setScanState("success");
      addToast("Check-in successful", "success");
      fetchPersons();

      try {
        const qrRes = await fetch(`${API}/api/register/${profile.id}/qrcode`);
        const qrPayload = await qrRes.json();
        if (qrRes.ok && qrPayload.data_url) setQrData(qrPayload);
      } catch {}
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
        if (data.fields) setRegError(Object.values(data.fields).join(". "));
        else setRegError(msg);
        addToast(msg, "error");
        // Another desk took this band between the auto-fetch and the submit.
        // Drop it so the form pulls a fresh code instead of failing forever.
        if (res.status === 409 && /wristband/i.test(msg)) {
          setNewPersonForm((f) => ({ ...f, wristband_qr: "" }));
        }
        return;
      }
      setProfile(data.person);
      setQosInfo(data.mqtt);
      setWristband(data.wristband_barcode || "");
      addToast(`${data.person.full_name} registered successfully`, "success");
      fetchPersons();

      try {
        const qrRes = await fetch(`${API}/api/register/${data.person.id}/qrcode`);
        const qrPayload = await qrRes.json();
        if (qrRes.ok && qrPayload.data_url) setQrData(qrPayload);
      } catch {}

      // A person with no template can never be found by scanning, so capture one
      // now — while they are still standing at the desk.
      setScanState("enrolling");
      setStatusMessage(`Capturing fingerprint for ${data.person.full_name}`);
      await startEnroll(data.person.id, "register");
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
    setQrScanning(false);
    setQrBound(false);
    setQrCode("");
    setQrData(null);
    setWristbandScanForCheckin(false);
    setNewPersonForm(EMPTY_PERSON_FORM);
    setEnrolling(false);
    setEnrollStep(null);
    setEnrollSlot(null);
    setEnrollNotice(null);
    enrollContextRef.current = null;
  };

  const currentStep = stateStep(scanState);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>
      <div className="sm:px-5 lg:px-6 sm:py-7 space-y-4 sm:space-y-6">

        {/* ================= TITLE ROW ================= */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-3">
          <div>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em]" style={{ color: COLORS.muted }}>Camp operations</p>
            <h1 className="font-medium text-[22px] sm:text-[26px] lg:text-[32px] leading-[1.1] tracking-tight mt-1" style={{ color: COLORS.ink }}>Registration</h1>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.muted }}>
            <CalendarDays className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
            <span className="font-medium">{today}</span>
          </div>
        </div>

        {/* ================= STEP INDICATOR ================= */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="py-1">
          <StepIndicator current={currentStep} />
        </motion.div>

        {/* ================= SCAN + RESULT ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 sm:gap-5 lg:gap-6">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-64 sm:min-h-80 lg:min-h-105">
              <div className="mb-5">
                <SensorStatus status={deviceStatus} streamOnline={streamOnline} />
              </div>

              <ScanningVisual scanState={scanState} />

              {enrolling && scanState !== "enrolling" && (
                <div className="mt-6 w-full space-y-2">
                  <EnrollProgress step={enrollStep} slot={enrollSlot} />
                  <Button variant="secondary" size="sm" onClick={() => clearEnroll()} className="w-full">
                    <X className="w-3.5 h-3.5" /> Clear sensor
                  </Button>
                </div>
              )}

              {!enrolling && scanState !== "enrolling" && enrollNotice && (
                <div className="mt-6 w-full space-y-2">
                  <InlineBanner tone={enrollNotice.tone} icon={enrollNotice.icon || AlertTriangle}>
                    {enrollNotice.text}
                  </InlineBanner>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary" size="sm"
                      onClick={() => profile && startEnroll(profile.id, "profile")}
                      disabled={!profile}
                      className="w-full"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => clearEnroll()} className="w-full">
                      <X className="w-3.5 h-3.5" /> Clear
                    </Button>
                  </div>
                </div>
              )}

              {!enrolling && scanState === "idle" && (
                <div className="mt-7 w-full grid gap-3">
                  <Button onClick={handleScanFingerprint} size="lg" className="w-full">
                    <Fingerprint className="w-4 h-4" /> Initiate Scan
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => setQrScanning(true)} className="w-full">
                    <Camera className="w-4 h-4" /> Scan Wristband QR
                  </Button>
                </div>
              )}
              {!enrolling && scanState === "idle" && import.meta.env.DEV && (
                <Button
                  variant="secondary" size="lg"
                  onClick={() => { setScanState("not_found"); setNotFoundView("new"); setStatusMessage(""); }}
                  className="mt-3 w-full"
                >
                  <UserPlus className="w-4 h-4" /> Test Registration
                </Button>
              )}
              {!enrolling && scanState !== "idle" && (
                <Button variant="secondary" size="lg" onClick={reset} className="mt-7 w-full">Reset</Button>
              )}
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="p-4 sm:p-6 lg:p-8 min-h-60 sm:min-h-70 lg:min-h-105 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {(scanState === "idle" || scanState === "scanning") && (
                  <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    {qrScanning ? (
                      <QRScanner onScan={wristbandScanForCheckin ? handleCheckinWristbandScan : handleQrScan} onCancel={() => { setQrScanning(false); setWristbandScanForCheckin(false); }} />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center h-full space-y-5">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center border" style={{ backgroundColor: "#FAFAF9", borderColor: COLORS.line }}>
                          <ShieldCheck className="w-8 h-8" style={{ color: "#D4D8D5" }} />
                        </div>
                        <div>
                          <h3 className="text-[15px] font-semibold" style={{ color: COLORS.muted }}>Awaiting Input</h3>
                          <p className="text-[13px] mt-1 max-w-xs" style={{ color: COLORS.muted }}>Scan a fingerprint or a wristband QR code to pull up a profile or create a new registration.</p>
                        </div>
                        {scanState === "scanning" && (
                          <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: COLORS.brand }}>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {deviceConnected ? "Place finger on the sensor…" : "Contacting biometric scanner…"}
                          </div>
                        )}
                        {scanState === "idle" && statusMessage && (
                          <div className="w-full"><InlineBanner tone="danger">{statusMessage}</InlineBanner></div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {scanState === "found" && profile && (
                  <motion.div key="found" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-4 sm:space-y-6">
                    {qrScanning ? (
                      <QRScanner onScan={handleCheckinWristbandScan} onCancel={() => { setQrScanning(false); setWristbandScanForCheckin(false); }} />
                    ) : (<>
                    <div className="flex items-start gap-3 sm:gap-5">
                      <Avatar name={profile.full_name} size="lg" />
                      <div>
                        <h2 className="font-medium text-[17px] sm:text-[20px] tracking-tight" style={{ color: COLORS.ink }}>{profile.full_name}</h2>
                        <div className="mt-1.5">
                          {qrBound ? (
                            <Chip tone="brand"><QrCode className="w-3.5 h-3.5" /> Profile Loaded{qrCode ? ` · ${qrCode}` : ""}</Chip>
                          ) : (
                            <Chip tone="brand"><CheckCircle className="w-3.5 h-3.5" /> Identity Verified</Chip>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <ProfileTile icon={User} label="Age & Gender" value={`${profile.age} yrs · ${profile.gender}`} />
                      <ProfileTile icon={Users} label="Family" value={`${profile.family_size} Members`} />
                      {profile.person_type && (
                        <ProfileTile className="col-span-2" icon={BadgeCheck} label="Person Type" value={profile.person_type.replace(/_/g, " ")} />
                      )}
                      <ProfileTile
                        className="col-span-2"
                        icon={Fingerprint}
                        label="Fingerprint"
                        value={profile.fingerprint_slot != null ? `Sensor slot #${profile.fingerprint_slot}` : "Not enrolled"}
                      />
                    </div>

                    {profile.fingerprint_slot == null && !enrolling && (
                      <Button variant="secondary" onClick={() => startEnroll(profile.id, "profile")} className="w-full">
                        <Fingerprint className="w-4 h-4" /> Enroll Fingerprint for this Person
                      </Button>
                    )}

                    {(profile.is_pregnant || profile.has_chronic_illness) && (
                      <div className="flex flex-wrap gap-2">
                        {profile.is_pregnant && <Chip tone="violet"><Waves className="w-3.5 h-3.5" /> Pregnant</Chip>}
                        {profile.has_chronic_illness && <Chip tone="warning"><AlertTriangle className="w-3.5 h-3.5" /> Chronic Illness</Chip>}
                      </div>
                    )}

                    {profile.medical_notes && (
                      <div className="text-[12.5px] rounded-lg px-4 py-3 border" style={{ color: COLORS.body, backgroundColor: TONE.warning.bg, borderColor: TONE.warning.border }}>
                        <span className="font-semibold" style={{ color: TONE.warning.color }}>Notes: </span>{profile.medical_notes}
                      </div>
                    )}

                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      {qrBound ? (
                        <Button onClick={reset} className="w-full">Done — Next Person</Button>
                      ) : (
                        <Button onClick={handleCheckin} loading={submitting} loadingText="Processing…" className="w-full">
                          Scan Wristband &amp; Check-in <ArrowRight className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => openPersonQr(profile.id)} loading={qrLoading} loadingText="…" className="px-3" aria-label="Show QR">
                        <QrCode className="w-4 h-4" />
                      </Button>
                    </div>
                    </>)}
                  </motion.div>
                )}

                {scanState === "not_found" && (
                  <motion.div key="not_found" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full">
                    {notFoundView === "decision" && (
                      <NoMatchDecision
                        onNew={() => setNotFoundView("new")}
                        onReturning={() => setNotFoundView("returning")}
                        detail={statusMessage}
                      />
                    )}

                    {notFoundView === "new" && (
                      <NewPersonForm
                        form={newPersonForm} setForm={setNewPersonForm} onSubmit={handleRegisterNew}
                        onCancel={() => { setNotFoundView("decision"); setRegError(""); }}
                        submitting={submitting} error={regError}
                      />
                    )}

                    {notFoundView === "returning" && (
                      <ReturningSearch
                        query={searchQuery} setQuery={setSearchQuery} results={searchResults}
                        onSearch={handleSearch} onSelect={handleSelectReturning}
                        searching={searching} error={searchError}
                        onBack={() => setNotFoundView("decision")} selected={returningPerson}
                      />
                    )}

                    {notFoundView === "returning_profile" && profile && (
                      <div className="space-y-6">
                        <div className="flex items-start gap-5">
                          <Avatar name={profile.full_name} size="lg" />
                          <div>
                            <h2 className="font-medium text-[20px] tracking-tight" style={{ color: COLORS.ink }}>{profile.full_name}</h2>
                            <div className="mt-1.5"><Chip tone="warning"><UserCheck className="w-3.5 h-3.5" /> Returning Member Found</Chip></div>
                            <p className="text-[11.5px] mt-1.5" style={{ color: COLORS.muted }}>Fingerprint failed — re-enroll to bind this person to a new fingerprint</p>
                          </div>
                        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <ProfileTile icon={User} label="Age & Gender" value={`${profile.age} yrs · ${profile.gender}`} />
                          <ProfileTile icon={Users} label="Family" value={`${profile.family_size} Members`} />
                        </div>

                        <Button onClick={() => setShowReenrollConfirm(true)} disabled={enrolling} loading={enrolling} loadingText="Capturing fingerprint…" className="w-full">
                          <Link2 className="w-4 h-4" /> Re-enroll Fingerprint
                        </Button>
                        <Button variant="secondary" onClick={() => openPersonQr(profile.id)} loading={qrLoading} loadingText="Loading QR…" className="w-full">
                          <QrCode className="w-4 h-4" /> Show QR
                        </Button>
                        <Button variant="secondary" onClick={() => { setReturningPerson(null); setNotFoundView("returning"); }} className="w-full">
                          Not this person — search again
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}

                {scanState === "enrolling" && (
                  <motion.div key="enrolling" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: COLORS.hairline }}>
                      <IconTile icon={Fingerprint} />
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>Enrol Fingerprint</h2>
                        <p className="text-[12px] truncate" style={{ color: COLORS.muted }}>
                          {profile ? `${profile.full_name} is registered — capture their fingerprint to finish` : "Capturing fingerprint"}
                        </p>
                      </div>
                    </div>

                    {wristband && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[12.5px] font-medium" style={{ color: TONE.brand.color, backgroundColor: TONE.brand.bg, borderColor: TONE.brand.border }}>
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        Wristband <span className="font-semibold">{wristband}</span> is reserved and will be issued next.
                      </div>
                    )}

                    {enrolling ? (
                      <EnrollProgress step={enrollStep} slot={enrollSlot} />
                    ) : (
                      <InlineBanner tone={enrollNotice?.tone || "info"} icon={enrollNotice?.icon || AlertTriangle}>
                        {enrollNotice?.text || "Ready to capture — press Retry to start the sensor."}
                      </InlineBanner>
                    )}

                    <div className="grid gap-2">
                      {enrolling ? (
                        <>
                          <Button variant="secondary" onClick={confirmEnrollManually} className="w-full">
                            <Link2 className="w-4 h-4" /> Sensor captured — link slot{enrollSlot != null ? ` #${enrollSlot}` : ""} now
                          </Button>
                          {/* Clear is deliberately its own action: it abandons the capture
                              in flight and leaves the sensor idle, without restarting it. */}
                          <Button variant="secondary" onClick={() => clearEnroll()} className="w-full">
                            <X className="w-4 h-4" /> Clear — stop this capture
                          </Button>
                        </>
                      ) : (
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <Button onClick={retryEnrollment} className="w-full">
                            <RefreshCw className="w-4 h-4" /> {enrollNotice?.tone === "danger" ? "Retry Capture" : "Start Capture"}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => clearEnroll()}
                            disabled={!enrollNotice && enrollStep == null && enrollSlot == null}
                            className="px-4"
                          >
                            <X className="w-4 h-4" /> Clear
                          </Button>
                        </div>
                      )}
                      <Button variant="secondary" onClick={skipEnrollment} className="w-full">
                        Skip for now — issue wristband
                      </Button>
                    </div>

                    <p className="text-[11.5px]" style={{ color: COLORS.muted }}>
                      Skipping is fine for infants or injured hands. The person stays registered and
                      appears as <span className="font-semibold">Not enrolled</span> in the roster.
                    </p>
                  </motion.div>
                )}

                {scanState === "success" && (
                  <motion.div key="success" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="flex flex-col items-center text-center space-y-3 sm:space-y-5">
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border"
                      style={{ backgroundColor: TONE.brand.bg, borderColor: TONE.brand.border }}
                    >
                      <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: COLORS.brand }} />
                    </motion.div>

                    <div>
                      <h2 className="font-medium text-[17px] sm:text-[20px]" style={{ color: COLORS.ink }}>Ready to Go</h2>
                      <p className="text-[12px] sm:text-[13px] mt-1.5 sm:mt-2 px-3 sm:px-5 py-2 rounded-lg border font-medium" style={{ color: COLORS.brand, backgroundColor: TONE.brand.bg, borderColor: TONE.brand.border }}>{statusMessage}</p>
                    </div>

                    {qrData && qrData.data_url ? (
                      <div className="scale-90 sm:scale-100 origin-top flex flex-col items-center">
                        <img src={qrData.data_url} alt="Wristband QR" className="w-40 h-40 sm:w-48 sm:h-48" />
                        <p className="mt-2 text-[11px] font-semibold tracking-wide" style={{ color: COLORS.ink }}>{qrData.qr_identifier}</p>
                      </div>
                    ) : wristband ? (
                      <div className="text-[12px] font-medium px-3 py-2 rounded-lg border" style={{ color: COLORS.ink, borderColor: COLORS.line }}>{wristband}</div>
                    ) : null}

                    {profile && (
                      <p className="text-[11px] sm:text-[12px]" style={{ color: COLORS.muted }}>Registered: <span className="font-semibold" style={{ color: COLORS.ink }}>{profile.full_name}</span></p>
                    )}

                    {profile && profile.fingerprint_slot != null ? (
                      <Chip tone="brand"><Fingerprint className="w-3.5 h-3.5" /> Fingerprint on slot #{profile.fingerprint_slot}</Chip>
                    ) : (
                      <Chip tone="warning"><AlertTriangle className="w-3.5 h-3.5" /> No fingerprint on file</Chip>
                    )}

                    {qosInfo && (
                      <div className="text-[10px] sm:text-[11px] font-medium flex items-center gap-1.5" style={{ color: COLORS.muted }}>
                        <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Syncing to cloud (QoS {qosInfo.final_qos})
                      </div>
                    )}

                    <Button onClick={reset} className="w-full sm:w-auto">Process Next Person</Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        </div>

        {/* ================= LIVE SENSOR FEED ================= */}
        <Card className="p-4 sm:p-5">
          <button
            onClick={() => setShowFeed((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2.5 sm:gap-3">
              <IconTile icon={Activity} />
              <div>
                <h2 className="text-[13.5px] sm:text-[14px] font-semibold" style={{ color: COLORS.ink }}>Live Sensor Feed</h2>
                <p className="text-[10.5px] sm:text-[11px]" style={{ color: COLORS.muted }}>
                  {deviceLog.length === 0
                    ? "Nothing received from the scanner yet"
                    : `${deviceLog.length} raw event${deviceLog.length === 1 ? "" : "s"} from the hardware`}
                </p>
              </div>
            </div>
            <span className="text-[11.5px] font-semibold" style={{ color: COLORS.brand }}>
              {showFeed ? "Hide" : "Show"}
            </span>
          </button>

          {showFeed && (
            <div className="mt-4 space-y-2">
              <div
                className="rounded-lg p-3 text-[11.5px] leading-relaxed max-h-56 overflow-y-auto"
                style={{ backgroundColor: "#0F1720", color: "#7EE2B8" }}
              >
                {deviceLog.length === 0 ? (
                  <div style={{ color: "#64748B" }}>
                    &gt; waiting for the scanner… touch the pad or press Initiate Scan
                  </div>
                ) : (
                  deviceLog.map((entry, i) => (
                    <div key={`${entry.at}-${i}`}>
                      <span style={{ color: "#64748B" }}>{entry.at} </span>
                      {entry.raw}
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px]" style={{ color: COLORS.muted }}>
                  Exactly what the firmware sent, before interpretation — use it to confirm the sensor is talking.
                </p>
                {deviceLog.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setDeviceLog([])}>Clear</Button>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* ================= REGISTERED USERS TABLE ================= */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} >
          <Card className="p-4 sm:p-5 lg:p-6 bg-white" >
            {viewingPersonId ? (
              <PersonProfileScreen personId={viewingPersonId} onBack={() => { setViewingPersonId(null); fetchPersons(); }} onUpdated={() => fetchPersons()} />
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 sm:mb-4 ">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <IconTile icon={List} />
                    <div>
                      <h2 className="text-[13.5px] sm:text-[14px] font-semibold" style={{ color: COLORS.ink }}>Registered Users</h2>
                      <p className="text-[10.5px] sm:text-[11px]" style={{ color: COLORS.muted }}>{persons.length} total in camp</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={fetchPersons}>
                    <span className="hidden sm:inline">Refresh</span>
                    <RefreshCw className="w-3.5 h-3.5 sm:hidden" />
                  </Button>
                </div>

                {personsError && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1"><InlineBanner tone="danger">{personsError}</InlineBanner></div>
                    <Button variant="secondary" size="sm" onClick={fetchPersons}><RefreshCw className="w-3 h-3" /> Retry</Button>
                  </div>
                )}

                <DataTable
                  columns={[
                    {
                      key: "full_name", label: "Name",
                      render: (val) => (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={val} size="sm" />
                          <span className="font-medium" style={{ color: COLORS.ink }}>{val}</span>
                        </div>
                      ),
                    },
                    { key: "age", label: "Age" },
                    { key: "gender", label: "Gender", render: (val) => (val === "M" ? "Male" : val === "F" ? "Female" : "Other") },
                    {
                      key: "person_type", label: "Type",
                      render: (val) => <Chip>{val?.replace(/_/g, " ") || "—"}</Chip>,
                    },
                    { key: "family_size", label: "Family" },
                    { key: "wristband_barcode", label: "Wristband", render: (val) => <span className="text-[12px]">{val || "—"}</span> },
                    {
                      key: "fingerprint_slot", label: "Fingerprint",
                      render: (val) => (val != null
                        ? <Chip tone="brand"><Fingerprint className="w-3 h-3" /> #{val}</Chip>
                        : <Chip tone="warning"><AlertTriangle className="w-3 h-3" /> Not enrolled</Chip>),
                    },
                    {
                      key: "pre_registered", label: "Status",
                      render: (val) => <Chip tone={val ? "brand" : "info"}>{val ? "Pre-registered" : "New"}</Chip>,
                    },
                    {
                      key: "created_at", label: "Registered",
                      render: (val) => (val ? new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"),
                    },
                  ]}
                  data={persons}
                  loading={personsLoading}
                  searchPlaceholder="Search by name or fingerprint ID..."
                  searchKeys={["full_name", "fingerprint_id"]}
                  filters={[
                    {
                      key: "enrollment_status", label: "All Fingerprints",
                      options: [
                        { value: "not_enrolled", label: "Not enrolled" },
                        { value: "enrolled", label: "Enrolled" },
                      ],
                    },
                    {
                      key: "person_type", label: "All Types",
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
                      <Avatar name={row.full_name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold truncate" style={{ color: COLORS.ink }}>{row.full_name}</span>
                          <Chip tone={row.pre_registered ? "brand" : "info"}>{row.pre_registered ? "Pre" : "New"}</Chip>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: COLORS.muted }}>
                          <span>{row.age}y · {row.gender === "M" ? "M" : row.gender === "F" ? "F" : "O"}</span>
                          <span style={{ color: COLORS.line }}>·</span>
                          <span className="capitalize">{row.person_type?.replace(/_/g, " ")}</span>
                          <span style={{ color: COLORS.line }}>·</span>
                          <span>Fam: {row.family_size}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {row.wristband_barcode && <span className="text-[10px]" style={{ color: COLORS.muted }}>{row.wristband_barcode}</span>}
                          {row.fingerprint_slot == null && (
                            <span className="text-[10px] font-semibold" style={{ color: TONE.warning.color }}>No fingerprint</span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 shrink-0" style={{ color: COLORS.muted }} />
                    </div>
                  )}
                />
              </>
            )}
          </Card>
        </motion.div>

        <ConfirmDialog
          open={showReenrollConfirm}
          onCancel={() => setShowReenrollConfirm(false)}
          onConfirm={() => { setShowReenrollConfirm(false); handleReenroll(); }}
          title="Re-enroll Fingerprint?"
          message="The sensor will capture a new template and bind it to this person, replacing any existing fingerprint link."
          confirmLabel="Re-enroll"
          variant="warning"
        />

        <QrCardModal data={qrData} onClose={() => setQrData(null)} />
      </div>
    </div>
  );
}

export default RegistrationScreen;