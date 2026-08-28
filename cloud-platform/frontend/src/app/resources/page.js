"use client";

import { useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import SideNav from "@/components/common/SideNav";
import PageHeader, { HeaderShell } from "@/components/common/PageHeader";
import PageTitle from "@/components/common/PageTitle";
import Button from "@/components/common/Button";
import OverviewPanel from "@/components/resources/OverviewPanel";
import DistributionPanel from "@/components/resources/DistributionPanel";
import { useTheme } from "@/components/common/ThemeProvider";

// Cloud-side resources page.
// Registration and wristband scanning run on the Pi at the camp (raspberry-platform/backend/server.js, port 5000).
// This page shows the cloud dashboard: live camp stats + resource prediction.
// Data arrives via EMQX → CampDataService → /api/resources/overview

export default function ResourcesPage() {
  const { T } = useTheme();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius:9999px; }
        @keyframes resPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes resSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        style={{
          minHeight: "100svh",
          background: T.outer,
          fontFamily: "'Inter',sans-serif",
          color: T.ink,
          paddingLeft: "var(--rail-width, 236px)",
          transition: "padding-left 0.2s ease",
        }}
      >
        <SideNav />

        <div className="header-wrapper">
          <main style={{ background: T.panel, width: "100%", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* ── Shared header ──────────────────────────────── */}
            <HeaderShell>
              <PageHeader
                title={"Resource Overview"}
                subtitle={refreshing ? "Refreshing live overview…" : "View resource usage and availability of relief camps "}
                search={{
                  value: search,
                  onChange: setSearch,
                  placeholder: "Search registrations & events…",
                  onRefresh: () => setRefreshKey((k) => k + 1),
                  refreshing,
                }}
              />
            </HeaderShell>

            <div style={{ padding: "0rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* ── Content panel ──────────────────────────────── */}
              <div
                style={{
                  background: T.panel,
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.1rem",
                }}
              >
                <OverviewPanel search={search} refreshKey={refreshKey} onLoading={setRefreshing} />
              </div>

              {/* ── 7-day food/water distribution forecast (Sri Lanka rate table model) ── */}
              <div
                style={{
                  background: T.panel,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <DistributionPanel />
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
