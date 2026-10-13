"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SideNav from "@/components/common/SideNav";
import PageHeader, { HeaderShell } from "@/components/common/PageHeader";
import PageTitle from "@/components/common/PageTitle";
import ResourcePanel from "@/components/resources/ResourcePanel";
import DistributionForecastPanel from "@/components/resources/DistributionPanel";
import DistributionOperationsPanel from "@/components/distribution/DistributionPanel";
import StockOutlookPanel from "@/components/resources/StockOutlookPanel";
import { useTheme } from "@/components/common/ThemeProvider";

// Cloud-side resources page — live data from Cloud DB (resources, resource_usage, flood_predictions).
// Replaces the old MQTT-based OverviewPanel with a full inventory dashboard.

export default function ResourcesPage() {
  return (
    <Suspense fallback={null}>
      <ResourcesContent />
    </Suspense>
  );
}

function ResourcesContent() {
  const { T } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  const views = {
    overview: {
      label: "Inventory",
      title: "Resource Management",
      subtitle: "Inventory, usage analytics, and flood predictions",
    },
    distribution: {
      label: "Distribution",
      title: "Distribution Operations",
      subtitle: "Live distribution records from the Cloud Database",
    },
    stock: {
      label: "Stock Runout",
      title: "Stock Runout",
      subtitle: "Inventory forecast based on current population trends",
    },
  };
  const requestedView = searchParams.get("view");
  const view = Object.hasOwn(views, requestedView) ? requestedView : "overview";
  const activeView = views[view];

  const selectView = (nextView) => {
    const params = new URLSearchParams(searchParams);
    if (nextView === "overview") params.delete("view");
    else params.set("view", nextView);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

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
                title={activeView.title}
                subtitle={activeView.subtitle}
                {...(view === "overview" ? {
                  search: {
                    value: search,
                    onChange: setSearch,
                    placeholder: "Search resources…",
                  },
                } : {})}
              />
            </HeaderShell>

            <div style={{ padding: "0rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div
                role="tablist"
                aria-label="Resource view"
                style={{
                  alignSelf: "flex-start",
                  display: "flex",
                  gap: "0.35rem",
                  padding: "0.3rem",
                  border: `1px solid ${T.border}`,
                  borderRadius: "0.8rem",
                  background: T.bar,
                  maxWidth: "100%",
                  overflowX: "auto",
                }}
              >
                {Object.entries(views).map(([key, item]) => {
                  const active = view === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => selectView(key)}
                      style={{
                        border: 0,
                        borderRadius: "0.55rem",
                        background: active ? T.textPrimary : "transparent",
                        color: active ? "#fff" : T.muted,
                        cursor: "pointer",
                        font: "inherit",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        padding: "0.55rem 0.8rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <PageTitle
                eyebrow="Resources"
                title={activeView.title}
                subtitle={activeView.subtitle}
              />

              {view === "overview" && (
                <>
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

                  <div
                    style={{
                      background: T.panel,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <DistributionForecastPanel />
                  </div>
                </>
              )}

              {view === "distribution" && <DistributionOperationsPanel />}
              {view === "stock" && <StockOutlookPanel />}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
