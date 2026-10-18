"""
Validate the deployed XGBoost flood model against real disaster events.

A. Historical disaster validation
   - Real flood events: cloud-platform/prediction-models/resource-model/lka_idmc_idu_events.csv
     (IDMC internal-displacement records, Sri Lanka 2025-2026, DMC-sourced).
   - Positive set  = documented flood-event locations (type == "Flood").
   - Negative set  = control locations sampled from the training dataset,
                     near-event locations (within 10 km) excluded.
   - Historical per-event rainfall is not in the repo, so each location is scored
     under two training-consistent scenarios:
       during_event : rainfall = 75th percentile of flood-positive training rows
       pre_event    : rainfall = median of flood-negative training rows
     All other derived features (water_level_m, elevation_ratio,
     river_proximity_score) use EXACTLY the training formulas (train_improved.py:127-139)
     so the validation asks "what would the model have said at this place".

B. Accuracy & reliability
   - ROC-AUC, average precision, precision/recall/F1, confusion matrix and
     detection rate per scenario, plus internal hold-out / CV metrics from
     comparison_results/*.json and the artifact's own stored metrics.

C. Practical applicability
   - Worked examples at real gauging stations (dry / wet / extreme rainfall).

Known serving skew (documented, not fixed here): production inference
(base_model.predict_one) uses elevation_ratio = elevation/gauge_minor_level and a
live gauge water_level_m, while the artifact was trained with
elevation_ratio = elevation/dataset_mean and a formula-derived water_level_m.

Outputs -> edge-gateway/prediction-models/real_validation_results/
"""
from __future__ import annotations

import json
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
RESULTS_DIR = BASE / "real_validation_results"

N_CONTROLS = 500
RANDOM_STATE = 42


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * 6371.0 * np.arcsin(np.sqrt(a))


