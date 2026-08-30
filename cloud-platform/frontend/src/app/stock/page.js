"use client";

import SideNav from "@/components/common/SideNav";
import PageHeader, { HeaderShell } from "@/components/common/PageHeader";
import PageTitle from "@/components/common/PageTitle";
import StockOutlookPanel from "@/components/resources/StockOutlookPanel";
import { useTheme } from "@/components/common/ThemeProvider";

// Stock runout — forecast-driven days of cover, runout and reorder dates.
// The Resources page answers "how much is left"; this one answers "how long
// does it last", which needs the population forecast rather than a threshold.

export default function StockPage() {
  const { T } = useTheme();

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius:9999px; }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
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
              <PageHeader />
            </HeaderShell>

            <div style={{ padding: "0rem 2rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* PageHeader accepts title/subtitle props but never renders them,
                  so the heading comes from PageTitle, which does. */}
              <PageTitle
                eyebrow="Resources"
                title="Stock Runout"
                subtitle="Days of cover, runout dates and reorder deadlines — driven by the population forecast, not a fixed threshold"
              />
              <StockOutlookPanel />
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
