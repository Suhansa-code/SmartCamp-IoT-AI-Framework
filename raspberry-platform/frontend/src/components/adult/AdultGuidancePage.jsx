import { useEffect, useState } from "react";
import { COLORS, TONE } from "../../lib/tokens";
import { getGuidanceItems } from "./guidanceData";
import { Home, Briefcase, HeartPulse, GraduationCap, Brain, HandCoins, ChevronLeft, ChevronRight, Compass } from "lucide-react";

/* ------------------------------------------------------------------
 *  AdultGuidancePage — page 2 of the Adult flow.
 *
 *  Recovery guidance shown as a gently auto-rotating feature board:
 *  "you are in a disaster — here is what moves you back to normal
 *  life". Fully offline (bundled mock feed via guidanceData.js, which
 *  keeps the shape a future content API will return).
 * ------------------------------------------------------------------ */

const ICONS = {
  home: Home,
  work: Briefcase,
  health: HeartPulse,
  school: GraduationCap,
  mind: Brain,
  support: HandCoins,
};

const ROTATE_MS = 7000;

export default function AdultGuidancePage() {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getGuidanceItems()
      .then((data) => { if (!cancelled) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  // Auto-rotate the board; restarting on index change keeps manual nav in sync.
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length, index]);

  const total = items.length;
  const item = total ? items[index] : null;
  const Icon = (item && ICONS[item.icon]) || Compass;

  const go = (dir) => setIndex((i) => (i + dir + total) % total);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[24px] sm:text-[28px] font-medium tracking-tight" style={{ color: COLORS.ink }}>
          Your next steps
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: COLORS.muted }}>
          Practical guides to help life get back to normal
        </p>
      </div>

      {!item && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: COLORS.line, color: COLORS.muted }}>
          No guides available right now.
        </div>
      )}

      {/* Feature card */}
      {item && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: COLORS.line, backgroundColor: COLORS.surface }}
        >
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${COLORS.brand}, ${COLORS.info})` }} />

          <div className="p-5 sm:p-7">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: COLORS.brandSoft }}
              >
                <Icon className="w-6 h-6" style={{ color: COLORS.brand }} strokeWidth={1.7} />
              </div>
              <span
                className="text-[11px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full"
                style={{ color: TONE.brand.color, backgroundColor: TONE.brand.bg }}
              >
                {item.tag}
              </span>
            </div>

            <h2 className="text-[21px] sm:text-[25px] font-semibold leading-snug tracking-tight" style={{ color: COLORS.ink }}>
              {item.title}
            </h2>
            <p className="text-[14px] mt-1.5" style={{ color: COLORS.body }}>
              {item.subtitle}
            </p>

            <ul className="mt-4 space-y-2.5">
              {(item.points || []).map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[14px]" style={{ color: COLORS.body }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
                    style={{ backgroundColor: COLORS.brand }}
                  />
                  {point}
                </li>
              ))}
            </ul>

            {item.program && (
              <p
                className="mt-5 pt-3.5 text-[12px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: COLORS.muted, borderTop: `1px solid ${COLORS.hairline}` }}
              >
                {item.program}
              </p>
            )}
          </div>

          {/* Controls */}
          <div
            className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3"
            style={{ backgroundColor: COLORS.grid, borderTop: `1px solid ${COLORS.line}` }}
          >
            <button
              onClick={() => go(-1)}
              aria-label="Previous guide"
              className="w-9 h-9 rounded-full border flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ borderColor: COLORS.line, color: COLORS.body, backgroundColor: COLORS.surface }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              {items.map((it, i) => (
                <button
                  key={it.id ?? i}
                  onClick={() => setIndex(i)}
                  aria-label={`Show guide ${i + 1}`}
                  className="rounded-full transition-all"
                  style={{
                    width: i === index ? 20 : 8,
                    height: 8,
                    backgroundColor: i === index ? COLORS.brand : COLORS.subtle,
                  }}
                />
              ))}
            </div>

            <button
              onClick={() => go(1)}
              aria-label="Next guide"
              className="w-9 h-9 rounded-full border flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ borderColor: COLORS.line, color: COLORS.body, backgroundColor: COLORS.surface }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-[12px] mt-5" style={{ color: COLORS.muted }}>
        {total > 0 ? `${index + 1} of ${total} · updates automatically` : ""}
      </p>
    </div>
  );
}
