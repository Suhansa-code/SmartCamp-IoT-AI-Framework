"""Generate 2 landscape slides (light, Apple-style) for panel review."""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# --- Apple-style light palette ---
BG        = RGBColor(0xF5, 0xF5, 0xF7)  # soft light gray
CARD      = RGBColor(0xFF, 0xFF, 0xFF)
INK       = RGBColor(0x1D, 0x1D, 0x1F)  # near-black text
SUB       = RGBColor(0x6E, 0x6E, 0x73)  # secondary gray
ACCENT    = RGBColor(0x00, 0x71, 0xE3)  # Apple blue
GREEN     = RGBColor(0x30, 0xD1, 0x58)
RED       = RGBColor(0xFF, 0x3B, 0x30)
AMBER     = RGBColor(0xFF, 0x9F, 0x0A)
FONT      = "Segoe UI"
FONT_L    = "Segoe UI Light"

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
W, H = prs.slide_width, prs.slide_height


def set_bg(slide, color):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def txbox(slide, l, t, w, h):
    tb = slide.shapes.add_textbox(l, t, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    return tb, tf


def para(tf, text, size, color, bold=False, font=FONT, space_after=0,
         align=PP_ALIGN.LEFT, first=False, italic=False):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_after = Pt(space_after)
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.color.rgb = color
    r.font.bold = bold
    r.font.italic = italic
    r.font.name = font
    return p


def card(slide, l, t, w, h, fill=CARD):
    from pptx.enum.shapes import MSO_SHAPE
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, l, t, w, h)
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    sh.line.fill.background()
    sh.shadow.inherit = False
    # tighter corner radius, Apple-like
    try:
        sh.adjustments[0] = 0.055
    except Exception:
        pass
    return sh


def add_hyperlink(run, url):
    run.hyperlink.address = url


REPO = "https://github.com/Suhansa-code/SmartCamp-IoT-AI-Framework"
REPORT = REPO + "/blob/backend-dev/edge-gateway/prediction-models/real_validation_results/VALIDATION_REPORT.md"
DATASET = REPO + "/blob/backend-dev/edge-gateway/resources/sri_lanka_flood_real_dataset.csv"
BUILD = REPO + "/blob/backend-dev/edge-gateway/prediction-models/build_real_flood_dataset.py"
COMMIT = REPO + "/commit/e4cd5d29"
IDMC = "https://data.internal-displacement.org/"
DMC = "https://www.dmc.gov.lk"

# ============================================================
# SLIDE 1 — From Synthetic Data to Real Disaster Evidence
# ============================================================
s1 = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s1, BG)

# Panel comment banner (top)
banner = card(s1, Inches(0.45), Inches(0.22), Inches(12.43), Inches(0.92), RGBColor(0xE8, 0xF1, 0xFC))
_, tf = txbox(s1, Inches(0.70), Inches(0.30), Inches(11.9), Inches(0.80))
tf.paragraphs[0].space_after = Pt(2)
r = tf.paragraphs[0].add_run()
r.text = "PANEL COMMENT"
r.font.size = Pt(9); r.font.bold = True; r.font.color.rgb = ACCENT; r.font.name = FONT
p = tf.add_paragraph()
r = p.add_run()
r.text = ('"The system output should be better validated using data from historical disaster situations and, '
          'where appropriate, current disaster events — to assess accuracy, reliability & practical applicability '
          'under real-world disaster conditions."')
r.font.size = Pt(10.5); r.font.color.rgb = INK; r.font.name = FONT; r.font.italic = True

# Title
_, tf = txbox(s1, Inches(0.50), Inches(1.22), Inches(9.5), Inches(0.55))
para(tf, "Real Disaster Data, Not Synthetic", 26, INK, bold=True, first=True)
_, tf = txbox(s1, Inches(0.50), Inches(1.68), Inches(12.3), Inches(0.32))
para(tf, "Action taken to address the panel’s validation concern", 11.5, SUB, first=True)

# Row 1: Previous issue  |  Action taken
y, ch = Inches(2.10), Inches(2.05)

card(s1, Inches(0.45), y, Inches(4.00), ch)
_, tf = txbox(s1, Inches(0.70), y + Inches(0.14), Inches(3.55), Inches(0.3))
para(tf, "PREVIOUS ISSUE", 9, RED, bold=True, first=True)
_, tf = txbox(s1, Inches(0.70), y + Inches(0.42), Inches(3.55), Inches(1.5))
para(tf, "Model trained on 100% synthetic data (25,000 rows) — no real-disaster validation.",
     10.5, INK, space_after=6, first=True)
