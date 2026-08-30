import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanBarcode,
  Search,
  X,
  Check,
  AlertCircle,
  Activity,
  UserCircle2,
  Droplets,
  Utensils,
  Coffee,
  PackageCheck,
  BrainCircuit,
  Users,
  TrendingUp,
  Baby,
  Shield,
  FileText,
  PackagePlus,
  CalendarDays,
  Sparkles,
  RefreshCw,
  Camera,
  HeartPulse,
  AlertTriangle,
} from "lucide-react";
import { COLORS, SHADOW_CARD, TONE } from "../../lib/tokens";
import { API } from "../ui/config";
import QRScanner from "./QRScanner";

const STATUS = {
  success: { color: COLORS.brand, bg: COLORS.brandSoft, border: COLORS.brandMuted },
  error: { color: TONE.danger.color, bg: TONE.danger.bg, border: TONE.danger.border },
  pending: { color: TONE.warning.color, bg: TONE.warning.bg, border: TONE.warning.border },
  info: { color: TONE.info.color, bg: TONE.info.bg, border: TONE.info.border },
};

const TYPE_LABELS = {
  refugees: "Refugees",
  asylum_seekers: "Asylum Seekers",
  idps: "IDPs",
  returned_refugees: "Returned Refugees",
  returned_idps: "Returned IDPs",
  stateless: "Stateless",
  ooc: "Others of Concern",
};

const TABS = [
  { id: "distribute", label: "Distribution", icon: ScanBarcode },
  { id: "predict", label: "Prediction", icon: BrainCircuit },
];

const TAB_META = {
  distribute: { eyebrow: "Camp operations", title: "Distribution Hub", subtitle: "Scan wristbands to allocate daily resources safely" },
  predict: { eyebrow: "Camp operations", title: "Distribution Prediction", subtitle: "Resource allocation forecast, projected 7 days ahead" },
};

/* ------------------------------------------------------------------ */
/*  SHARED PRIMITIVES — match FloodWatch's IconTile / FieldBox / Chip   */
/* ------------------------------------------------------------------ */

function IconTile({ icon: Icon, color }) {
  return (
    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.hairline }}>
      <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" style={{ color: color || COLORS.body }} strokeWidth={1.6} />
    </div>
  );
}

function Chip({ children, tone = "neutral" }) {
  const styles =
    tone === "neutral"
      ? { color: COLORS.body, backgroundColor: "#F5F6F5", borderColor: COLORS.line }
      : { color: STATUS[tone].color, backgroundColor: STATUS[tone].bg, borderColor: STATUS[tone].border };
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide border" style={styles}>
      {children}
    </span>
  );
}

