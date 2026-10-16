import { useState } from "react";
import { API } from "../ui/config";
import { COLORS } from "../../lib/tokens";
import QRScanner from "../resources/QRScanner";
import { ScanLine, AlertCircle, Loader2, Keyboard } from "lucide-react";

/* ------------------------------------------------------------------
 *  AdultLoginPage — the only gate into the Adult flow.
 *
 *  A wristband QR must be scanned and validated against the LOCAL
 *  database (GET /api/qr/:code resolves QR → wristband → active person
 *  in camp.db) before the flow grants access. Nothing is persisted, so
 *  a reload always lands back on this screen.
 * ------------------------------------------------------------------ */

/** QR may be a plain wristband code or an encoded JSON payload. */
function extractQrCode(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { error: "The scanned code is empty. Try again." };
  try {
    const payload = JSON.parse(trimmed);
    if (payload?.type === "child") {
      return { error: "That code belongs to the children's programme. Please scan your wristband." };
    }
    const code = payload?.qr_identifier || payload?.barcode || payload?.qr || payload?.value;
    if (typeof code === "string" && code.trim()) return { code: code.trim() };
  } catch {
    /* printed wristband codes are plain text */
  }
  return { code: trimmed };
}

/** Validate the code against the local DB. Rejects unless a person resolves. */
async function validateWithLocalDb(code) {
  const res = await fetch(`${API}/api/qr/${encodeURIComponent(code)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.person) {
    throw new Error(data?.message || data?.error || "This QR code is not valid. Please see camp staff.");
  }
  return data;
}

export default function AdultLoginPage({ onLogin }) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  async function handleCode(raw) {
    setScannerOpen(false);
    setErrorMsg("");

    const { code, error } = extractQrCode(raw);
    if (error) {
      setErrorMsg(error);
      return;
    }

    setValidating(true);
    try {
      const session = await validateWithLocalDb(code);
      if (typeof onLogin === "function") onLogin(session);
    } catch (err) {
      setErrorMsg(err?.message || "This QR code is not valid. Please see camp staff.");
    } finally {
      setValidating(false);
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (!manualCode.trim() || validating) return;
    handleCode(manualCode.trim());
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ backgroundColor: COLORS.background }}
    >
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-7">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ backgroundColor: COLORS.brandSoft }}
          >
            <ScanLine className="w-7 h-7" style={{ color: COLORS.brand }} strokeWidth={1.8} />
          </div>
          <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight" style={{ color: COLORS.ink }}>
            Adult Services
          </h1>
          <p className="text-[14px] mt-1.5" style={{ color: COLORS.body }}>
            Scan your wristband QR code to continue
          </p>
        </div>

        {/* Validating */}
        {validating && (
          <div
            className="rounded-xl border p-6 flex items-center justify-center gap-3"
            style={{ borderColor: COLORS.line, backgroundColor: COLORS.surface }}
          >
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: COLORS.brand }} />
            <p className="text-[14px] font-medium" style={{ color: COLORS.body }}>
              Checking your wristband…
            </p>
          </div>
        )}

        {/* Scanner */}
        {!validating && scannerOpen && (
          <QRScanner onScan={handleCode} onCancel={() => setScannerOpen(false)} />
        )}

        {/* Idle */}
        {!validating && !scannerOpen && (
          <div className="rounded-xl border p-6" style={{ borderColor: COLORS.line, backgroundColor: COLORS.surface }}>
            <button
              onClick={() => { setErrorMsg(""); setScannerOpen(true); }}
              className="w-full rounded-xl flex items-center justify-center gap-3 font-semibold text-white text-[17px] transition-transform active:scale-[0.99]"
              style={{ backgroundColor: COLORS.brand, minHeight: 72 }}
            >
              <ScanLine className="w-6 h-6" strokeWidth={2} />
              Scan QR to enter
            </button>

            {/* Manual entry fallback (camera unavailable) */}
            <div className="mt-4">
              {!manualOpen ? (
                <button
                  onClick={() => setManualOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-[13px] font-medium"
                  style={{ color: COLORS.muted }}
                >
                  <Keyboard className="w-3.5 h-3.5" /> No camera? Type your wristband code
                </button>
              ) : (
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. CAMP-WB-0001"
                    autoFocus
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border text-sm bg-white"
                    style={{ borderColor: COLORS.line, color: COLORS.ink }}
                  />
                  <button
                    type="submit"
                    disabled={!manualCode.trim()}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: COLORS.brand }}
                  >
                    Enter
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {!validating && errorMsg && (
          <div
            className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl border text-[13.5px] font-medium"
            style={{ color: "#991B1B", backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {errorMsg}
          </div>
        )}

        <p className="text-center text-[12px] mt-6" style={{ color: COLORS.muted }}>
          Your wristband is your key — it is checked against the camp system before entry.
        </p>
      </div>
    </div>
  );
}