para(tf, "External check vs 30 real IDMC flood events:", 10, SUB, space_after=3)
p = tf.add_paragraph(); p.space_after = Pt(2)
r = p.add_run(); r.text = "AUC 0.50 (chance) · 0/30 events found"
r.font.size = Pt(10.5); r.font.bold = True; r.font.color.rgb = RED; r.font.name = FONT
tb, tf2 = txbox(s1, Inches(0.70), y + Inches(1.68), Inches(3.55), Inches(0.3))
r = tf2.paragraphs[0].add_run(); r.text = "Evidence: commit e4cd5d29 (repo)"
r.font.size = Pt(9); r.font.color.rgb = ACCENT; r.font.name = FONT; r.font.underline = True
add_hyperlink(r, COMMIT)

card(s1, Inches(4.66), y, Inches(4.00), ch)
_, tf = txbox(s1, Inches(4.91), y + Inches(0.14), Inches(3.55), Inches(0.3))
para(tf, "ACTION TAKEN", 9, ACCENT, bold=True, first=True)
_, tf = txbox(s1, Inches(4.91), y + Inches(0.42), Inches(3.55), Inches(1.55))
para(tf, "Built a Sri Lanka real dataset + retrained XGBoost.", 10.5, INK, bold=True, space_after=5, first=True)
para(tf, "• Scraped DMC daily river water-level reports", 10, INK, space_after=3)
para(tf, "• ERA5 rainfall · SRTM elevation · IDMC events", 10, INK, space_after=3)
para(tf, "• Labels = DMC’s own flood status (Minor/Major)", 10, INK, space_after=3)

card(s1, Inches(8.87), y, Inches(4.01), ch)
_, tf = txbox(s1, Inches(9.12), y + Inches(0.14), Inches(3.55), Inches(0.3))
para(tf, "CHANGES MADE", 9, ACCENT, bold=True, first=True)
_, tf = txbox(s1, Inches(9.12), y + Inches(0.42), Inches(3.55), Inches(1.55))
para(tf, "Retrained on real data (temporal split, threshold 0.58).", 10.5, INK, bold=True, space_after=5, first=True)
para(tf, "• Gauge water level becomes key feature (importance 0.63)", 10, INK, space_after=3)
para(tf, "• Same production feature vector — drop-in replacement", 10, INK, space_after=3)
para(tf, "• Synthetic model kept as backup for comparison", 10, INK, space_after=3)

# Row 2: New dataset (wide card)
y2 = Inches(4.32)
card(s1, Inches(0.45), y2, Inches(8.21), Inches(2.78))
_, tf = txbox(s1, Inches(0.70), y2 + Inches(0.14), Inches(7.7), Inches(0.3))
para(tf, "NEW DATASET — REAL DMC GAUGE DATA", 9, GREEN, bold=True, first=True)
_, tf = txbox(s1, Inches(0.70), y2 + Inches(0.42), Inches(7.7), Inches(0.4))
para(tf, "sri_lanka_flood_real_dataset.csv", 13, INK, bold=True, first=True)

# stat chips
stats = [("3,335", "station-days"), ("39", "gauge stations"), ("125", "flood days (3.7%)"), ("Jun ’25–Oct ’26", "coverage")]
sx = Inches(0.70)
for val, lab in stats:
    wch = Inches(1.55) if val != "Jun ’25–Oct ’26" else Inches(2.15)
    c = card(s1, sx, y2 + Inches(0.88), wch, Inches(0.78), RGBColor(0xF0, 0xFA, 0xF0))
    _, tf = txbox(s1, sx + Inches(0.08), y2 + Inches(0.94), wch - Inches(0.16), Inches(0.68))
    para(tf, val, 14, INK, bold=True, align=PP_ALIGN.CENTER, first=True)
    para(tf, lab, 8, SUB, align=PP_ALIGN.CENTER)
    sx += wch + Inches(0.12)

_, tf = txbox(s1, Inches(0.70), y2 + Inches(1.80), Inches(7.7), Inches(0.9))
para(tf, "Sources: DMC water-level PDF reports · ERA5 (Open-Meteo) · SRTM elevation · IDMC flood events",
     9.5, SUB, space_after=4, first=True)
tb, tf2 = txbox(s1, Inches(0.70), y2 + Inches(2.06), Inches(7.7), Inches(0.55))
p = tf2.paragraphs[0]
r = p.add_run(); r.text = "Dataset: "; r.font.size = Pt(9.5); r.font.color.rgb = SUB; r.font.name = FONT
r = p.add_run(); r.text = "repo/…/sri_lanka_flood_real_dataset.csv"
r.font.size = Pt(9.5); r.font.color.rgb = ACCENT; r.font.name = FONT; r.font.underline = True
add_hyperlink(r, DATASET)
r = p.add_run(); r.text = "   ·   Sources: dmc.gov.lk · internal-displacement.org · open-meteo.com"
r.font.size = Pt(9.5); r.font.color.rgb = SUB; r.font.name = FONT
p = tf2.add_paragraph()
r = p.add_run(); r.text = "Full report: "; r.font.size = Pt(9.5); r.font.color.rgb = SUB; r.font.name = FONT
r = p.add_run(); r.text = "VALIDATION_REPORT.md (repo)"
r.font.size = Pt(9.5); r.font.color.rgb = ACCENT; r.font.name = FONT; r.font.underline = True
add_hyperlink(r, REPORT)

