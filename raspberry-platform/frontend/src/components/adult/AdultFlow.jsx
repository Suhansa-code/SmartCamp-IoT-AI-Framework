import { useState } from "react";
import { COLORS } from "../../lib/tokens";
import AdultLoginPage from "./AdultLoginPage";
import AdultResourcesPage from "./AdultResourcesPage";
import AdultGuidancePage from "./AdultGuidancePage";
import { Package, Compass, LogOut, ScanLine } from "lucide-react";

/* ------------------------------------------------------------------
 *  AdultFlow — the /adult kiosk flow (mirrors ChildFlow).
 *
 *  Hard gate: no session (i.e. no QR scanned AND validated against the
 *  local DB) means ONLY the login page renders — the two inner pages
 *  are unreachable. Nothing is persisted, so a reload always restarts
 *  at the login gate.
 *
 *    login  →  resources (page 1)  ⇄  guidance (page 2)
 * ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { id: "resources", label: "My Resources", icon: Package },
  { id: "guidance", label: "Guidance", icon: Compass },
];

function AdultNav({ screen, onScreen, session, onExit }) {
  const person = session?.person || {};

  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur"
      style={{ borderColor: COLORS.line, backgroundColor: "rgba(255,255,255,0.92)" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: COLORS.brandSoft }}
          >
            <ScanLine className="w-4 h-4" style={{ color: COLORS.brand }} strokeWidth={2} />
          </div>
          <span className="text-[13px] font-semibold hidden sm:block" style={{ color: COLORS.ink }}>
            Adult Services
          </span>
        </div>

        {/* Segmented page switch */}
        <nav className="flex-1 flex justify-center">
          <div
            className="flex p-1 rounded-lg border"
            style={{ borderColor: COLORS.line, backgroundColor: COLORS.grid }}
          >
            {NAV_ITEMS.map((tab) => {
              const active = screen === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onScreen(tab.id)}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors"
                  style={{
                    color: active ? "#FFFFFF" : COLORS.body,
                    backgroundColor: active ? COLORS.brand : "transparent",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Person + exit */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[12px] font-medium max-w-[110px] truncate hidden sm:block"
            style={{ color: COLORS.muted }}
            title={person.full_name}
          >
            {person.full_name || ""}
          </span>
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold transition-opacity hover:opacity-70"
            style={{ borderColor: COLORS.line, color: COLORS.body }}
            title="Scan a different wristband"
          >
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      </div>
    </header>
  );
}

function AdultFlowContent() {
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState("resources");

  const handleLogin = (data) => {
    setSession(data);
    setScreen("resources");
  };

  const handleExit = () => {
    setSession(null);
    setScreen("resources");
  };

  // Gate — pages below never render without a validated session.
  if (!session) {
    return <AdultLoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      <AdultNav screen={screen} onScreen={setScreen} session={session} onExit={handleExit} />
      <main>
        {screen === "resources" && <AdultResourcesPage session={session} />}
        {screen === "guidance" && <AdultGuidancePage />}
      </main>
    </div>
  );
}

export default function AdultFlow() {
  return <AdultFlowContent />;
}
