"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell, TriangleAlert, RefreshCw, Settings, LogOut, ChevronDown, User,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useNotifications } from "./NotificationsContext";
import SearchBar from "@/components/common/SearchBar";
import Button from "@/components/common/Button";
import { daysSince } from "@/components/common/utils";
import { MOCK_USER } from "@/data/user.data";

export const HEADER_PADDING = "clamp(1rem, 2vw, 1.75rem) clamp(1rem, 2vw, 1.75rem) 0";

export function HeaderShell({ children, style }) {
  return <div style={{ width: "100%", padding: HEADER_PADDING, ...style }}>{children}</div>;
}

const LIME = "#16A34A";

function NotificationDropdown({ open, onClose, items, type, T, onAction }) {
  const ref = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isWarning = type === "warning";
  const accent = isWarning ? T.purple : T.amber;
  const filtered = isWarning
    ? items.filter((a) => a.status === "escalated" || (a.source === "disaster" && a.status === "pending"))
    : items.filter((a) => a.status === "pending" && a.source !== "disaster");

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={isWarning ? "Warnings" : "Notifications"}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: 340,
        maxHeight: 400,
        overflowY: "auto",
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
        zIndex: 500,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 800,
            color: T.textPrimary,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {isWarning ? "Warnings" : "Notifications"}
        </span>
        <span
          style={{
            fontSize: "0.66rem",
            fontWeight: 800,
            color: accent,
            background: `${accent}14`,
            padding: "2px 8px",
            borderRadius: 999,
          }}
        >
          {filtered.length}
        </span>
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "2rem 1rem",
            textAlign: "center",
            color: T.muted,
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          No {isWarning ? "warnings" : "notifications"}
        </div>
      ) : (
        filtered.map((item) => (
          <div
            key={item.id}
            style={{
              padding: "10px 16px",
              borderBottom: `1px solid ${T.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              transition: "background 0.15s",
              cursor: "pointer",
            }}
            onClick={() => {
              if (item.source === "disaster") {
                router.push("/disaster");
                onClose();
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.cardSoft;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 800, color: T.textPrimary }}>
                {item.source === "disaster" ? item.campName : item.childId}
              </span>
              <span
                style={{
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  color: accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {item.severity}
              </span>
            </div>
            <span style={{ fontSize: "0.72rem", color: T.muted, fontWeight: 600 }}>
              {item.alertType}
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.66rem", color: T.dim, fontWeight: 600 }}>
                {item.campName} · {daysSince(item.triggeredAt)}
              </span>
              {item.status !== "resolved" && item.source !== "disaster" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(item.id, item.status === "escalated" ? "review" : "resolve");
                  }}
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    color: T.teal,
                    background: `${T.teal}14`,
                    border: `1px solid ${T.teal}33`,
                    borderRadius: 6,
                    padding: "2px 8px",
                    cursor: "pointer",
                  }}
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {/* Footer */}
      {filtered.length > 0 && (
        <Link
          href="/alert"
          onClick={onClose}
          style={{
            padding: "10px 16px",
            textAlign: "center",
            fontSize: "0.72rem",
            fontWeight: 800,
            color: T.teal,
            textDecoration: "none",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          View all →
        </Link>
      )}
    </div>
  );
}

function ProfileDropdown({ open, onClose, T }) {
  const router = useRouter();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Profile menu"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: 220,
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
        zIndex: 500,
        overflow: "hidden",
      }}
    >
      {/* User info */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "0.78rem",
          }}
        >
          {MOCK_USER.initials}
        </div>
        <div>
          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: T.textPrimary }}>
            {MOCK_USER.name}
          </div>
          <div
            style={{
              fontSize: "0.6rem",
              color: T.muted,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {MOCK_USER.role}
          </div>
        </div>
      </div>

      {/* Menu items */}
      {[
        {
          icon: User,
          label: "Profile",
          onClick: () => {
            onClose();
          },
        },
        {
          icon: Settings,
          label: "Settings",
          onClick: () => {
            onClose();
          },
        },
        {
          icon: LogOut,
          label: "Sign Out",
          onClick: () => {
            onClose();
            router.push("/");
          },
        },
      ].map((item) => (
        <button
          key={item.label}
          role="menuitem"
          onClick={item.onClick}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            background: "none",
            border: "none",
            color: T.textPrimary,
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = T.cardSoft;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          <item.icon size={15} color={T.muted} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function PageHeader({
  search,
  pendingCount: pendingCountProp,
  escalatedCount: escalatedCountProp,
  title,
  subtitle,
}) {
  const router = useRouter();
  const { T, mode } = useTheme();
  const { mode: themeMode } = useTheme();
  const dark = themeMode === "dark";

  const {
    pendingCount: globalPending,
    escalatedCount: globalEscalated,
    notifications,
    resolveAlert,
    refresh,
  } = useNotifications();

  const pendingCount = pendingCountProp ?? globalPending;
  const escalatedCount = escalatedCountProp ?? globalEscalated;

  const [refreshing, setRefreshing] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const closeAll = useCallback(() => {
    setNotifOpen(false);
    setWarnOpen(false);
    setProfileOpen(false);
  }, []);

  const toggleNotif = useCallback(() => {
    setWarnOpen(false);
    setProfileOpen(false);
    setNotifOpen((v) => !v);
  }, []);

  const toggleWarn = useCallback(() => {
    setNotifOpen(false);
    setProfileOpen(false);
    setWarnOpen((v) => !v);
  }, []);

  const toggleProfile = useCallback(() => {
    setNotifOpen(false);
    setWarnOpen(false);
    setProfileOpen((v) => !v);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <>
      <style>{`
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .smartcamp-page-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
      `}</style>

      <div className="flex flex-row gap-4">
        <div className="flex items-center" />

        <div className="flex justify-end items-center w-full">
          {search && <SearchBar {...search} />}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {/* Notification bell */}
          <div style={{ position: "relative" }}>
            <Button
              variant="circleOutline"
              size={40}
              onClick={toggleNotif}
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <Bell size={17} />
              {pendingCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: T.amber,
                    color: "#fff",
                    borderRadius: "9999px",
                    fontSize: "0.62rem",
                    fontWeight: 800,
                    padding: "1px 5px",
                    lineHeight: "14px",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </Button>
            <NotificationDropdown
              open={notifOpen}
              onClose={() => setNotifOpen(false)}
              items={notifications}
              type="notification"
              T={T}
              onAction={(id, action) => {
                if (action === "resolve") resolveAlert(id);
              }}
            />
          </div>

          {/* Warning bell */}
          <div style={{ position: "relative" }}>
            <Button
              variant="circleOutline"
              size={40}
              onClick={toggleWarn}
              aria-label="Warnings"
              aria-expanded={warnOpen}
            >
              <TriangleAlert size={17} />
              {escalatedCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: T.purple,
                    color: "#fff",
                    borderRadius: "9999px",
                    fontSize: "0.62rem",
                    fontWeight: 800,
                    padding: "1px 5px",
                    lineHeight: "14px",
                  }}
                >
                  {escalatedCount}
                </span>
              )}
            </Button>
            <NotificationDropdown
              open={warnOpen}
              onClose={() => setWarnOpen(false)}
              items={notifications}
              type="warning"
              T={T}
              onAction={(id, action) => {
                if (action === "resolve") resolveAlert(id);
              }}
            />
          </div>

          {/* Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingLeft: "0.3rem", position: "relative" }}>
            <button
              suppressHydrationWarning
              onClick={toggleProfile}
              aria-expanded={profileOpen}
              aria-label="Profile menu"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: T.textPrimary, textWrap: "nowrap" }}>
                {MOCK_USER.name}
              </span>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #22C55E, #16A34A)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.78rem",
                  }}
                >
                  {MOCK_USER.initials}
                </div>
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: LIME,
                    border: `2px solid ${dark ? T.card : "#fff"}`,
                    boxShadow: `0 0 6px ${LIME}`,
                    animation: "floatY 3s ease-in-out infinite",
                  }}
                />
              </div>
              <ChevronDown size={14} color={T.muted} />
            </button>
            <ProfileDropdown
              open={profileOpen}
              onClose={() => setProfileOpen(false)}
              T={T}
            />
          </div>
        </div>
      </div>
    </>
  );
}
