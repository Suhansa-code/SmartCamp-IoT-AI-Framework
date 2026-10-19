"""Generate 2 landscape slides (light, Apple-style) for panel review.

All metrics verified 2026-10-19 against:
  retrain_real_metrics.json, real_event_validation_metrics.json,
  ditwah_polonnaruwa_case.json (corrected threshold protocol:
  F2 threshold selected on validation split only).
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

BG     = RGBColor(0xF5, 0xF5, 0xF7)
CARD   = RGBColor(0xFF, 0xFF, 0xFF)
INK    = RGBColor(0x1D, 0x1D, 0x1F)
SUB    = RGBColor(0x6E, 0x6E, 0x73)
ACCENT = RGBColor(0x00, 0x71, 0xE3)
GREEN  = RGBColor(0x30, 0xD1, 0x58)
RED    = RGBColor(0xFF, 0x3B, 0x30)
AMBER  = RGBColor(0xFF, 0x9F, 0x0A)
FONT   = "Segoe UI"

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)

REPO    = "https://github.com/Suhansa-code/SmartCamp-IoT-AI-Framework"
REPORT  = REPO + "/blob/backend-dev/edge-gateway/prediction-models/real_validation_results/VALIDATION_REPORT.md"
DATASET = REPO + "/blob/backend-dev/edge-gateway/resources/sri_lanka_flood_real_dataset.csv"
COMMIT  = REPO + "/commit/e4cd5d29"
IDMC    = "https://data.internal-displacement.org/"
DMC     = "https://www.dmc.gov.lk"
DMC_PDF = ("https://www.dmc.gov.lk/index.php?option=com_dmcreports&view=reports"
           "&Itemid=277&report_type_id=6&lang=en")


def set_bg(slide, color):
    f = slide.background.fill; f.solid(); f.fore_color.rgb = color


def txbox(slide, l, t, w, h):
    tb = slide.shapes.add_textbox(l, t, w, h)
    tb.text_frame.word_wrap = True
    return tb, tb.text_frame


def para(tf, text, size, color, bold=False, space_after=0,
         align=PP_ALIGN.LEFT, first=False, italic=False):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align; p.space_after = Pt(space_after)
    r = p.add_run(); r.text = text
    r.font.size = Pt(size); r.font.color.rgb = color
    r.font.bold = bold; r.font.italic = italic; r.font.name = FONT
    return p


def link(p, text, url, size=9.5, color=ACCENT):
    r = p.add_run(); r.text = text
    r.font.size = Pt(size); r.font.color.rgb = color
    r.font.name = FONT; r.font.underline = True
    r.hyperlink.address = url
    return r


def card(slide, l, t, w, h, fill=CARD):
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, l, t, w, h)
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    sh.line.fill.background(); sh.shadow.inherit = False
    try: sh.adjustments[0] = 0.055
    except Exception: pass
    return sh


# ============================================================
# SLIDE 1 — Real Disaster Data, Not Synthetic
# ============================================================
s1 = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s1, BG)

card(s1, Inches(0.45), Inches(0.22), Inches(12.43), Inches(0.92), RGBColor(0xE8, 0xF1, 0xFC))
_, tf = txbox(s1, Inches(0.70), Inches(0.30), Inches(11.9), Inches(0.80))
para(tf, "PANEL COMMENT", 9, ACCENT, bold=True, first=True, space_after=2)
para(tf, '"The system output should be better validated using data from historical disaster situations and, '
         'where appropriate, current disaster events — to assess accuracy, reliability & practical applicability '
         'under real-world disaster conditions."', 10.5, INK, italic=True)

_, tf = txbox(s1, Inches(0.50), Inches(1.22), Inches(9.5), Inches(0.55))
para(tf, "Real Disaster Data, Not Synthetic", 26, INK, bold=True, first=True)
_, tf = txbox(s1, Inches(0.50), Inches(1.68), Inches(12.3), Inches(0.32))
para(tf, "Response to the panel’s validation concern — all numbers re-verified 19 Oct 2026", 11.5, SUB, first=True)

y, ch = Inches(2.10), Inches(1.92)

card(s1, Inches(0.45), y, Inches(4.00), ch)
_, tf = txbox(s1, Inches(0.70), y + Inches(0.12), Inches(3.55), Inches(0.28))
para(tf, "PREVIOUS ISSUE", 9, RED, bold=True, first=True)
_, tf = txbox(s1, Inches(0.70), y + Inches(0.38), Inches(3.55), Inches(1.5))
para(tf, "Model trained on 100% synthetic data (25,000 rows).", 10.5, INK, space_after=5, first=True)
para(tf, "Real-event test (30 IDMC floods):", 10, SUB, space_after=2)
p = tf.add_paragraph(); p.space_after = Pt(2)
r = p.add_run(); r.text = "AUC 0.50 (chance) · 0/30 events · Ditwah missed"
r.font.size = Pt(10.5); r.font.bold = True; r.font.color.rgb = RED; r.font.name = FONT
tb, tf2 = txbox(s1, Inches(0.70), y + Inches(1.55), Inches(3.55), Inches(0.28))
link(tf2.paragraphs[0], "Evidence: commit e4cd5d29 (repo)", COMMIT, 9)

card(s1, Inches(4.66), y, Inches(4.00), ch)
_, tf = txbox(s1, Inches(4.91), y + Inches(0.12), Inches(3.55), Inches(0.28))
para(tf, "ACTION TAKEN", 9, ACCENT, bold=True, first=True)
_, tf = txbox(s1, Inches(4.91), y + Inches(0.38), Inches(3.55), Inches(1.5))
para(tf, "Built a Sri Lanka real dataset + retrained XGBoost.", 10.5, INK, bold=True, space_after=5, first=True)
para(tf, "• Scraped DMC daily river water-level PDF reports", 10, INK, space_after=3)
para(tf, "• Merged ERA5 rainfall · SRTM elevation · IDMC events", 10, INK, space_after=3)
para(tf, "• Labels = DMC’s own flood status (Minor/Major)", 10, INK, space_after=3)

card(s1, Inches(8.87), y, Inches(4.01), ch)
_, tf = txbox(s1, Inches(9.12), y + Inches(0.12), Inches(3.55), Inches(0.28))
para(tf, "CHANGES MADE", 9, ACCENT, bold=True, first=True)
_, tf = txbox(s1, Inches(9.12), y + Inches(0.38), Inches(3.60), Inches(1.5))
para(tf, "Retrained on real data; same production features.", 10.5, INK, bold=True, space_after=4, first=True)
para(tf, "• Gauge water level is key feature (importance 0.63)", 10, INK, space_after=3)
para(tf, "• Threshold 0.570 chosen on validation split only", 10, INK, space_after=3)
para(tf, "• Test split evaluated once at frozen threshold", 10, INK, space_after=3)

# Row 2: New dataset (with DMC PDF link) | Threshold evidence
y2 = Inches(4.18)
card(s1, Inches(0.45), y2, Inches(8.21), Inches(2.95))
_, tf = txbox(s1, Inches(0.70), y2 + Inches(0.12), Inches(7.7), Inches(0.28))
para(tf, "NEW DATASET — REAL DMC GAUGE DATA", 9, GREEN, bold=True, first=True)
_, tf = txbox(s1, Inches(0.70), y2 + Inches(0.38), Inches(7.7), Inches(0.32))
para(tf, "sri_lanka_flood_real_dataset.csv", 13, INK, bold=True, first=True)

stats = [("3,335", "station-days"), ("39", "gauge stations"),
         ("125", "flood days (3.7%)"), ("Jun ’25–Oct ’26", "coverage")]
sx = Inches(0.70)
for val, lab in stats:
    wch = Inches(1.55) if val != "Jun ’25–Oct ’26" else Inches(2.15)
    card(s1, sx, y2 + Inches(0.78), wch, Inches(0.72), RGBColor(0xF0, 0xFA, 0xF0))
    _, tf = txbox(s1, sx + Inches(0.08), y2 + Inches(0.83), wch - Inches(0.16), Inches(0.64))
    para(tf, val, 14, INK, bold=True, align=PP_ALIGN.CENTER, first=True)
    para(tf, lab, 8, SUB, align=PP_ALIGN.CENTER)
    sx += wch + Inches(0.12)

_, tf = txbox(s1, Inches(0.70), y2 + Inches(1.60), Inches(7.7), Inches(0.5))
para(tf, "Built by build_real_flood_dataset.py: scrape DMC water-level PDFs → merge ERA5 + SRTM → "
         "label = DMC flood status.", 9.5, SUB, first=True)

tb, tf = txbox(s1, Inches(0.70), y2 + Inches(1.95), Inches(7.7), Inches(0.85))
p = tf.paragraphs[0]
link(p, "↓  Download DMC daily water-level PDF reports (source of labels)", DMC_PDF, 10)
p = tf.add_paragraph(); p.space_before = Pt(3)
link(p, "Dataset CSV in repo", DATASET, 9.5)
r = p.add_run(); r.text = "  ·  Full validation report: "
r.font.size = Pt(9.5); r.font.color.rgb = SUB; r.font.name = FONT
link(p, "VALIDATION_REPORT.md", REPORT, 9.5)

card(s1, Inches(8.87), y2, Inches(4.01), Inches(2.95))
_, tf = txbox(s1, Inches(9.12), y2 + Inches(0.12), Inches(3.55), Inches(0.28))
para(tf, "THRESHOLD SELECTION (EVIDENCE)", 9, AMBER, bold=True, first=True)
_, tf = txbox(s1, Inches(9.12), y2 + Inches(0.40), Inches(3.60), Inches(2.45))
para(tf, "Temporal split by date:", 10, INK, bold=True, space_after=3, first=True)
para(tf, "Train < Feb’26 (2,483) · Val Feb–Jun’26 (428) · Test ≥ Jul’26 (424, untouched)",
     9.5, INK, space_after=6)
para(tf, "F2-optimal threshold on VALIDATION only:", 10, INK, bold=True, space_after=3)
para(tf, "→ 0.570 (F1-optimal also 0.570 — both agree)", 9.5, INK, space_after=6)
para(tf, "Why F2: in disaster warning, a missed flood costs more than a false alarm "
         "(recall weighted 4× precision).", 9.5, SUB, space_after=6)
para(tf, "Test evaluated once at frozen 0.570:", 10, INK, bold=True, space_after=3)
para(tf, "AUC 1.000 · P 1.000 · R 0.800 · F1 0.889 (only 5 test flood-days — weak alone; "
         "external test is main evidence)", 9.5, INK)

# ============================================================
# SLIDE 2 — Proof on Real Disaster Scenarios
# ============================================================
s2 = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s2, BG)

_, tf = txbox(s2, Inches(0.50), Inches(0.28), Inches(12.3), Inches(0.55))
para(tf, "Proof on Real Disaster Scenarios", 26, INK, bold=True, first=True)
_, tf = txbox(s2, Inches(0.50), Inches(0.74), Inches(12.3), Inches(0.32))
para(tf, "Validated on Cyclone Ditwah (case study) + 30 documented IDMC flood events vs 500 control locations",
     11.5, SUB, first=True)

y = Inches(1.18)
card(s2, Inches(0.45), y, Inches(8.21), Inches(1.70))
_, tf = txbox(s2, Inches(0.70), y + Inches(0.10), Inches(7.7), Inches(0.28))
para(tf, "CASE STUDY — CYCLONE DITWAH, POLONNARUWA (27 NOV – 3 DEC 2025)", 9, ACCENT, bold=True, first=True)
_, tf = txbox(s2, Inches(0.70), y + Inches(0.38), Inches(7.7), Inches(1.25))
para(tf, "Real inputs: rain 255.8 mm/7d (ERA5) · elev. 39 m (SRTM) · Manampitiya gauge, Mahaweli Ganga — "
         "level 4.3 m = minor-flood stage · 13,365 displaced (IDMC/DMC).",
     10.5, INK, space_after=4, first=True)
p = tf.add_paragraph()
r = p.add_run(); r.text = "Old synthetic model: 0.000 → “No flood” ✗ missed   "
r.font.size = Pt(10.5); r.font.color.rgb = RED; r.font.bold = True; r.font.name = FONT
r = p.add_run(); r.text = "→   New real-data model: 0.853 → “Flood” ✓ correct"
r.font.size = Pt(10.5); r.font.color.rgb = GREEN; r.font.bold = True; r.font.name = FONT

card(s2, Inches(8.87), y, Inches(4.01), Inches(1.70))
_, tf = txbox(s2, Inches(9.12), y + Inches(0.10), Inches(3.55), Inches(0.28))
para(tf, "PROOF (VERIFIABLE)", 9, ACCENT, bold=True, first=True)
_, tf = txbox(s2, Inches(9.12), y + Inches(0.36), Inches(3.60), Inches(1.25))
for i, (lab, url) in enumerate([
    ("VALIDATION_REPORT.md (repo)", REPORT),
    ("IDMC disaster data — Sri Lanka", IDMC),
    ("↓ DMC water-level PDF reports", DMC_PDF),
    ("Validation commit e4cd5d29", COMMIT),
]):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    p.space_after = Pt(3)
    link(p, "↗  " + lab, url, 9.5)

y2 = Inches(3.04)
card(s2, Inches(0.45), y2, Inches(4.00), Inches(1.98))
_, tf = txbox(s2, Inches(0.70), y2 + Inches(0.10), Inches(3.55), Inches(0.28))
para(tf, "FLOOD SCENARIOS — REAL EVENTS", 9, RED, bold=True, first=True)
_, tf = txbox(s2, Inches(0.70), y2 + Inches(0.38), Inches(3.55), Inches(1.55))
para(tf, "26 / 30 real flood events detected (87%)", 12, GREEN, bold=True, space_after=4, first=True)
para(tf, "ROC-AUC 0.930 with real gauge stage", 10.5, INK, space_after=3)
para(tf, "Eravur Pattu (803 displaced): 0.058 → 0.679 ✓", 10, INK, space_after=3)
para(tf, "Mean prob: 0.74 events vs 0.22 controls", 10, SUB)

card(s2, Inches(4.66), y2, Inches(4.00), Inches(1.98))
_, tf = txbox(s2, Inches(4.91), y2 + Inches(0.10), Inches(3.55), Inches(0.28))
para(tf, "NON-FLOOD SCENARIOS — CONTROLS", 9, GREEN, bold=True, first=True)
_, tf = txbox(s2, Inches(4.91), y2 + Inches(0.38), Inches(3.55), Inches(1.55))
para(tf, "500 control locations kept mostly low", 12, GREEN, bold=True, space_after=3, first=True)
para(tf, "Controls = places with no documented flood within 10 km (assumed no-flood days)",
     9, SUB, space_after=4)
para(tf, "89% (444/500) correctly below threshold", 10, INK, space_after=3)
para(tf, "11% (56/500) false alarms — stated honestly", 10, AMBER)

card(s2, Inches(8.87), y2, Inches(4.01), Inches(1.98))
_, tf = txbox(s2, Inches(9.12), y2 + Inches(0.10), Inches(3.55), Inches(0.28))
para(tf, "BEFORE vs AFTER", 9, AMBER, bold=True, first=True)
col_x = [Inches(9.12), Inches(10.62), Inches(11.82)]
col_w = [Inches(1.48), Inches(1.18), Inches(1.10)]
col_t = y2 + Inches(0.40)
for ci, htxt in enumerate(["Metric", "Old (synthetic)", "New (real)"]):
    _, tfh = txbox(s2, col_x[ci], col_t, col_w[ci], Inches(0.22))
    para(tfh, htxt, 8, SUB, bold=True, first=True)
for ri, (a, b, c) in enumerate([
    ("Ditwah flood?", "0.000 → No ✗", "0.853 → Yes ✓"),
    ("30-event AUC", "0.50", "0.930"),
    ("Events found", "0 / 30", "26 / 30"),
]):
    ry = col_t + Inches(0.22) + ri * Inches(0.30)
    _, tfc = txbox(s2, col_x[0], ry, col_w[0], Inches(0.28)); para(tfc, a, 9, INK, first=True)
    _, tfc = txbox(s2, col_x[1], ry, col_w[1], Inches(0.28)); para(tfc, b, 9, RED, first=True)
    _, tfc = txbox(s2, col_x[2], ry, col_w[2], Inches(0.28)); para(tfc, c, 9, GREEN, bold=True, first=True)

y3 = Inches(5.18)
card(s2, Inches(0.45), y3, Inches(12.43), Inches(1.15), RGBColor(0xE8, 0xF1, 0xFC))
_, tf = txbox(s2, Inches(0.75), y3 + Inches(0.10), Inches(11.9), Inches(1.0))
para(tf, "JUSTIFICATION", 9, ACCENT, bold=True, first=True)
para(tf, "Validated on real historical and current disaster events, the retrained model now detects 87% of "
         "actual Sri Lankan flood events (AUC 0.930) while keeping 89% of non-flood control locations below "
         "threshold — demonstrating accuracy, reliability and practical applicability as disaster decision support.",
     11, INK)

_, tf = txbox(s2, Inches(0.50), Inches(6.48), Inches(12.3), Inches(0.55))
para(tf, "Limitations (stated honestly): without a live gauge reading, pure forecast skill remains weak (AUC ≈ 0.33) — "
         "the model is decision support on top of live/entered DMC gauge readings. Controls are assumed non-flood "
         "(not verified); internal test has only 5 flood-days.",
     9, SUB, italic=True, first=True)
_, tf = txbox(s2, Inches(0.50), Inches(7.02), Inches(12.3), Inches(0.3))
para(tf, "Reproduce: build_real_flood_dataset.py → train_real_flood.py → validate_ditwah_case.py / validate_real_events.py  ·  "
         "github.com/Suhansa-code/SmartCamp-IoT-AI-Framework",
     8.5, SUB, first=True)

out = r"C:\Users\ASUS\Desktop\SLIIT\Year 4\Research Documents - RM\Smart Camp Box -Repo\SmartCamp-IoT-AI-Framework\Panel_Validation_Response.pptx"
prs.save(out)
print("Saved:", out)
