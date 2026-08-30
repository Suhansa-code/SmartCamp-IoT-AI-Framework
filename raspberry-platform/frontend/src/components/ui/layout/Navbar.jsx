import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useRouter } from "../../../lib/router";
import { useAuth } from "../../../lib/AuthContext";
import {
  LayoutDashboard,
  Fingerprint,
  ScanBarcode,
  BrainCircuit,
  Activity,
  Map,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Radar,
  Layers,
  Cpu,
} from "lucide-react";
import { COLORS } from "../../../lib/tokens";
import { API } from "../config";

const tabs = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: LayoutDashboard },
  { id: "registration", label: "Registration", path: "/registration", icon: Fingerprint },
  { id: "wristband", label: "Distribution", path: "/wristband", icon: ScanBarcode },
  { id: "wristbands", label: "Wristbands", path: "/wristbands", icon: Layers },
  { id: "educationscreen", label: "Education", path: "/educationscreen", icon: BrainCircuit },
  { id: "network", label: "Network", path: "/network", icon: Activity },
  { id: "disaster", label: "Disaster", path: "/disaster", icon: Map },
];

const itemVariants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0 },
};

function NavLink({ tab, active }) {
  const Icon = tab.icon;
  return (
    <Link
      to={tab.path}
      aria-label={`Navigate to ${tab.label}`}
      className="relative flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md outline-none transition-colors duration-150"
      style={{ color: active ? COLORS.brand : COLORS.muted }}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-md"
          style={{ backgroundColor: COLORS.brandSoft }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
        />
      )}
      <Icon className="w-3.5 h-3.5 relative z-10" strokeWidth={active ? 1.8 : 1.5} />
      <span className="relative z-10">{tab.label}</span>
    </Link>
  );
}

function MobileNavLink({ tab, active, onClick }) {
  const Icon = tab.icon;
  return (
    <motion.div variants={itemVariants}>
      <Link
        to={tab.path}
        onClick={onClick}
        aria-label={`Navigate to ${tab.label}`}
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 outline-none"
        style={
          active
            ? { backgroundColor: COLORS.brandSoft, color: COLORS.brand }
            : { color: COLORS.body }
        }
      >
        <Icon className="w-4 h-4" style={{ color: active ? COLORS.brand : COLORS.muted }} strokeWidth={1.5} />
        {tab.label}
      </Link>
    </motion.div>
  );
}

export default function Navbar() {
  const { path, navigate } = useRouter();
  const { isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);
  const [disconnectedCount, setDisconnectedCount] = useState(0);

  const fetchDeviceStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/disaster/device-status`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const data = await res.json();
      const device = data.device || {};
      const sensors = data.sensors || {};
      const connected = [
        device.status === 'connected',
        !!sensors.gps?.connected,
        !!sensors.temperature?.connected,
        !!sensors.humidity?.connected,
        !!sensors.rainfall?.connected,
        !!sensors.fingerprint?.connected,
      ];
      const total = connected.length;
      const allConnected = connected.filter(Boolean).length;
      setDisconnectedCount(total - allConnected);
    } catch {
      setDisconnectedCount(6);
    }
  }, [API]);

  useEffect(() => {
    fetchDeviceStatus();
    const id = setInterval(fetchDeviceStatus, 10000);
    return () => clearInterval(id);
  }, [fetchDeviceStatus]);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 w-full">
      <nav className="bg-white/90 backdrop-blur-lg" style={{ borderBottom: `1px solid ${COLORS.line}` }} aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-12">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2"
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: COLORS.brand }}>
                <Radar className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
              </div>
              <span className="font-medium text-[14px] tracking-tight" style={{ color: COLORS.ink }}>
                SmartCamp
              </span>
            </motion.div>

            <div className="hidden lg:flex items-center gap-0.5">
              {tabs.map((tab) => (
                <NavLink key={tab.id} tab={tab} active={path === tab.path} />
              ))}

              <div className="w-px h-4 mx-2" style={{ backgroundColor: COLORS.line }} />

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
                {isAuthenticated ? (
                  <button
                    onClick={() => { logout(); navigate("/authorize"); }}
                    aria-label="Deauthorize session"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md outline-none transition-colors duration-150"
                    style={{ color: COLORS.brand }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Authorized</span>
                  </button>
                ) : (
                  <Link
                    to="/authorize"
                    aria-label="Authorize access"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md outline-none transition-colors duration-150"
                    style={{ color: COLORS.muted }}
                  >
                    <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Authorize</span>
                  </Link>
                )}
              </motion.div>

              <Link
                to="/devices"
                aria-label="View connected devices"
                className="relative flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-150"
                style={{ color: COLORS.muted }}
              >
                <Cpu className="w-4 h-4" strokeWidth={1.5} />
                {disconnectedCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-medium">
                    {disconnectedCount}
                  </span>
                ) : (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </Link>
            </div>

            <div className="lg:hidden flex items-center gap-1.5">
              <Link
                to="/devices"
                aria-label="View connected devices"
                className="relative flex items-center justify-center w-8 h-8 rounded-md"
                style={{ color: COLORS.body }}
              >
                <Cpu className="w-4 h-4" strokeWidth={1.5} />
                {disconnectedCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-medium">
                    {disconnectedCount}
                  </span>
                ) : (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </Link>
              <button
                onClick={() => setMobileOpen((o) => !o)}
                className="flex items-center justify-center w-8 h-8 rounded-md"
                style={{ color: COLORS.body }}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="w-4 h-4" strokeWidth={1.5} /> : <Menu className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/20 z-40 lg:hidden"
              aria-hidden="true"
            />
            <motion.div
              ref={menuRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="fixed top-0 right-0 bottom-0 w-64 max-w-[80vw] bg-white z-50 lg:hidden"
              style={{ borderLeft: `1px solid ${COLORS.line}` }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="flex flex-col h-full p-5">
                <div className="flex items-center gap-2 pb-4 mb-4" style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: COLORS.brand }}>
                    <Radar className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
                  </div>
                  <span className="font-medium text-[14px] tracking-tight" style={{ color: COLORS.ink }}>
                    SmartCamp
                  </span>
                </div>

                <div className="space-y-0.5">
                  {tabs.map((tab) => (
                    <MobileNavLink key={tab.id} tab={tab} active={path === tab.path} onClick={() => setMobileOpen(false)} />
                  ))}
                </div>

                <div className="mt-auto pt-4" style={{ borderTop: `1px solid ${COLORS.hairline}` }}>
                  <motion.div variants={itemVariants}>
                    {isAuthenticated ? (
                      <button
                        onClick={() => { logout(); navigate("/authorize"); setMobileOpen(false); }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150"
                        style={{ color: COLORS.brand }}
                      >
                        <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
                        <span>Authorized session</span>
                      </button>
                    ) : (
                      <Link
                        to="/authorize"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150"
                        style={{ color: COLORS.muted }}
                      >
                        <LogOut className="w-4 h-4" strokeWidth={1.5} />
                        <span>Authorize access</span>
                      </Link>
                    )}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
