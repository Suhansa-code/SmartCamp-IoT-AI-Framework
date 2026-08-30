"use client";

import { useState } from "react";
import SideNav from "@/components/common/SideNav";
import PageHeader, { HeaderShell } from "@/components/common/PageHeader";
import PageTitle from "@/components/common/PageTitle";
import Button from "@/components/common/Button";
import ResourcePanel from "@/components/resources/ResourcePanel";
import DistributionPanel from "@/components/resources/DistributionPanel";
import { useTheme } from "@/components/common/ThemeProvider";

// Cloud-side resources page — live data from Cloud DB (resources, resource_usage, flood_predictions).
// Replaces the old MQTT-based OverviewPanel with a full inventory dashboard.

export default function ResourcesPage() {
  const { T } = useTheme();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius:9999px; }
        @keyframes resPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
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
            <HeaderShell>
              <PageHeader
                title="Resource Management"
                subtitle="Inventory, usage analytics, and flood predictions — toggle Mock/Live data source"
                search={{
                  value: search,
                  onChange: setSearch,
                  placeholder: "Search resources…",
                }}
              />
            </HeaderShell>

            <div style={{ padding: "0rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div
                style={{
                  background: T.panel,
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.1rem",
                }}
              >
                <ResourcePanel />
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