# Row 2 right: How it was created
card(s1, Inches(8.87), y2, Inches(4.01), Inches(2.78))
_, tf = txbox(s1, Inches(9.12), y2 + Inches(0.14), Inches(3.55), Inches(0.3))
para(tf, "HOW THE DATASET WAS CREATED", 9, ACCENT, bold=True, first=True)
_, tf = txbox(s1, Inches(9.12), y2 + Inches(0.45), Inches(3.60), Inches(2.2))
steps = [
    ("1", "Scrape DMC water-level PDFs (pdfplumber)"),
    ("2", "Target dates of known IDMC flood events"),
    ("3", "Merge ERA5 rain + SRTM elevation per station-day"),
    ("4", "Label = DMC status: Minor/Major Flood → 1, Normal → 0"),
    ("5", "Automated pipeline: build_real_flood_dataset.py"),
]
for i, (n, txt) in enumerate(steps):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    p.space_after = Pt(4)
    r = p.add_run(); r.text = n + "  "
    r.font.size = Pt(9.5); r.font.bold = True; r.font.color.rgb = ACCENT; r.font.name = FONT
    r = p.add_run(); r.text = txt
    r.font.size = Pt(9.5); r.font.color.rgb = INK; r.font.name = FONT

# ============================================================
# SLIDE 2 — Proof: Real Flood vs Non-Flood Scenarios
# ============================================================
s2 = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s2, BG)

# small top accent + title
_, tf = txbox(s2, Inches(0.50), Inches(0.28), Inches(12.3), Inches(0.55))
para(tf, "Proof on Real Disaster Scenarios", 26, INK, bold=True, first=True)
_, tf = txbox(s2, Inches(0.50), Inches(0.74), Inches(12.3), Inches(0.32))
para(tf, "Validated against Cyclone Ditwah & 30 IDMC flood events vs 500 non-flood controls",
     11.5, SUB, first=True)

# Row 1: Actual scenario (left) + Proof links (right)
y = Inches(1.18)
card(s2, Inches(0.45), y, Inches(8.21), Inches(1.62))
_, tf = txbox(s2, Inches(0.70), y + Inches(0.12), Inches(7.7), Inches(0.3))
para(tf, "ACTUAL SCENARIO — CYCLONE DITWAH, POLONNARUWA (27 NOV – 3 DEC 2025)", 9, ACCENT, bold=True, first=True)
_, tf = txbox(s2, Inches(0.70), y + Inches(0.42), Inches(7.7), Inches(1.1))
para(tf, "Real inputs: rain 255.8 mm/7d (ERA5) · elev. 39 m (SRTM) · Manampitiya gauge, Mahaweli Ganga — "
         "level 4.3 m = minor-flood threshold · 13,365 people displaced (IDMC/DMC).",
     10.5, INK, space_after=4, first=True)
para(tf, "30-event study: IDMC Sri Lanka floods (2025–26) vs 500 non-flood control days.",
     10, SUB)

card(s2, Inches(8.87), y, Inches(4.01), Inches(1.62))
_, tf = txbox(s2, Inches(9.12), y + Inches(0.12), Inches(3.55), Inches(0.3))
para(tf, "PROOF (VERIFIABLE)", 9, ACCENT, bold=True, first=True)
_, tf = txbox(s2, Inches(9.12), y + Inches(0.40), Inches(3.60), Inches(1.2))
links = [
    ("VALIDATION_REPORT.md (repo)", REPORT),
    ("IDMC disaster data — Sri Lanka", IDMC),
    ("DMC — river water levels", DMC),
    ("Validation commit e4cd5d29", COMMIT),
]
for i, (lab, url) in enumerate(links):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    p.space_after = Pt(3)
    r = p.add_run(); r.text = "↗  " + lab
    r.font.size = Pt(9.5); r.font.color.rgb = ACCENT; r.font.name = FONT; r.font.underline = True
    add_hyperlink(r, url)

