"""
Validate the deployed XGBoost flood model against real disaster events.

A. Historical disaster validation
   - Real flood events: cloud-platform/prediction-models/resource-model/lka_idmc_idu_events.csv
     (IDMC internal-displacement records, Sri Lanka 2025-2026, DMC-sourced).
   - Positive set  = documented flood-event locations (type == "Flood").
   - Negative set  = control locations sampled from the legacy training dataset,
                     near-event locations (within 10 km) excluded.
   - Each location is scored under three scenarios computed from the REAL
     DMC dataset (sri_lanka_flood_real_dataset.csv):
       during_event        : Q75 rainfall of real flood rows, water_level=0 (forecast-only)
       pre_event           : median rainfall of real normal rows, water_level=0 (forecast-only)
       during_event_gauge  : Q75 rainfall AND the event location's nearest gauge at
                             minor-flood stage — the operator decision-support path
                             (same construction as validate_ditwah_case.py; controls stay 0.0)
   - Features use the PRODUCTION SERVING derivation (base_model.predict_one):
     monthly_rainfall=0.0, drainage=0.5, elevation_ratio=elevation/nearest_gauge_minor,
     real SRTM elevation (batch-fetched), and water_level_m = 0.0 for BOTH classes
     (serving default when no live gauge reading is available — this test measures
     spatial/terrain discrimination WITHOUT injecting gauge stage). Gauge-stage
     behavior (operator enters a flood stage) is covered by validate_ditwah_case.py.

B. Accuracy & reliability
   - ROC-AUC, average precision, precision/recall/F1, confusion matrix and
     detection rate per scenario, plus retrain metrics from
     real_validation_results/retrain_real_metrics.json (new model trained on the
     real DMC dataset; legacy synthetic reports kept for reference).

C. Practical applicability
   - Worked examples at real gauging stations (dry / wet / extreme rainfall).

Model note: xgboost_model_improved.pkl was retrained on the real DMC gauge
dataset (train_real_flood.py); the previous synthetic-data model is backed up
at models/xgboost_model_improved.synthetic25k.pkl.

Outputs -> edge-gateway/prediction-models/real_validation_results/
"""
from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    confusion_matrix,
    precision_recall_curve,
    precision_recall_fscore_support,
    roc_auc_score,
    roc_curve,
)

BASE = Path(__file__).resolve().parent
MODEL_PATH = BASE / "models" / "xgboost_model_improved.pkl"
DATASET_PATH = BASE.parent / "resources" / "sri_lanka_flood_risk_dataset_25000.csv"
EVENTS_PATH = BASE.parents[1] / "cloud-platform" / "prediction-models" / "resource-model" / "lka_idmc_idu_events.csv"
STATIONS_PATH = BASE.parent / "resources" / "gauging_stations.csv"
REAL_DATA_PATH = BASE.parent / "resources" / "sri_lanka_flood_real_dataset.csv"
RESULTS_DIR = BASE / "real_validation_results"
ELEV_CACHE_PATH = RESULTS_DIR / "cache" / "elevation_scoring.json"

N_CONTROLS = 500
RANDOM_STATE = 42


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * 6371.0 * np.arcsin(np.sqrt(a))


class FeatureBuilder:
    """Replicates production serving derivation (base_model.predict_one).

    water_level_m is deliberately 0.0 for every scored location (predict_one
    default when no live gauge reading is available) so both classes get the
    same stage — this external test measures terrain/geography discrimination.
    Gauge-stage behavior (operator enters a flood stage) is validate_ditwah_case.py.
    elevation_ratio uses the nearest real gauge's minor_flood_level (serving formula).
    """

    def __init__(self, stations: pd.DataFrame, real_data: pd.DataFrame):
        self.stations = stations
        self.s_lat = stations["Latitude"].to_numpy(dtype=float)
        self.s_lon = stations["Longitude"].to_numpy(dtype=float)
        self.wet_rain = float(real_data.loc[real_data["flood_label"] == 1,
                                            "rainfall_7d_mm"].quantile(0.75))
        self.dry_rain = float(real_data.loc[real_data["flood_label"] == 0,
                                            "rainfall_7d_mm"].median())

    def nearest_gauge(self, lat: float, lon: float):
        d = haversine_km(self.s_lat, self.s_lon, lat, lon)
        return self.stations.iloc[int(np.argmin(d))]

    def __call__(self, lat, lon, elev_m, river_m, rainfall_mm,
                 water_level: float = 0.0) -> pd.DataFrame:
        st = self.nearest_gauge(lat, lon)
        minor = float(st["minor_flood_level"]) if pd.notna(st["minor_flood_level"]) else 0.0
        return pd.DataFrame([{
            "rainfall_7d_mm": float(rainfall_mm),
            "longitude": float(lon),
            "latitude": float(lat),
            "elevation_m": float(elev_m),
            "distance_to_river_m": float(river_m),
            "monthly_rainfall_mm": 0.0,
            "drainage_index": 0.5,
            "water_level_m": float(water_level),
            "elevation_ratio": float(elev_m) / minor if minor > 0 else 1.0,
            "river_proximity_score": 1000.0 / max(float(river_m), 1.0) if river_m > 0 else 0.0,
        }])


