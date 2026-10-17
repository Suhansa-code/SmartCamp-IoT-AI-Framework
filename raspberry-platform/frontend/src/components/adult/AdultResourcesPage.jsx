import { useEffect, useState } from "react";
import { API } from "../ui/config";
import { COLORS, TONE } from "../../lib/tokens";
import Card from "../ui/base/Card";
import SectionHeader from "../ui/base/SectionHeader";
import StatCard from "../ui/base/StatCard";
import { Coffee, Utensils, Moon, Droplets, Package, RefreshCw, AlertTriangle, Inbox } from "lucide-react";

/* ------------------------------------------------------------------
 *  AdultResourcesPage — page 1 of the Adult flow.
 *
 *  "My resources":  what this person has received / still has left
 *                   today — straight from the QR validation payload
 *                   (local DB, no network needed).
 *  "Available":     camp-wide stock from GET /api/resources/summary.
 *                   Cached in localStorage so the list still renders
 *                   offline (with a "saved copy" note).
 * ------------------------------------------------------------------ */

const INVENTORY_CACHE_KEY = "adult:inventory";

const MEAL_ICONS = { breakfast: Coffee, lunch: Utensils, dinner: Moon, water: Droplets };

function loadInventoryCache() {
  try {
    const raw = localStorage.getItem(INVENTORY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.resources) ? parsed : null;
  } catch {
    return null;
  }
}

export default function AdultResourcesPage({ session }) {
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState("");

  async function fetchInventory() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/resources/summary`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.resources)) {
        throw new Error(data?.message || "Stock list unavailable.");
      }
      setInventory(data.resources);
      setFromCache(false);
      const savedAtIso = new Date().toISOString();
      setSavedAt(savedAtIso);
      localStorage.setItem(
        INVENTORY_CACHE_KEY,
        JSON.stringify({ savedAt: savedAtIso, resources: data.resources }),
      );
    } catch {
      const cached = loadInventoryCache();
      if (cached) {
        setInventory(cached.resources);
        setFromCache(true);
        setSavedAt(cached.savedAt);
      } else {
        setInventory(null);
        setError("Camp stock list could not be loaded. Ask camp staff for today's availability.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInventory();
  }, []);

  const person = session?.person || {};
  const flags = session?.today_distributions || session?.today?.meals || {};
  const daily = Array.isArray(session?.daily) ? session.daily : [];
  const mealsGiven = ["breakfast", "lunch", "dinner"].filter((k) => flags[k]).length;
  const stillLeft = daily.filter((d) => !d.given).length;
  const todayItems = Array.isArray(session?.today?.resources) ? session.today.resources : [];
  const waterIssued = session?.water_issued ?? 0;
  const waterMax = session?.water_max ?? 4;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Greeting */}
      <div>
        <h1 className="text-[24px] sm:text-[28px] font-medium tracking-tight" style={{ color: COLORS.ink }}>
          {person.full_name || "Your resources"}
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: COLORS.muted }}>
          {session?.qr_identifier || session?.wristband?.qr_identifier || ""}
          {person.family_unit_id ? ` · Family ${person.family_unit_id}` : ""}
        </p>
      </div>

      {/* ── My resources today ─────────────────────────────────── */}
      <Card>
        <SectionHeader icon={Utensils} title="Your resources today" subtitle="Meals and water on your wristband" />

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Meals collected" value={`${mealsGiven} / 3`} icon={Utensils} accent="brand" />
          <StatCard label="Water issued" value={`${waterIssued} / ${waterMax} L`} icon={Droplets} accent="info" />
          <StatCard label="Still to collect" value={`${stillLeft} item${stillLeft === 1 ? "" : "s"}`} icon={Coffee} accent="warning" />
        </div>

        {/* Daily entitlement rows */}
        <div className="mt-5 space-y-2">
          {daily.map((item) => {
            const Icon = MEAL_ICONS[item.key] || Utensils;
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 px-3.5 py-3 rounded-lg border"
                style={{
                  borderColor: COLORS.line,
                  backgroundColor: item.given ? COLORS.grid : COLORS.surface,
                }}
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: item.given ? COLORS.brandSoft : COLORS.grid }}
                >
                  <Icon className="w-4 h-4" style={{ color: item.given ? COLORS.brand : COLORS.muted }} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>{item.label}</p>
                  <p className="text-[11.5px]" style={{ color: COLORS.muted }}>
                    Entitlement {item.quantity} {item.unit}
                  </p>
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={
                    item.given
                      ? { color: TONE.brand.color, backgroundColor: TONE.brand.bg }
                      : { color: TONE.warning.color, backgroundColor: TONE.warning.bg }
                  }
                >
                  {item.given ? "Collected" : `Left ${item.quantity} ${item.unit}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Itemised receipts today */}
        {todayItems.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: COLORS.muted }}>
              Received today
            </p>
            <div className="flex flex-wrap gap-2">
              {todayItems.map((row) => (
                <span
                  key={`${row.id ?? row.resource_name}-${row.time}`}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-full border"
                  style={{ borderColor: COLORS.line, color: COLORS.body, backgroundColor: COLORS.grid }}
                >
                  {row.resource_name} · {row.quantity} {row.unit}
                  {row.time ? ` · ${row.time}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Available at camp ──────────────────────────────────── */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <SectionHeader
              icon={Package}
              title="Available at the camp"
              subtitle={
                fromCache && savedAt
                  ? `Saved copy from ${new Date(savedAt).toLocaleString()}`
                  : "Stock available for distribution right now"
              }
            />
          </div>
          <button
            onClick={fetchInventory}
            disabled={loading}
            aria-label="Refresh stock list"
            className="p-2 rounded-lg border transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ borderColor: COLORS.line, color: COLORS.body }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !inventory && (
          <p className="text-[13px] py-6 text-center" style={{ color: COLORS.muted }}>Loading stock list…</p>
        )}

        {!loading && error && !inventory && (
          <div
            className="flex items-start gap-2 px-4 py-3 rounded-lg border text-[13px] font-medium"
            style={{ color: TONE.warning.color, backgroundColor: TONE.warning.bg, border: `1px solid ${TONE.warning.border}` }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {inventory && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {inventory.map((r) => (
                <div
                  key={r.id ?? r.resource_name}
                  className="rounded-lg border p-3"
                  style={{ borderColor: r.low_stock ? TONE.warning.border : COLORS.line, backgroundColor: COLORS.surface }}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[13.5px] font-semibold leading-tight" style={{ color: COLORS.ink }}>
                      {r.resource_name}
                    </p>
                    {r.low_stock && (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: TONE.warning.color }} />
                    )}
                  </div>
                  <p className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: COLORS.muted }}>
                    {r.category || "General"}
                  </p>
                  <p className="text-[20px] font-semibold leading-none" style={{ color: r.low_stock ? TONE.warning.color : COLORS.brand }}>
                    {r.available_quantity}
                    <span className="text-[11px] font-medium ml-1" style={{ color: COLORS.muted }}>
                      {r.unit}
                    </span>
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: COLORS.muted }}>
                    of {r.total_quantity} total
                  </p>
                </div>
              ))}
            </div>

            {inventory.length === 0 && (
              <div className="py-8 flex flex-col items-center gap-2" style={{ color: COLORS.muted }}>
                <Inbox className="w-6 h-6" />
                <p className="text-[13px]">No stock listed right now.</p>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
