"""Build a REAL flood dataset for Sri Lanka from government sources.

Sources:
  - DMC (Disaster Management Centre) daily river water-level PDF reports:
    real gauge water levels + Alert/Minor/Major flood status = real labels
    https://www.dmc.gov.lk (report_type_id=6, River Water Level and Flood Warning)
  - IDMC/DMC flood events -> target report dates around known flood events
  - ERA5 (Open-Meteo) -> real rainfall 7d + month-to-date
  - SRTM (Open-Meteo) -> real elevation per gauge
  - OpenStreetMap Overpass -> real distance to nearest river/stream
  - edge-gateway/resources/gauging_stations.csv -> gauge coordinates

Output:
  edge-gateway/resources/sri_lanka_flood_real_dataset.csv
  (columns: production MODEL_FEATURES + metadata + flood_label)

Label rule:  Minor Flood / Major Flood / inaccessible gauge (flood) -> 1
             Normal -> 0      Alert -> -1 (ambiguous, excluded from training)
"""

import csv
import datetime as dt
import json
import math
import os
import re
import ssl
import time
import urllib.parse
import urllib.request

import pdfplumber

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(os.path.dirname(__file__), "real_validation_results", "cache")
GAUGE_CSV = os.path.join(ROOT, "edge-gateway", "resources", "gauging_stations.csv")
OUT_CSV = os.path.join(ROOT, "edge-gateway", "resources", "sri_lanka_flood_real_dataset.csv")
EVENTS_CSV = os.path.join(os.path.dirname(__file__), "real_validation_results",
                          "per_event_predictions.csv")

INDEX_PAGE = ("https://www.dmc.gov.lk/index.php?option=com_dmcreports&view=reports"
              "&Itemid=277&report_type_id=6&lang=en&limitstart={ls}")
DMC_BASE = "https://www.dmc.gov.lk"
CTX = ssl._create_unverified_context()  # dmc.gov.lk certificate is expired
UA = {"User-Agent": "Mozilla/5.0 (research; SmartCamp validation)"}

MIN_INDEX_DATE = dt.date(2024, 12, 1)   # stop index walk before this
MAX_INDEX_PAGES = 400
MAX_PDFS = 160
MAX_PDF_PER_DAY = 4
CONTROL_PER_MONTH = 3
RIVER_CACHE = {}

os.makedirs(CACHE, exist_ok=True)
os.makedirs(os.path.join(CACHE, "pdfs"), exist_ok=True)


def fetch(url, binary=False, timeout=60, retries=3, ctx=None, delay=0.0, data=None):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                data = r.read()
            if delay:
                time.sleep(delay)
            return data if binary else data.decode("utf-8", "ignore")
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 * (i + 1))
    raise last


def fetch_json(url, **kw):
    return json.loads(fetch(url, **kw))


# ---------------------------------------------------------------- phase 1 index
def load_index():
    path = os.path.join(CACHE, "dmc_index.json")
    state = {"entries": [], "seen": [], "next_page": 0}
    if os.path.exists(path):
        old = json.load(open(path, encoding="utf-8"))
        if isinstance(old, dict) and "next_page" in old:
            state = old
        elif isinstance(old, list):
            state["entries"] = old
            state["seen"] = [e["url"] for e in old]
            state["next_page"] = 92  # legacy cache stopped here
    entries, seen = state["entries"], set(state["seen"])

    def save(next_page):
        json.dump({"entries": entries, "seen": sorted(seen), "next_page": next_page},
                  open(path, "w", encoding="utf-8"))

    print(f"[index] walking DMC report pages from page {state['next_page']}...")
    empty_streak = 0
    page = state["next_page"] - 1
    for page in range(state["next_page"], MAX_INDEX_PAGES):
        ls = page * 10
        try:
            html = fetch(INDEX_PAGE.format(ls=ls), timeout=40, ctx=CTX, retries=2)
        except Exception as e:  # noqa: BLE001
            print(f"[index] page {ls} failed: {e}")
            save(page)  # retry this page next run
            return entries
        rows, jpg_dates = [], []
        for tr in re.split(r"<tr\b", html):
            m_link = re.search(r'href="([^"]*Water_level[^"]*\.(?:pdf|jpg)[^"]*)"', tr)
            m_date = re.search(r"(\d{4}-\d{2}-\d{2})", tr)
            if not (m_link and m_date):
                continue
            href = m_link.group(1).replace("&amp;", "&")
            url = href if href.startswith("http") else DMC_BASE + href
            if href.lower().endswith(".pdf"):
                rows.append((m_date.group(1), url))
            else:
                jpg_dates.append(m_date.group(1))
        if not rows and not jpg_dates:
            empty_streak += 1
            if empty_streak >= 5:
                print(f"[index] 5 empty pages at limitstart={ls}, stopping")
                save(page)
                break
            continue
        empty_streak = 0
        new = 0
        for d, u in rows:
            if u not in seen:
                seen.add(u)
                entries.append({"date": d, "url": u})
                new += 1
        page_dates = [d for d, _ in rows] + jpg_dates
        all_old = bool(page_dates) and all(
            dt.date.fromisoformat(d) < MIN_INDEX_DATE for d in page_dates)
        if page_dates and (page % 20 == 0 or all_old):
            print(f"[index] page {page}: {min(page_dates)} .. {max(page_dates)}, "
                  f"+{new} total={len(entries)}", flush=True)
        if all_old:
            print("[index] reached pre-2024-12 dates, stopping")
            save(page + 1)
            break
        time.sleep(0.25)
        if page % 20 == 19:
            save(page + 1)
    save(page + 1)
    print(f"[index] {len(entries)} water-level reports cached")
    return entries