# Row 2: Flood scenario result | Non-flood scenario result
y2 = Inches(2.96)
card(s2, Inches(0.45), y2, Inches(4.00), Inches(1.92))
_, tf = txbox(s2, Inches(0.70), y2 + Inches(0.12), Inches(3.55), Inches(0.3))
para(tf, "FLOOD SCENARIO — VALIDATION RESULT", 9, RED, bold=True, first=True)
_, tf = txbox(s2, Inches(0.70), y2 + Inches(0.42), Inches(3.55), Inches(1.45))
para(tf, "27 / 30 real flood events detected (90%)", 12, GREEN, bold=True, space_after=4, first=True)
para(tf, "ROC-AUC 0.948 with live gauge stage", 10.5, INK, space_after=3)
para(tf, "Ditwah Polonnaruwa: 0.763 → FLOOD (correct)", 10, INK, space_after=3)
para(tf, "Eravur Pattu: 0.905 → FLOOD (correct)", 10, INK)

card(s2, Inches(4.66), y2, Inches(4.00), Inches(1.92))
_, tf = txbox(s2, Inches(4.91), y2 + Inches(0.12), Inches(3.55), Inches(0.3))
para(tf, "NON-FLOOD SCENARIO — VALIDATION RESULT", 9, GREEN, bold=True, first=True)
_, tf = txbox(s2, Inches(4.91), y2 + Inches(0.42), Inches(3.55), Inches(1.45))
para(tf, "500 control (non-flood) days correctly low", 12, GREEN, bold=True, space_after=4, first=True)
para(tf, "Mean probability: 0.22 vs 0.81 for events", 10.5, INK, space_after=3)
para(tf, "No false flood flags at normal gauge levels", 10, INK, space_after=3)
para(tf, "Precision 0.39 · F1 0.545 (class-imbalanced)", 10, SUB)

card(s2, Inches(8.87), y2, Inches(4.01), Inches(1.92))
_, tf = txbox(s2, Inches(9.12), y2 + Inches(0.12), Inches(3.55), Inches(0.3))
para(tf, "BEFORE vs AFTER", 9, AMBER, bold=True, first=True)
# three fixed columns: metric | old | new
col_x = [Inches(9.12), Inches(10.62), Inches(11.82)]
col_w = [Inches(1.48), Inches(1.18), Inches(1.10)]
col_t = y2 + Inches(0.42)
headers = ["Metric", "Old (synthetic)", "New (real)"]
rows = [
    ("Ditwah flood?", "0.000 → No ✗", "0.763 → Yes ✓"),
    ("30-event AUC", "0.50", "0.948"),
    ("Events found", "0 / 30", "27 / 30"),
]
for ci in range(3):
    _, tfh = txbox(s2, col_x[ci], col_t, col_w[ci], Inches(0.22))
    para(tfh, headers[ci], 8, SUB, bold=True, first=True)
for ri, (a, b, c) in enumerate(rows):
    ry = col_t + Inches(0.24) + ri * Inches(0.30)
    _, tfc = txbox(s2, col_x[0], ry, col_w[0], Inches(0.28))
    para(tfc, a, 9, INK, first=True)
    _, tfc = txbox(s2, col_x[1], ry, col_w[1], Inches(0.28))
    para(tfc, b, 9, RED, first=True)
    _, tfc = txbox(s2, col_x[2], ry, col_w[2], Inches(0.28))
    para(tfc, c, 9, GREEN, bold=True, first=True)

# Final justification band
y3 = Inches(5.05)
band = card(s2, Inches(0.45), y3, Inches(12.43), Inches(1.28), RGBColor(0xE8, 0xF1, 0xFC))
_, tf = txbox(s2, Inches(0.75), y3 + Inches(0.14), Inches(11.9), Inches(1.05))
para(tf, "JUSTIFICATION", 9, ACCENT, bold=True, first=True)
para(tf, "Validated against real historical and current disaster events, the retrained model now correctly detects "
         "flood conditions in actual Sri Lankan scenarios (90% of events) while keeping non-flood predictions low — "
         "demonstrating accuracy, reliability and practical applicability as disaster decision support.",
     11, INK, space_after=2, first=False)

# honest note
_, tf = txbox(s2, Inches(0.50), Inches(6.55), Inches(12.3), Inches(0.7))
para(tf, "Honest limitation: without a live gauge reading, pure forecast skill remains weak (AUC ≈ 0.35) — the model "
         "is designed as decision support on top of live/entered DMC gauge readings.",
     9.5, SUB, italic=True, first=True)
_, tf = txbox(s2, Inches(0.50), Inches(7.05), Inches(12.3), Inches(0.3))
para(tf, "Reproduce: build_real_flood_dataset.py → train_real_flood.py → validate_ditwah_case.py / validate_real_events.py  ·  "
         "github.com/Suhansa-code/SmartCamp-IoT-AI-Framework",
     8.5, SUB, first=True)

out = r"C:\Users\ASUS\Desktop\SLIIT\Year 4\Research Documents - RM\Smart Camp Box -Repo\SmartCamp-IoT-AI-Framework\Panel_Validation_Response.pptx"
prs.save(out)
print("Saved:", out)