function Avatar({ name }) {
  const initials = (name || "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl flex items-center justify-center shrink-0 text-[22px] font-medium"
      style={{ backgroundColor: COLORS.brandSoft, color: COLORS.brand }}
    >
      {initials || <UserCircle2 className="w-7 h-7" />}
    </div>
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

/* ------------------------------------------------------------------ */
/*  TAB SWITCHER                                                        */
/* ------------------------------------------------------------------ */

function TabSwitcher({ active, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1 sm:flex sm:items-center rounded-lg border p-1 shrink-0" style={{ borderColor: COLORS.line }}>
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="relative flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-md text-[12px] sm:text-[12.5px] font-semibold transition-colors"
            style={{ color: isActive ? COLORS.brand : COLORS.muted }}
          >
            {isActive && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-md"
                style={{ backgroundColor: `${COLORS.brand}12`, border: `1px solid ${COLORS.brand}33` }}
                transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              />
            )}
            <Icon className="w-3.5 h-3.5 relative z-10" strokeWidth={1.8} />
            <span className="relative z-10 ">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DISTRIBUTION TILE                                                   */
/* ------------------------------------------------------------------ */

function DistributionTile({ label, icon: Icon, item, onGive }) {
  const given = !!item?.given;
  const quantity = item?.quantity;
  const left = item?.left;
  const unit = item?.unit;
  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex flex-col items-center text-center transition-colors"
      style={{
        backgroundColor: given ? COLORS.brandSoft : COLORS.grid,
      }}
    >
      <div
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mb-3"
        style={{
          backgroundColor: given ? COLORS.surface : COLORS.brandSoft,
        }}
      >
        <Icon className="w-5 h-5" style={{ color: COLORS.brand }} strokeWidth={1.7} />
      </div>
      <p className="text-[13px] sm:text-[13px] font-medium mb-2" style={{ color: COLORS.ink }}>
        {label}
      </p>

      {given && <p className="text-[11px] mb-3" style={{ color: COLORS.muted }}>0 left today</p>}
      <div className="mt-auto w-full">
        {given ? (
          <div
            className="flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2 rounded-lg border"
            style={{ color: COLORS.brand, borderColor: `${COLORS.brand}33`, backgroundColor: "#fff" }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2} /> Allocated
          </div>
        ) : (
          <PrimaryButton onClick={onGive} className="w-full">
            Distribute
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DISTRIBUTION PANEL                                                  */
/* ------------------------------------------------------------------ */

const DAILY_DEFAULTS = [
  { key: "breakfast", label: "Breakfast", unit: "kg", quantity: 0.5 },
  { key: "lunch", label: "Lunch", unit: "kg", quantity: 0.6 },
  { key: "dinner", label: "Dinner", unit: "kg", quantity: 0.5 },
  { key: "water", label: "Water", unit: "L", quantity: 15 },
];

const DAILY_EXTRAS = { breakfast: 0.2, lunch: 0.2, dinner: 0.2, water: 2 };

function todayStatusToDaily(person, flags = {}) {
  return DAILY_DEFAULTS.map((d) => {
    const quantity = person?.is_pregnant === 1 ? d.quantity + (DAILY_EXTRAS[d.key] || 0) : d.quantity;
    const given = Boolean(flags[d.key]);
    return { ...d, quantity, given, left: given ? 0 : quantity };
  });
}

async function resolveWristband(raw) {
  let res = await fetch(`${API}/api/qr/${encodeURIComponent(raw)}`);
  let data = await res.json();
  if (data && (data.success === false || data.message || !data.person)) {
    res = await fetch(`${API}/api/wristband/${encodeURIComponent(raw)}`);
    data = await res.json();
  }
  return data;
}

function DistributionPanel() {
  const [barcode, setBarcode] = useState("");
  const [profile, setProfile] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [daily, setDaily] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("error");
  const [qosInfo, setQosInfo] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const applyLookup = (data, raw) => {
    const person = data.person;
    if (!person) {
      setStatusMessage(data.message || data.error || "No profile found for this code.");
      setStatusType("error");
      setProfile(null);
      setTodayStatus(null);
      setDaily(null);
      return;
    }
    const flags = data.today_distributions || data.today?.meals || {};
    setProfile(person);
    setTodayStatus(flags);
    setDaily(data.daily || todayStatusToDaily(person, flags));
    setBarcode(data.wristband?.wristband_id || raw || person.wristband_barcode || "");
    setStatusMessage("");
    setQosInfo(null);
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    setIsScanning(true);
    try {
      const data = await resolveWristband(barcode.trim());
      setTimeout(() => {
        setIsScanning(false);
        if (data.error || data.success === false || !data.person) {
          setStatusMessage(data.message || data.error || "Not found.");
          setStatusType("error");
          setProfile(null);
          setTodayStatus(null);
          setDaily(null);
          return;
        }
        applyLookup(data, barcode.trim());
      }, 600);
    } catch (err) {
      setIsScanning(false);
      setStatusMessage("Lookup failed: " + err.message);
      setStatusType("error");
    }
  };

  const handleQrScan = async (value) => {
    setScannerOpen(false);
    const raw = (value || "").trim();
    if (!raw) return;
    setIsScanning(true);
    try {
      const data = await resolveWristband(raw);
      setTimeout(() => {
        setIsScanning(false);
        if (data.error || data.success === false || !data.person) {
          setStatusMessage(data.message || data.error || "QR code not recognized.");
          setStatusType("error");
          setProfile(null);
          setTodayStatus(null);
          setDaily(null);
          return;
        }
        applyLookup(data, raw);
      }, 600);
    } catch (err) {
      setIsScanning(false);
      setStatusMessage("Lookup failed: " + err.message);
      setStatusType("error");
    }
  };

  const handleDistribute = async (resourceType) => {
    try {
      const res = await fetch(`${API}/api/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, resource_type: resourceType }),
      });
      const data = await res.json();
      if (data.error) {
        setStatusMessage(data.error);
        setStatusType("error");
        return;
      }
      const flags = data.today_distributions || {};
      setTodayStatus(flags);
      setDaily((prev) =>
        (prev || todayStatusToDaily(profile, flags)).map((item) => ({
          ...item,
          given: Boolean(flags[item.key]),
          left: flags[item.key] ? 0 : item.quantity,
        }))
      );
      setQosInfo(data.mqtt);
      setStatusMessage(`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} distributed successfully.`);
      setStatusType("success");
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (err) {
      setStatusMessage("Distribution failed: " + err.message);
      setStatusType("error");
    }
  };

  const handleReset = () => {
    setBarcode("");
    setProfile(null);
    setTodayStatus(null);
    setDaily(null);
    setStatusMessage("");
    setQosInfo(null);
    setScannerOpen(false);
  };

  const priorityTone = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "success";
      case "medium":
        return "info";
      default:
        return "neutral";
    }
  };

  const dailyMap = {};
  (daily || []).forEach((d) => {
    dailyMap[d.key] = d;
  });
  const foodItems = (daily || []).filter((d) => d.key !== "water");
  const foodEntitlement = foodItems.reduce((sum, d) => sum + (d.quantity || 0), 0);
  const foodLeft = foodItems.reduce((sum, d) => sum + (d.left || 0), 0);
  const waterItem = dailyMap.water;

  return (
    <div className="space-y-4 sm:space-y-6">
      {scannerOpen ? (
        <QRScanner onScan={handleQrScan} onCancel={() => setScannerOpen(false)} />
      ) : (
        <>
          {/* Barcode lookup */}
          <form onSubmit={handleScan} className="rounded-xl border p-4 sm:p-6" style={{ borderColor: COLORS.line }}>
            <p className="text-[11px] uppercase tracking-[0.1em] mb-3" style={{ color: COLORS.muted }}>
              Wristband barcode
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                  <Search className="w-4 h-4" style={{ color: isScanning ? COLORS.brand : COLORS.muted }} />
                </div>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or type barcode (e.g. WB000001)"
                  autoFocus
                  className="w-full pl-10 pr-11 py-2.5 rounded-lg border text-[13px] font-medium focus:outline-none transition-colors"
                  style={{ borderColor: COLORS.line, color: COLORS.ink, backgroundColor: "#FAFAF9" }}
                />
                <AnimatePresence>
                  {barcode && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      type="button"
                      onClick={handleReset}
                      className="absolute inset-y-0 right-3 flex items-center justify-center"
                      aria-label="Clear barcode"
                    >
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "#EFEFEE", color: COLORS.body }}>
                        <X className="w-3 h-3" />
                      </div>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex gap-2">
                <PrimaryButton type="submit" loading={isScanning} loadingText="Looking up" disabled={!barcode.trim()} className="sm:w-auto">
                  Lookup
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold py-2.5 px-4 border transition-colors hover:opacity-80"
                  style={{ borderColor: COLORS.line, color: COLORS.brand, backgroundColor: "#fff" }}
                >
                  <Camera className="w-3.5 h-3.5" strokeWidth={2} /> Scan QR
                </button>
              </div>
            </div>
            <p className="mt-2.5 text-[11px]" style={{ color: COLORS.muted }}>
              Scanned QR codes are resolved automatically — profile and daily availability are shown instantly.
            </p>
          </form>
        </>
      )}

      {/* Standalone status (no profile yet) */}
      <AnimatePresence mode="wait">
        {statusMessage && !profile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-lg border text-[13px] font-medium"
              style={{ color: STATUS.error.color, backgroundColor: STATUS.error.bg, borderColor: STATUS.error.border }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {statusMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile + distribution */}
      <AnimatePresence>
        {profile && todayStatus && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-4 sm:space-y-6"
          >
            <div className="rounded-xl border p-4 sm:p-6 relative" style={{ borderColor: COLORS.line }}>
              <div className="flex flex-row items-center sm:items-start gap-2 sm:gap-5">
                <Avatar name={profile.full_name} />
                <div className="flex-1 text-left">
                  <p className="font-medium text-[19px] sm:text-[20px] tracking-tight" style={{ color: COLORS.ink }}>
                    {profile.full_name}
                  </p>
                  <div className="flex flex-wrap items-center justify-start gap-1.5 mt-2.5">
                    <Chip>Age {profile.age}</Chip>
                    
                    <Chip tone="success">
                      <UserCircle2 className="w-3 h-3" /> Family {profile.family_unit_id}
                    </Chip>
                    <Chip>{profile.gender}</Chip>
                    <button
                      onClick={async () => {
                        setQrLoading(true);
                        try {
                          const id = encodeURIComponent(barcode || profile.wristband_barcode || '');
                          const res = await fetch(`${API}/api/wristbands/${id}/qrcode`);
                          const data = await res.json();
                          if (data.success && data.data_url) {
                            setQrDataUrl(data.data_url);
                            setQrVisible(true);
                          }
                        } catch (e) {
                          // ignore silently
                        } finally {
                          setQrLoading(false);
                        }
                      }}
                      className="ml-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-[12px] font-semibold"
                      style={{ borderColor: COLORS.line }}
                    >
                      {qrLoading ? 'Loading…' : 'Show QR'}
                    </button>
                  </div>
                </div>
              </div>

              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 sm:mt-0 sm:absolute sm:top-4 sm:right-4 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold"
                  style={{
                    color: STATUS[statusType].color,
                    backgroundColor: STATUS[statusType].bg,
                    borderColor: STATUS[statusType].border,
                  }}
                >
                  {statusType === "error" ? <AlertCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  {statusMessage}
                </motion.div>
              )}
            </div>

            {/* Health status */}
            {(profile.is_pregnant === 1 || profile.has_chronic_illness === 1 || profile.medical_notes) && (
              <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: COLORS.line }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <HeartPulse className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                  <span className="text-[11px] uppercase tracking-[0.1em]" style={{ color: COLORS.muted }}>
                    Health status
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.is_pregnant === 1 && <Chip tone="info"><Baby className="w-3 h-3" /> Pregnant</Chip>}
                  {profile.has_chronic_illness === 1 && <Chip tone="pending"><AlertTriangle className="w-3 h-3" /> Chronic illness</Chip>}
                </div>
                {profile.medical_notes && (
                  <p className="text-[12.5px] mt-2" style={{ color: COLORS.body }}>{profile.medical_notes}</p>
                )}
              </div>
            )}

            {/* Daily availability left */}
            <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: COLORS.line }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Droplets className="w-3.5 h-3.5" style={{ color: COLORS.brand }} />
                  <span className="text-[11px] uppercase tracking-[0.1em]" style={{ color: COLORS.muted }}>
                    Daily availability left
                  </span>
                </div>

              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                <DistributionTile
                  label="Breakfast"
                  icon={Coffee}
                  item={dailyMap.breakfast}
                  onGive={() => handleDistribute("breakfast")}
                />
                <DistributionTile label="Lunch" icon={Utensils} item={dailyMap.lunch} onGive={() => handleDistribute("lunch")} />
                <DistributionTile
                  label="Dinner"
                  icon={Utensils}
                  item={dailyMap.dinner}
                  onGive={() => handleDistribute("dinner")}
                />
                <DistributionTile label="Water" icon={Droplets} item={dailyMap.water} onGive={() => handleDistribute("water")} />
              </div>
            </div>

            {qosInfo && (
              <div className="rounded-xl border p-4 sm:p-5 flex flex-wrap items-center gap-2" style={{ borderColor: COLORS.line }}>
                <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] mr-1" style={{ color: COLORS.muted }}>
                  <Activity className="w-3.5 h-3.5" style={{ color: COLORS.brand }} /> MQTT sync
                </span>
                <Chip tone={priorityTone(qosInfo.priority)}>Priority: {qosInfo.priority}</Chip>
                <Chip>QoS {qosInfo.final_qos}</Chip>
                <Chip>Net: {qosInfo.network_state}</Chip>
                <Chip tone={qosInfo.published ? "success" : "neutral"}>
                  {qosInfo.published ? (
                    <>
                      <PackageCheck className="w-3 h-3" /> Published
                    </>
                  ) : (
                    "Buffered locally"
                  )}
                  {/* QR Modal */}
                  {qrVisible && qrDataUrl && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/50" onClick={() => setQrVisible(false)} />
                      <div className="relative bg-white rounded-lg p-4 max-w-sm w-full" style={{ boxShadow: SHADOW_CARD }}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">Wristband QR</h3>
                          <button onClick={() => setQrVisible(false)} className="text-sm">Close</button>
                        </div>
                        <div className="flex items-center justify-center">
                          <img src={qrDataUrl} alt="wristband-qr" style={{ width: 240, height: 240 }} />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <a href={qrDataUrl} download={`qr-${barcode || 'wristband'}.png`} className="text-sm font-semibold" style={{ color: COLORS.brand }}>Download PNG</a>
                          <button onClick={() => setQrVisible(false)} className="text-sm">Done</button>
                        </div>
                      </div>
                    </div>
                  )}
                </Chip>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  STAT TILE — FieldBox-style card used for demographic figures        */
/* ------------------------------------------------------------------ */

function StatTile({ label, value, unit, icon: Icon }) {
  return (
    <div className="rounded-lg border p-3.5" style={{ borderColor: COLORS.line }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] uppercase tracking-[0.06em]" style={{ color: COLORS.muted }}>
          {label}
        </span>
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: COLORS.chip }} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FORECAST ROW                                                        */
/* ------------------------------------------------------------------ */

function ForecastRow({ row, isToday, index }) {
  const r = row.result;
  const pop = row.projected_population;
  const dateObj = new Date(row.date + "T00:00:00");
  const dayName = isToday ? "Today" : dateObj.toLocaleDateString("en-US", { weekday: "short" });
  const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 + 0.15 }}
      style={{ borderColor: COLORS.hairline, backgroundColor: isToday ? `${COLORS.brand}0A` : "transparent" }}
      className="border-t"
    >
      <td className="px-4 sm:px-5 py-3.5">
        <p className="text-[10.5px] " style={{ color: COLORS.muted }}>
        </p>
      </td>
      <td className="px-4 sm:px-5 py-3.5">
        <Chip>{pop?.toLocaleString() ?? "—"}</Chip>
      </td>
      {r ? (
        <>
          <td className="px-4 sm:px-5 py-3.5 text-[12.5px] font-semibold" style={{ color: "#B45309" }}>
            {r.food_kg_day?.toLocaleString()}
          </td>
          <td className="px-4 sm:px-5 py-3.5 text-[12.5px] font-semibold" style={{ color: "#0284C7" }}>
            {r.water_liters_day?.toLocaleString()}
          </td>
        </>
      ) : (
        <td colSpan={2} className="px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2 text-[12.5px] italic" style={{ color: COLORS.muted }}>
            <Activity className="w-3.5 h-3.5 animate-pulse" /> Computing…
          </div>
        </td>
      )}
    </motion.tr>
  );
}

/* ------------------------------------------------------------------ */
/*  PREDICTION PANEL                                                    */
/* ------------------------------------------------------------------ */

function PredictionPanel() {
  const [campData, setCampData] = useState(null);
  const [forecasts, setForecasts] = useState([]);
  const [reqStatus, setReqStatus] = useState("none");
  const [requestId, setRequestId] = useState(null);
  const [mqttInfo, setMqttInfo] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/prediction/inputs`)
      .then((r) => r.json())
      .then(setCampData)
      .catch(() => {});
    fetch(`${API}/api/prediction/results`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status !== "none") {
          setReqStatus(d.status);
          setRequestId(d.request_id);
          if (d.forecasts) setForecasts(d.forecasts);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!requestId || reqStatus === "complete" || reqStatus === "none") return;
    const interval = setInterval(() => {
      fetch(`${API}/api/prediction/results`)
        .then((r) => r.json())
        .then((d) => {
          if (d.request_id === requestId) {
            setReqStatus(d.status);
            if (d.forecasts) {
              setForecasts(d.forecasts);
              if (d.status === "complete") clearInterval(interval);
            }
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [requestId, reqStatus]);

  const handleForecast = useCallback(async () => {
    setLoading(true);
    setStatusMsg("");
    setMqttInfo(null);
    try {
      const res = await fetch(`${API}/api/prediction/forecast?days=7`);
      const data = await res.json();
      if (data.error) {
        setStatusMsg(data.error);
        return;
      }
      setRequestId(data.request_id);
      setReqStatus(data.status);
      setForecasts(data.forecasts || []);
      setMqttInfo(data.mqtt || null);
      setStatusMsg(data.message || (data.status === "complete" ? "" : "Forecast submitted"));
    } catch (e) {
      setStatusMsg("Failed: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {campData && (
        <div className="rounded-xl border p-4 sm:p-6" style={{ borderColor: COLORS.line }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <IconTile icon={Users} color={COLORS.brand} />
              <h2 className="text-[13.5px] sm:text-[14px] font-semibold" style={{ color: COLORS.ink }}>
                Live demographics
                <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: COLORS.muted }}>
                  Auto-synced
                </p>
              </h2>
            </div>
            <div className="hidden sm:flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <PrimaryButton onClick={handleForecast} loading={loading} loadingText="Synthesizing">
                  <Sparkles className="w-3.5 h-3.5" /> Generate 7-day forecast
                </PrimaryButton>
                <AnimatePresence mode="wait">
                  {statusMsg && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg"
                      style={{ color: COLORS.body, backgroundColor: "#F5F6F5" }}
                    >
                      {statusMsg}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {mqttInfo && (
                <div className="flex gap-1.5 flex-wrap">
                  <Chip>Priority: {mqttInfo.priority}</Chip>
                  <Chip tone={mqttInfo.published ? "success" : "pending"}>{mqttInfo.published ? "Published (MQTT)" : "Buffered local"}</Chip>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <StatTile label="Population" value={campData.total_population?.toLocaleString()} icon={Users} />
            <StatTile label="Daily arrival" value={campData.daily_arrival_rate} unit=" /day" icon={TrendingUp} />
            <StatTile label="Children" value={campData.children_ratio} icon={Baby} />
            <StatTile label="Female ratio" value={campData.female_ratio} icon={Users} />
            <StatTile label="Yearly arrivals" value={campData.yearly_arrivals?.toLocaleString()} icon={PackagePlus} />
            <StatTile label="Pregnant" value={campData.pregnant} icon={Activity} />
            <StatTile label="Chronic illness" value={campData.chronic_illness} icon={Shield} />
            <StatTile label="Elderly ratio" value={campData.elderly_ratio} icon={Users} />
          </div>

          <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t" style={{ borderColor: COLORS.hairline }}>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-3.5 h-3.5" style={{ color: COLORS.muted }} />
              <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: COLORS.muted }}>
                Category breakdown
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TYPE_LABELS).map(
                ([key, label]) =>
                  campData[key] > 0 && (
                    <Chip key={key} tone="success">
                      {label}: {campData[key].toLocaleString()}
                    </Chip>
                  ),
              )}
              {Object.keys(TYPE_LABELS).every((k) => !campData[k]) && (
                <span className="text-[12.5px] italic" style={{ color: COLORS.muted }}>
                  No category breakdown available.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <PrimaryButton onClick={handleForecast} loading={loading} loadingText="Synthesizing">
            <Sparkles className="w-3.5 h-3.5" /> Generate 7-day forecast
          </PrimaryButton>
          <AnimatePresence mode="wait">
            {statusMsg && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg"
                style={{ color: COLORS.body, backgroundColor: "#F5F6F5" }}
              >
                {statusMsg}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {mqttInfo && (
          <div className="flex gap-1.5 flex-wrap">
            <Chip>Priority: {mqttInfo.priority}</Chip>
            <Chip tone={mqttInfo.published ? "success" : "pending"}>{mqttInfo.published ? "Published (MQTT)" : "Buffered local"}</Chip>
          </div>
        )}
      </div>

      <AnimatePresence>
        {forecasts.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: COLORS.line }}>
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b flex items-center gap-3" style={{ borderColor: COLORS.hairline }}>
              <IconTile icon={CalendarDays} color={COLORS.brand} />
              <div>
                <h2 className="text-[13.5px] sm:text-[14px] font-semibold" style={{ color: COLORS.ink }}>
                  Forecast matrix
                </h2>
                <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.muted }}>
                  Population projected linearly. Resource ratios calculated dynamically via AI.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: COLORS.muted, backgroundColor: COLORS.grid }}
                  >
                    <th className="px-4 sm:px-5 py-3">Date</th>
                    <th className="px-4 sm:px-5 py-3">Est. pop.</th>
                    <th className="px-4 sm:px-5 py-3" style={{ color: "#B45309" }}>
                      Food kg/d
                    </th>
                    <th className="px-4 sm:px-5 py-3" style={{ color: "#0284C7" }}>
                      Water L/d
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map((row, i) => (
                    <ForecastRow key={row.date} row={row} isToday={i === 0} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function WristbandScanScreen() {
  const [activeTab, setActiveTab] = useState("distribute");
  const meta = TAB_META[activeTab];

  return (
    <div className="min-h-screen bg-white font-sans max-w-7xl mx-auto" style={{ color: COLORS.ink }}>
      <div className="sm:px-5 lg:px-6">
        {/* ================= TITLE ROW ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-2 sm:py-7">
          <div>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.muted }}>
              {meta.eyebrow}
            </p>
            <div className="flex items-center gap-3 flex-wrap mt-1.5">
              <AnimatePresence mode="wait">
                <motion.h1
                  key={meta.title}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="font-medium text-[26px] sm:text-[32px] lg:text-[36px] leading-[1.1] tracking-tight"
                >
                  {meta.title}
                </motion.h1>
              </AnimatePresence>
            </div>
            <p className="text-[12px] mt-2" style={{ color: COLORS.muted }}>
              {meta.subtitle}
            </p>
          </div>
          <TabSwitcher active={activeTab} onChange={setActiveTab} />
        </div>
        {/* ================= CONTENT ================= */}
        <div className="pb-6 sm:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "distribute" ? <DistributionPanel /> : <PredictionPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