class FeatureBuilder:
    """Replicates the training-time feature derivation (train_improved.py)."""

    def __init__(self, dataset: pd.DataFrame):
        self.mean_elev = float(dataset["elevation_m"].mean())
        self.rain_max = max(float(dataset["rainfall_7d_mm"].max()), 1.0)
        self.elev_max = max(float(dataset["elevation_m"].max()), 1.0)
        self.river_max = max(float(dataset["distance_to_river_m"].max()), 1.0)

    def __call__(self, lat, lon, elev_m, river_m, rainfall_mm) -> pd.DataFrame:
        water = (
            (rainfall_mm / self.rain_max) * 0.4
            + (1.0 - elev_m / self.elev_max) * 0.3
            + (1.0 - river_m / self.river_max) * 0.3
        ) * 8.0
        return pd.DataFrame([{
            "rainfall_7d_mm": float(rainfall_mm),
            "longitude": float(lon),
            "latitude": float(lat),
            "elevation_m": float(elev_m),
            "distance_to_river_m": float(river_m),
            "monthly_rainfall_mm": 0.0,
            "drainage_index": 0.5,
            "water_level_m": float(water),
            "elevation_ratio": float(elev_m) / self.mean_elev,
            "river_proximity_score": 1000.0 / max(float(river_m), 1.0),
        }])


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

    fb = FeatureBuilder(dataset)
    wet_rain = float(dataset.loc[dataset["label"] == 1, "rainfall_7d_mm"].quantile(0.75))
    dry_rain = float(dataset.loc[dataset["label"] == 0, "rainfall_7d_mm"].median())
    scenarios = {"during_event": wet_rain, "pre_event": dry_rain}
    print(f"Scenarios: during_event rainfall={wet_rain:.1f}mm (Q75 of flood=Yes), pre_event rainfall={dry_rain:.1f}mm (median of flood=No)")

    def nearest_static(lat, lon):
        d = haversine_km(dataset["latitude"].values, dataset["longitude"].values, lat, lon)
        return dataset.iloc[int(np.argmin(d))], float(np.min(d))

    events = pd.read_csv(EVENTS_PATH)
    floods = events[events["type"].astype(str).str.strip().str.lower() == "flood"].copy()
    print(f"Real flood events (IDMC): {len(floods)}")

    stations = pd.read_csv(STATIONS_PATH)

    # ── Score every real flood-event location ──
    event_rows = []
    for _, ev in floods.iterrows():
        lat, lon = float(ev["latitude"]), float(ev["longitude"])
        base, dist_km = nearest_static(lat, lon)
        sd = haversine_km(stations["Latitude"].values, stations["Longitude"].values, lat, lon)
        st = stations.iloc[int(np.argmin(sd))]
        entry = {
            "event_id": ev["event_id"],
            "event_name": ev["event_name"],
            "locations_name": ev["locations_name"],
            "latitude": lat,
            "longitude": lon,
            "year": int(ev["year"]) if pd.notna(ev["year"]) else None,
            "displaced_figure": float(ev["figure"]) if pd.notna(ev["figure"]) else None,
            "nearest_gauge": st["station_name"],
            "static_proxy_elevation_m": float(base["elevation_m"]),
            "static_proxy_river_m": float(base["distance_to_river_m"]),
            "static_source_distance_km": round(dist_km, 2),
        }
        for tag, rain in scenarios.items():
            entry[f"prob_{tag}"] = score(estimator, features_cols,
                                         fb(lat, lon, base["elevation_m"], base["distance_to_river_m"], rain))
        event_rows.append(entry)
    ev_df = pd.DataFrame(event_rows)

    # ── Score control locations ──
    neg_pool = dataset[dataset["label"] == 0]
    keep_mask = np.ones(len(neg_pool), dtype=bool)
    for _, ev in floods.iterrows():
        d = haversine_km(neg_pool["latitude"].values, neg_pool["longitude"].values,
                         float(ev["latitude"]), float(ev["longitude"]))
        keep_mask &= d > 10.0
    neg_pool = neg_pool[keep_mask]
    controls = neg_pool.sample(n=min(N_CONTROLS, len(neg_pool)), random_state=RANDOM_STATE)
    print(f"Controls: {len(controls)} (excluded within 10 km of any event)")

    control_probs = {tag: [] for tag in scenarios}
    for _, c in controls.iterrows():
        for tag, rain in scenarios.items():
            control_probs[tag].append(score(estimator, features_cols,
                                            fb(c["latitude"], c["longitude"], c["elevation_m"],
                                               c["distance_to_river_m"], rain)))

    # ── Metrics ──
    results = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_artifact": MODEL_PATH.name,
        "artifact_threshold": art_threshold,
        "artifact_stored_metrics": artifact.get("metrics", {}),
        "n_real_flood_events": int(len(ev_df)),
        "n_controls": int(len(controls)),
        "scenario_definitions": {
            "during_event": {"rainfall_7d_mm": wet_rain,
                             "meaning": "Q75 rainfall of flood-positive training rows (proxy for conditions during a flood event)"},
            "pre_event": {"rainfall_7d_mm": dry_rain,
                          "meaning": "median rainfall of flood-negative training rows (proxy for baseline before rainfall)"},
        },
        "internal_validation_from_reports": {},
        "external_validation": {},
    }

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
    extreme_rain = float(dataset.loc[dataset["label"] == 1, "rainfall_7d_mm"].quantile(0.95))
    examples = []
    for st_name in ["Nagalagam Street", "Rathnapura", "Badalgama", "Baddegama"]:
        st_rows = stations[stations["station_name"].astype(str).str.contains(st_name, case=False, na=False)]
        if st_rows.empty:
            continue
        st = st_rows.iloc[0]
        lat, lon = float(st["Latitude"]), float(st["Longitude"])
        base, _ = nearest_static(lat, lon)
        ex = {
            "station": st["station_name"], "river": st["river_name"],
            "latitude": lat, "longitude": lon,
            "gauge_alert_level": float(st["alert_level"]) if pd.notna(st["alert_level"]) else None,
            "gauge_minor_level": float(st["minor_flood_level"]) if pd.notna(st["minor_flood_level"]) else None,
            "static_proxy_elevation_m": float(base["elevation_m"]),
            "static_proxy_river_m": float(base["distance_to_river_m"]),
        }
        for tag, rain in [("dry_baseline", dry_rain), ("wet_conditions", wet_rain), ("extreme_rainfall", extreme_rain)]:
            prob = score(estimator, features_cols, fb(lat, lon, base["elevation_m"], base["distance_to_river_m"], rain))
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
        print(f"\n[{tag}] rainfall={scenarios[tag]:.1f}mm")
        print(f"  ROC-AUC={a['roc_auc']:.3f}  AP={a['average_precision']:.3f}  precision={a['precision']:.3f}  "
              f"recall={a['recall']:.3f}  F1={a['f1']:.3f} @ thr {art_threshold:.2f}")
        print(f"  confusion={a['confusion_matrix']}  detection_rate={block['event_detection_rate_artifact_thr']:.1%}  "
              f"meanP(event)={block['mean_prob_events']:.3f} vs meanP(control)={block['mean_prob_controls']:.3f}")
    print("\n=== TOP-DETECTED REAL EVENTS (during_event) ===")
    print(ev_df.head(10)[["event_name", "locations_name", "prob_during_event", "prob_pre_event", "displaced_figure"]].to_string(index=False))
    print("\n=== WORKED EXAMPLES (Part C) ===")
    for ex in examples:
        print(f"  {ex['station']} ({ex['river']}): dry={ex['prob_dry_baseline']:.3f}({ex['risk_dry_baseline']}) | "
              f"wet={ex['prob_wet_conditions']:.3f}({ex['risk_wet_conditions']}) | "
              f"extreme={ex['prob_extreme_rainfall']:.3f}({ex['risk_extreme_rainfall']})")
    print(f"\nOutputs written to: {RESULTS_DIR}")


if __name__ == "__main__":
    main()