def event_windows():
    """Flood windows [d-2, d+4] from IDMC event dates (dd/mm/yyyy in name)."""
    windows = []
    for r in csv.DictReader(open(EVENTS_CSV, encoding="utf-8-sig")):
        m = re.search(r"(\d{2})/(\d{2})/(\d{4})", r.get("event_name", ""))
        if m:
            d = dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            windows.append((d - dt.timedelta(days=2), d + dt.timedelta(days=4)))
    return windows


def select_pdfs(index):
    wins = event_windows()
    in_win, out_win = [], []
    for e in index:
        d = dt.date.fromisoformat(e["date"])
        (in_win if any(a <= d <= b for a, b in wins) else out_win).append(e)

    def cap_per_day(items):
        per_day, kept = {}, []
        for e in items:
            n = per_day.get(e["date"], 0)
            if n < MAX_PDF_PER_DAY:
                per_day[e["date"]] = n + 1
                kept.append(e)
        return kept

    flood = cap_per_day(in_win)
    by_month = {}
    for e in out_win:
        by_month.setdefault(e["date"][:7], []).append(e)
    control = []
    for month in sorted(by_month):
        items = by_month[month]
        picks = ({0, len(items) // 2, len(items) - 1} if len(items) > 3
                 else set(range(len(items))))
        control.extend(items[i] for i in sorted(picks)[:CONTROL_PER_MONTH])
    flood_cap = max(0, MAX_PDFS - 40)  # keep room for controls
    total = flood[:flood_cap]
    total.extend(control[:max(0, MAX_PDFS - len(total))])
    print(f"[select] {len(flood)} event-window + {len(control)} control candidates "
          f"-> using {len(total)} PDFs")
    return total


# ------------------------------------------------------------------ phase 2 PDFs
def parse_pdf(url):
    fname = url.split("/")[-1]
    path = os.path.join(CACHE, "pdfs", fname)
    if not os.path.exists(path):
        open(path, "wb").write(fetch(url, binary=True, retries=3, ctx=CTX))
        time.sleep(0.3)
    out = {"url": url, "rows": [], "report_date": None, "report_time": ""}
    try:
        with pdfplumber.open(path) as pdf:
            text = pdf.pages[0].extract_text() or ""
            m = re.search(r"DATE\s*:\s*(\d{1,2}-\w{3}-\d{4})", text)
            m_t = re.search(r"TIME\s*:\s*([\d:]+\s*[AP]M)", text)
            if m:
                out["report_date"] = dt.datetime.strptime(
                    m.group(1), "%d-%b-%Y").date().isoformat()
            if m_t:
                out["report_time"] = m_t.group(1)
            tables = pdf.pages[0].extract_tables()
    except Exception as e:  # noqa: BLE001
        print(f"[pdf] parse failed {fname}: {e}")
        return None
    if not tables:
        return None
    for row in tables[0]:
        cells = [("" if c is None else str(c).strip()) for c in row]
        ui = next((i for i, c in enumerate(cells) if c.lower() in ("ft", "m", "mtr")), None)
        if ui is None or ui + 6 >= len(cells) or ui < 2:
            continue
        river, station, unit = cells[ui - 2], cells[ui - 1], cells[ui].lower()
        if not station or station.lower() in ("station", "gauging station"):
            continue

        def num(x):
            try:
                return float(x)
            except ValueError:
                return None

        alert, minor, major = num(cells[ui + 1]), num(cells[ui + 2]), num(cells[ui + 3])
        wl1, wl2 = num(cells[ui + 4]), num(cells[ui + 5])
        status_raw = cells[ui + 6]
        if alert is None or minor is None:
            continue
        if unit == "ft":
            alert = alert * 0.3048
            minor = minor * 0.3048
            major = major * 0.3048 if major is not None else None
            wl1 = wl1 * 0.3048 if wl1 is not None else None
            wl2 = wl2 * 0.3048 if wl2 is not None else None
        s = status_raw.lower()
        wl = wl2 if wl2 is not None else wl1
        if "major flood" in s:
            status, label = "Major Flood", 1
        elif "minor flood" in s:
            status, label = "Minor Flood", 1
        elif "alert" in s:
            status, label = "Alert", -1
        elif "normal" in s:
            status, label = "Normal", 0
        elif wl1 is None and wl2 is None:
            # DMC note: "NA - gauges not accessible (Flood)" -> flood, level >= major
            status, label, wl = "INACCESSIBLE (FLOOD)", 1, major
        else:
            continue
        if wl is None:
            continue
        out["rows"].append({
            "river": river, "station": station, "status": status, "flood_label": label,
            "water_level_m": wl, "alert_level_m": alert, "minor_flood_level_m": minor,
            "major_flood_level_m": major,
        })
    return out


# --------------------------------------------------------------- phase 3 enrich
def norm_name(s):
    s = re.sub(r"\(.*?\)", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def load_gauges():
    return {norm_name(r["station_name"]): r
            for r in csv.DictReader(open(GAUGE_CSV, encoding="utf-8-sig"))}


def match_gauge(station, gauges, gauges_compact):
    n = norm_name(station)
    if n in gauges:
        return gauges[n]
    if n.replace(" ", "") in gauges_compact:
        return gauges_compact[n.replace(" ", "")]
    for k, g in gauges.items():
        if n in k or k in n:
            return g
    return None


def batch_elevation(points):
    path = os.path.join(CACHE, "elevation.json")
    cache = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    missing = [p for p in points if f"{p[0]:.5f},{p[1]:.5f}" not in cache]
    if missing:
        lat = ",".join(f"{p[0]:.5f}" for p in missing)
        lon = ",".join(f"{p[1]:.5f}" for p in missing)
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
        els = fetch_json(url, retries=4, timeout=40)["elevation"]
        for p, e in zip(missing, els):
            cache[f"{p[0]:.5f},{p[1]:.5f}"] = e
        json.dump(cache, open(path, "w", encoding="utf-8"))
    return {p: cache[f"{p[0]:.5f},{p[1]:.5f}"] for p in points}


def haversine_km(a, b, c, d):
    R = 6371.0
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c - a), math.radians(d - b)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


OVERPASS_MIRRORS = ["https://overpass-api.de/api/interpreter",
                    "https://overpass.kumi.systems/api/interpreter"]
OSM_CONSEC_FAILS = 0
OSM_DOWN = False


def river_distance_km(lat, lon, km_radius=3.0):
    """Distance to nearest river/stream centerline (km). Gauges sit on the river,
    so 0.0 is the safe fallback when OSM is unreachable or the way is unmapped."""
    global OSM_CONSEC_FAILS, OSM_DOWN
    key = f"{lat:.5f},{lon:.5f}"
    if key in RIVER_CACHE:
        return RIVER_CACHE[key]
    dist = 0.0
    if not OSM_DOWN:
        q = (f"[out:json][timeout:25];way(around:{int(km_radius * 1000)},{lat},{lon})"
             f'["waterway"~"^(river|stream)$"];out geom;')
        payload = urllib.parse.urlencode({"data": q}).encode()
        best = float("inf")
        for mirror in OVERPASS_MIRRORS:
            try:
                data = fetch_json(mirror, data=payload, retries=1, timeout=25)
                for w in data.get("elements", []):
                    for g in (w.get("geometry") or []):
                        best = min(best, haversine_km(lat, lon, g["lat"], g["lon"]))
                if best != float("inf"):
                    dist = best
                OSM_CONSEC_FAILS = 0
                break
            except Exception as e:  # noqa: BLE001
                OSM_CONSEC_FAILS += 1
                if OSM_CONSEC_FAILS >= 4:
                    OSM_DOWN = True
                    print("[river] 4 consecutive OSM failures -> giving up on OSM")
                print(f"[river] mirror failed for {key}: {type(e).__name__}")
        else:
            print(f"[river] all mirrors failed for {key} -> fallback 0")
        time.sleep(1.0)
    RIVER_CACHE[key] = dist
    json.dump(RIVER_CACHE, open(os.path.join(CACHE, "rivers.json"), "w", encoding="utf-8"))
    return RIVER_CACHE[key]


def rainfall_for(dates, points):
    """ERA5 monthly requests (batched over stations). Returns {(lat,lon,date):
    (rain_7d, rain_month_to_date)}."""
    months = sorted({d[:7] for d in dates})
    out = {}
    for ym in months:
        y, m = int(ym[:4]), int(ym[5:7])
        first = dt.date(y, m, 1)
        last = dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1)
        end = min(last, dt.date.today() - dt.timedelta(days=5))  # ERA5 lag
        if end < first:
            continue
        start = first - dt.timedelta(days=6)
        path = os.path.join(CACHE, f"rain_{ym}.json")
        if os.path.exists(path):
            payloads = json.load(open(path, encoding="utf-8"))
        else:
            lat = ",".join(f"{p[0]:.5f}" for p in points)
            lon = ",".join(f"{p[1]:.5f}" for p in points)
            url = (f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}"
                   f"&longitude={lon}&start_date={start}&end_date={end}"
                   f"&daily=rain_sum&timezone=auto")
            payloads = fetch_json(url, retries=4, timeout=60)
            json.dump(payloads, open(path, "w", encoding="utf-8"))
            time.sleep(0.5)
        if isinstance(payloads, dict):
            payloads = [payloads]
        for p, payload in zip(points, payloads):
            daily = payload.get("daily") or {}
            series = dict(zip(daily.get("time", []), daily.get("rain_sum", [])))

            def ok(v):
                return v is not None and not (isinstance(v, float) and math.isnan(v))

            for i in range((end - first).days + 1):
                day = first + dt.timedelta(days=i)
                r7_vals = [series.get((day - dt.timedelta(days=k)).isoformat())
                           for k in range(7)]
                r7 = sum(v for v in r7_vals if ok(v)) if all(ok(v) for v in r7_vals) else None
                mtd_vals = [series.get((first + dt.timedelta(days=j)).isoformat())
                            for j in range(i + 1)]
                mtd = sum(v for v in mtd_vals if ok(v)) if all(ok(v) for v in mtd_vals) else None
                out[(p[0], p[1], day.isoformat())] = (r7, mtd)
    return out