def fetch_elevation(points) -> dict:
    """Batch-fetch real SRTM elevation for all scoring points (cached)."""
    ELEV_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    cache = json.loads(ELEV_CACHE_PATH.read_text()) if ELEV_CACHE_PATH.exists() else {}
    missing = [p for p in points if f"{p[0]:.5f},{p[1]:.5f}" not in cache]
    for i in range(0, len(missing), 80):
        chunk = missing[i:i + 80]
        lat = ",".join(f"{p[0]:.5f}" for p in chunk)
        lon = ",".join(f"{p[1]:.5f}" for p in chunk)
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
        last = None
        for attempt in range(6):
            try:
                with urllib.request.urlopen(
                        urllib.request.Request(url, headers={"User-Agent": "smartcamp-validation"}),
                        timeout=40) as r:
                    els = json.loads(r.read())["elevation"]
                for p, e in zip(chunk, els):
                    cache[f"{p[0]:.5f},{p[1]:.5f}"] = e
                last = None
                break
            except Exception as e:  # noqa: BLE001
                last = e
                import time as _t
                _t.sleep(3 * (attempt + 1))
        if last is not None:
            raise RuntimeError(f"elevation batch failed: {last}")
        ELEV_CACHE_PATH.write_text(json.dumps(cache))  # save per chunk (resume-safe)
    ELEV_CACHE_PATH.write_text(json.dumps(cache))
    return {p: cache[f"{p[0]:.5f},{p[1]:.5f}"] for p in points}


def score(estimator, features_cols, row: pd.DataFrame) -> float:
    return float(estimator.predict_proba(row[features_cols])[0, 1])


def metrics_block(y_true, probs, threshold) -> dict:
    preds = (probs >= threshold).astype(int)
    p, r, f1, _ = precision_recall_fscore_support(y_true, preds, average="binary", zero_division=0)
    return {
        "threshold": float(threshold),
        "roc_auc": float(roc_auc_score(y_true, probs)),
        "average_precision": float(average_precision_score(y_true, probs)),
        "precision": float(p),
        "recall": float(r),
        "f1": float(f1),
        "confusion_matrix": confusion_matrix(y_true, preds).tolist(),
        "classification_report": classification_report(y_true, preds, zero_division=0, output_dict=True),
    }


def save_charts(y_true, probs, threshold, tag: str) -> None:
    fpr, tpr, _ = roc_curve(y_true, probs)
    auc = roc_auc_score(y_true, probs)
    plt.figure(figsize=(5.5, 4.2))
    plt.plot(fpr, tpr, color="#059669", lw=2, label=f"Model (AUC = {auc:.3f})")
    plt.plot([0, 1], [0, 1], color="#9CA3AF", lw=1, ls="--", label="Random")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title(f"ROC — real flood events vs controls ({tag})")
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / f"roc_curve_{tag}.png", dpi=140)
    plt.close()

    cm = confusion_matrix(y_true, (probs >= threshold).astype(int))
    plt.figure(figsize=(4.2, 3.6))
    plt.imshow(cm, cmap="Blues")
    for (i, j), v in np.ndenumerate(cm):
        plt.text(j, i, str(v), ha="center", va="center", color="black", fontsize=12)
    plt.xticks([0, 1], ["No flood", "Flood"])
    plt.yticks([0, 1], ["No flood", "Flood"])
    plt.xlabel("Predicted")
    plt.ylabel("Actual (IDMC event)")
    plt.title(f"Confusion matrix @thr={threshold:.3f} ({tag})")
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / f"confusion_matrix_{tag}.png", dpi=140)
    plt.close()