# ------------------------------------------------------------------- main
def main():
    index = load_index()
    selection = select_pdfs(index)
    gauges = load_gauges()
    gauges_compact = {k.replace(" ", ""): v for k, v in gauges.items()}

    records, seen_keys, unmatched = [], set(), set()
    for i, e in enumerate(selection):
        parsed = parse_pdf(e["url"])
        if not parsed or not parsed["rows"]:
            continue
        rdate = parsed["report_date"] or e["date"]
        for row in parsed["rows"]:
            g = match_gauge(row["station"], gauges, gauges_compact)
            if not g:
                unmatched.add(row["station"])
                continue
            k = (rdate, g["station_name"], row["status"], row["water_level_m"])
            if k in seen_keys:
                continue
            seen_keys.add(k)
            records.append({
                **row,
                "report_date": rdate,
                "latitude": float(g["Latitude"]),
                "longitude": float(g["Longitude"]),
                "csv_station": g["station_name"],
            })
        if (i + 1) % 20 == 0:
            print(f"[pdf] {i + 1}/{len(selection)} parsed, rows={len(records)}")
    print(f"[pdf] {len(records)} matched station-rows from {len(selection)} reports")
    if unmatched:
        print(f"[pdf] unmatched station names ({len(unmatched)}): "
              f"{sorted(unmatched)[:12]}")

    if not records:
        print("[dataset] no rows collected - aborting")
        return

    points = sorted({(r["latitude"], r["longitude"]) for r in records})
    dates = sorted({r["report_date"] for r in records})
    print(f"[enrich] {len(points)} stations, {len(dates)} dates -> elevation/ERA5/OSM")
    elev = batch_elevation(points)

    rcache_path = os.path.join(CACHE, "rivers.json")
    if os.path.exists(rcache_path):
        RIVER_CACHE.update(json.load(open(rcache_path, encoding="utf-8")))
    for i, p in enumerate(points):
        river_distance_km(p[0], p[1])
        if i % 5 == 0:
            print(f"[river] {i + 1}/{len(points)} stations", flush=True)
    print(f"[enrich] river distances done ({len(RIVER_CACHE)} cached)")

    rain = rainfall_for(dates, points)
    print(f"[enrich] rainfall entries: {len(rain)}")

    out_rows, dropped = [], 0
    for r in records:
        key = (r["latitude"], r["longitude"], r["report_date"])
        r7, mtd = rain.get(key, (None, None))
        wl, minor = r["water_level_m"], r["minor_flood_level_m"]
        if r7 is None or mtd is None or wl is None or minor in (None, 0):
            dropped += 1
            continue
        el = elev[(r["latitude"], r["longitude"])]
        rkm = RIVER_CACHE.get(f"{r['latitude']:.5f},{r['longitude']:.5f}", 0.0) * 1000.0
        out_rows.append({
            "report_date": r["report_date"], "station": r["csv_station"],
            "river": r["river"], "status": r["status"], "flood_label": r["flood_label"],
            "alert_level_m": r["alert_level_m"], "minor_flood_level_m": minor,
            "major_flood_level_m": r["major_flood_level_m"],
            "rainfall_7d_mm": round(r7, 1), "latitude": r["latitude"],
            "longitude": r["longitude"], "elevation_m": el,
            "distance_to_river_m": round(rkm, 1), "monthly_rainfall_mm": round(mtd, 1),
            "drainage_index": 0.5, "water_level_m": round(wl, 2),
            "elevation_ratio": round(el / minor, 4),
            "river_proximity_score": round(1000.0 / max(rkm, 1.0), 4),
        })

    if not out_rows:
        print(f"[dataset] all rows dropped ({dropped}) - aborting")
        return

    out_rows.sort(key=lambda x: (x["report_date"], x["station"]))
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0]))
        w.writeheader()
        w.writerows(out_rows)

    train = [r for r in out_rows if r["flood_label"] >= 0]
    pos = sum(r["flood_label"] for r in train)
    print(f"\n[dataset] rows={len(out_rows)} (dropped {dropped} missing enrichments)")
    print(f"[dataset] trainable={len(train)}  positives={pos} "
          f"({100 * pos / max(len(train), 1):.1f}%)  ambiguous Alert={len(out_rows) - len(train)}")
    print(f"[dataset] dates {out_rows[0]['report_date']} .. {out_rows[-1]['report_date']}, "
          f"{len({r['station'] for r in out_rows})} stations")
    print(f"[dataset] saved -> {OUT_CSV}")

    # quick sanity: time-based split with the same model family
    try:
        from sklearn.metrics import roc_auc_score
        from xgboost import XGBClassifier
        seen_dates = sorted({r["report_date"] for r in train})
        cut = seen_dates[int(len(seen_dates) * 0.8)]
        tr = [r for r in train if r["report_date"] < cut]
        te = [r for r in train if r["report_date"] >= cut]
        feats = ["rainfall_7d_mm", "latitude", "longitude", "elevation_m",
                 "distance_to_river_m", "monthly_rainfall_mm", "drainage_index",
                 "water_level_m", "elevation_ratio", "river_proximity_score"]
        if ({r["flood_label"] for r in tr} == {0, 1} and
                {r["flood_label"] for r in te} == {0, 1}):
            clf = XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.1,
                                eval_metric="logloss", random_state=42)
            clf.fit([[r[k] for k in feats] for r in tr],
                    [r["flood_label"] for r in tr])
            auc = roc_auc_score([r["flood_label"] for r in te],
                                clf.predict_proba([[r[k] for k in feats]
                                                   for r in te])[:, 1])
            print(f"[sanity] time-split test AUC = {auc:.3f}  "
                  f"(split at {cut}: train {len(tr)}, test {len(te)})")
        else:
            print("[sanity] split lacks both classes - skipping AUC")
    except Exception as e:  # noqa: BLE001
        print(f"[sanity] skipped: {e}")


if __name__ == "__main__":
    main()