def main() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    artifact = joblib.load(MODEL_PATH)
    estimator = artifact["estimator"]
    art_threshold = float(artifact.get("threshold", 0.50))
    features_cols = artifact["features"]

    dataset = pd.read_csv(DATASET_PATH)
    dataset["label"] = (dataset["flood_occurrence_current_event"].astype(str).str.strip().str.lower() == "yes").astype(int)
    print(f"Dataset rows: {len(dataset)}  positives: {dataset['label'].sum()}")

    stations = pd.read_csv(STATIONS_PATH)
    real_df = pd.read_csv(REAL_DATA_PATH)
    fb = FeatureBuilder(stations, real_df)
    wet_rain = fb.wet_rain
    dry_rain = fb.dry_rain
    # event_stage=True: operator provides the real gauge stage (event locations are
    # at minor-flood stage — the decision-support path used by validate_ditwah_case).
    scenarios = {
        "during_event": {"rain": wet_rain, "event_stage": False},
        "pre_event": {"rain": dry_rain, "event_stage": False},
        "during_event_gauge": {"rain": wet_rain, "event_stage": True},
    }
    print(f"Scenarios (from REAL DMC dataset): during_event={wet_rain:.1f}mm / pre_event={dry_rain:.1f}mm "
          f"without gauge stage; during_event_gauge = same rain WITH real gauge stage at event locations")

    def nearest_static(lat, lon):
        d = haversine_km(dataset["latitude"].values, dataset["longitude"].values, lat, lon)
        return dataset.iloc[int(np.argmin(d))], float(np.min(d))

    events = pd.read_csv(EVENTS_PATH)
    floods = events[events["type"].astype(str).str.strip().str.lower() == "flood"].copy()
    print(f"Real flood events (IDMC): {len(floods)}")

    # ── Event metadata (scoring happens after elevation prefetch) ──
    event_meta = []
    for _, ev in floods.iterrows():
        lat, lon = float(ev["latitude"]), float(ev["longitude"])
        base, dist_km = nearest_static(lat, lon)
        sd = haversine_km(stations["Latitude"].values, stations["Longitude"].values, lat, lon)
        st = stations.iloc[int(np.argmin(sd))]
        event_meta.append({
            "entry": {
                "event_id": ev["event_id"],
                "event_name": ev["event_name"],
                "locations_name": ev["locations_name"],
                "latitude": lat,
                "longitude": lon,
                "year": int(ev["year"]) if pd.notna(ev["year"]) else None,
                "displaced_figure": float(ev["figure"]) if pd.notna(ev["figure"]) else None,
                "nearest_gauge": st["station_name"],
                "static_proxy_river_m": float(base["distance_to_river_m"]),
                "static_source_distance_km": round(dist_km, 2),
            },
            "lat": lat, "lon": lon,
            "river_m": float(base["distance_to_river_m"]),
        })

    # ── Control locations ──
    neg_pool = dataset[dataset["label"] == 0]
    keep_mask = np.ones(len(neg_pool), dtype=bool)
    for _, ev in floods.iterrows():
        d = haversine_km(neg_pool["latitude"].values, neg_pool["longitude"].values,
                         float(ev["latitude"]), float(ev["longitude"]))
        keep_mask &= d > 10.0
    neg_pool = neg_pool[keep_mask]
    controls = neg_pool.sample(n=min(N_CONTROLS, len(neg_pool)), random_state=RANDOM_STATE)
    print(f"Controls: {len(controls)} (excluded within 10 km of any event)")

    # ── Real SRTM elevation for every scored point (+ stations for Part C) ──
    points = [(m["lat"], m["lon"]) for m in event_meta]
    points += [(float(c["latitude"]), float(c["longitude"])) for _, c in controls.iterrows()]
    points += [(float(s["Latitude"]), float(s["Longitude"])) for _, s in stations.iterrows()]
    elev = fetch_elevation(points)
    print(f"Real elevations fetched: {len(elev)} points")

    # ── Score real flood-event locations ──
    event_rows = []
    for m in event_meta:
        e = elev[(m["lat"], m["lon"])]
        m["entry"]["static_proxy_elevation_m"] = e  # real SRTM (was synthetic proxy)
        m["entry"]["elevation_source"] = "SRTM (Open-Meteo)"
        st_gauge = fb.nearest_gauge(m["lat"], m["lon"])
        gauge_minor = (float(st_gauge["minor_flood_level"])
                       if pd.notna(st_gauge["minor_flood_level"]) else 0.0)
        for tag, sc in scenarios.items():
            wl = gauge_minor if sc["event_stage"] else 0.0  # operator reports flood stage
            m["entry"][f"prob_{tag}"] = score(
                estimator, features_cols,
                fb(m["lat"], m["lon"], e, m["river_m"], sc["rain"], water_level=wl))
        event_rows.append(m["entry"])
    ev_df = pd.DataFrame(event_rows)

    # ── Score control locations (real SRTM elevation; no flood stage reported) ──
    control_probs = {tag: [] for tag in scenarios}
    for _, c in controls.iterrows():
        e = elev[(float(c["latitude"]), float(c["longitude"]))]
        for tag, sc in scenarios.items():
            control_probs[tag].append(score(
                estimator, features_cols,
                fb(float(c["latitude"]), float(c["longitude"]), e,
                   float(c["distance_to_river_m"]), sc["rain"], water_level=0.0)))

    # ── Metrics ──
    results = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_artifact": MODEL_PATH.name,
        "artifact_threshold": art_threshold,
        "artifact_stored_metrics": artifact.get("metrics", {}),
        "n_real_flood_events": int(len(ev_df)),
        "n_controls": int(len(controls)),
        "scenario_definitions": {
            "during_event": {"rainfall_7d_mm": wet_rain, "water_level_m": 0.0,
                             "meaning": "Q75 rainfall of REAL flood rows; NO gauge stage (forecast-only test)"},
            "pre_event": {"rainfall_7d_mm": dry_rain, "water_level_m": 0.0,
                          "meaning": "median rainfall of REAL normal rows; NO gauge stage (forecast-only test)"},
            "during_event_gauge": {"rainfall_7d_mm": wet_rain,
                                   "water_level_m": "event locations at nearest-gauge minor-flood stage; controls 0.0",
                                   "meaning": "operator reports the gauge in flood at the event location "
                                              "(decision-support path; same construction as validate_ditwah_case.py)"},
        },
        "internal_validation_from_reports": {},
        "external_validation": {},
    }

    p_real = RESULTS_DIR / "retrain_real_metrics.json"
    if p_real.exists():
        try:
            results["internal_validation_from_reports"]["retrain_real_metrics.json"] = \
                json.loads(p_real.read_text())["test_metrics_at_f2_threshold"]
        except Exception as e:  # noqa: BLE001
            results["internal_validation_from_reports"]["retrain_real_metrics.json"] = {"error": str(e)}

    for rep_name, key in [("comprehensive_validation_report.json", ("training", "xgboost")),
                          ("improved_validation_report.json", ("model_comparison", "xgboost"))]:
        p = BASE / "comparison_results" / rep_name
        if p.exists():
            try:
                node = json.loads(p.read_text()).get(key[0], {}).get(key[1], {})
                results["internal_validation_from_reports"][rep_name] = {
                    k: node.get(k) for k in ("accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc", "brier", "confusion_matrix") if k in node}
            except Exception as e:  # noqa: BLE001
                results["internal_validation_from_reports"][rep_name] = {"error": str(e)}

    for tag in scenarios:
        y_true = np.r_[np.ones(len(ev_df)), np.zeros(len(controls))]
        probs = np.r_[ev_df[f"prob_{tag}"].values, np.array(control_probs[tag])]
        block = {
            "at_artifact_threshold": metrics_block(y_true, probs, art_threshold),
            "at_threshold_0_5": metrics_block(y_true, probs, 0.5),
            "event_detection_rate_artifact_thr": float((ev_df[f"prob_{tag}"] >= art_threshold).mean()),
            "event_detection_rate_0_5": float((ev_df[f"prob_{tag}"] >= 0.5).mean()),
            "mean_prob_events": float(ev_df[f"prob_{tag}"].mean()),
            "mean_prob_controls": float(np.mean(control_probs[tag])),
        }
        results["external_validation"][tag] = block
        save_charts(y_true, probs, art_threshold, tag)

    # ── Part C worked examples at real gauging stations ──
    extreme_rain = float(real_df.loc[real_df["flood_label"] == 1, "rainfall_7d_mm"].quantile(0.95))
    examples = []
    for st_name in ["Nagalagam Street", "Rathnapura", "Badalgama", "Baddegama"]:
        st_rows = stations[stations["station_name"].astype(str).str.contains(st_name, case=False, na=False)]
        if st_rows.empty:
            continue
        st = st_rows.iloc[0]
        lat, lon = float(st["Latitude"]), float(st["Longitude"])
        base, _ = nearest_static(lat, lon)
        st_elev = elev[(lat, lon)]
        ex = {
            "station": st["station_name"], "river": st["river_name"],
            "latitude": lat, "longitude": lon,
            "gauge_alert_level": float(st["alert_level"]) if pd.notna(st["alert_level"]) else None,
            "gauge_minor_level": float(st["minor_flood_level"]) if pd.notna(st["minor_flood_level"]) else None,
            "static_proxy_elevation_m": st_elev,
            "elevation_source": "SRTM (Open-Meteo)",
            "static_proxy_river_m": float(base["distance_to_river_m"]),
        }
        for tag, rain in [("dry_baseline", dry_rain), ("wet_conditions", wet_rain), ("extreme_rainfall", extreme_rain)]:
            prob = score(estimator, features_cols, fb(lat, lon, st_elev, base["distance_to_river_m"], rain))
            ex[f"rainfall_{tag}_mm"] = round(rain, 1)
            ex[f"prob_{tag}"] = prob
            ex[f"risk_{tag}"] = "High" if prob >= 0.70 else "Medium" if prob >= 0.40 else "Low"
        examples.append(ex)
    results["worked_examples"] = examples

    ev_df = ev_df.sort_values("prob_during_event", ascending=False)
    ev_df.to_csv(RESULTS_DIR / "per_event_predictions.csv", index=False)
    (RESULTS_DIR / "real_event_validation_metrics.json").write_text(json.dumps(results, indent=2))

    print("\n=== EXTERNAL VALIDATION (real IDMC flood events vs controls) ===")
    for tag, block in results["external_validation"].items():
        a = block["at_artifact_threshold"]
        print(f"\n[{tag}] rainfall={scenarios[tag]['rain']:.1f}mm"
              f"{'  + gauge stage' if scenarios[tag]['event_stage'] else '  (no gauge stage)'}")
        print(f"  ROC-AUC={a['roc_auc']:.3f}  AP={a['average_precision']:.3f}  precision={a['precision']:.3f}  "
              f"recall={a['recall']:.3f}  F1={a['f1']:.3f} @ thr {art_threshold:.2f}")
        print(f"  confusion={a['confusion_matrix']}  detection_rate={block['event_detection_rate_artifact_thr']:.1%}  "
              f"meanP(event)={block['mean_prob_events']:.3f} vs meanP(control)={block['mean_prob_controls']:.3f}")
    print("\n=== TOP-DETECTED REAL EVENTS (during_event) ===")
    print(ev_df.head(10)[["event_name", "locations_name", "prob_during_event",
                          "prob_during_event_gauge", "prob_pre_event",
                          "displaced_figure"]].to_string(index=False))
    print("\n=== WORKED EXAMPLES (Part C) ===")
    for ex in examples:
        print(f"  {ex['station']} ({ex['river']}): dry={ex['prob_dry_baseline']:.3f}({ex['risk_dry_baseline']}) | "
              f"wet={ex['prob_wet_conditions']:.3f}({ex['risk_wet_conditions']}) | "
              f"extreme={ex['prob_extreme_rainfall']:.3f}({ex['risk_extreme_rainfall']})")
    print(f"\nOutputs written to: {RESULTS_DIR}")


if __name__ == "__main__":
    main()
