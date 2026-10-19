"""Camp-altitude flood check with the REAL-data model.

Question the report answers: "Is this altitude of this camp affected by flood?"

Setup (all serving features, base_model.predict_one):
  - camp 500 m from the Kelani Ganga at Hanwella gauge
  - real wet-week rainfall (400.3 mm = Q75 of real flood rows)
  - two gauge states: no data (0 m) and rising water (4 m, below alert 7 m)
  - camp altitude swept 3 m .. 50 m

Observed behavior (documented in the report): altitude strongly reduces
probability while the river is below flood stage; once the stage approaches
the minor-flood level the model conservatively flags flood at any altitude.

Output: real_validation_results/camp_altitude_risk.png + printed table.
"""
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

BASE = Path(__file__).resolve().parent
MODEL = BASE / "models" / "xgboost_model_improved.pkl"
STATIONS = BASE.parent / "resources" / "gauging_stations.csv"
OUT = BASE / "real_validation_results"

RAIN_MM = 400.3     # Q75 of real flood rows (train_real_flood dataset)
RIVER_M = 500.0     # camp distance to river
ALTS = [3, 5, 10, 15, 20, 30, 40, 50]
SERIES = [("no gauge data (0.0 m)", 0.0, "#2563EB"),
          ("river rising (4.0 m, below alert)", 4.0, "#DC2626")]


def main():
    gs = pd.read_csv(STATIONS)
    st = gs[gs["station_name"].str.contains("Hanwella", case=False, na=False)].iloc[0]
    minor = float(st["minor_flood_level"])
    lat, lon = float(st["Latitude"]), float(st["Longitude"])

    art = joblib.load(MODEL)
    est, feats, thr = art["estimator"], art["features"], float(art["threshold"])

    def prob(alt, wl):
        x = pd.DataFrame([{
            "rainfall_7d_mm": RAIN_MM, "longitude": lon, "latitude": lat,
            "elevation_m": float(alt), "distance_to_river_m": RIVER_M,
            "monthly_rainfall_mm": 0.0, "drainage_index": 0.5,
            "water_level_m": float(wl),
            "elevation_ratio": alt / minor,
            "river_proximity_score": 1000.0 / max(RIVER_M, 1.0),
        }])
        return float(est.predict_proba(x[feats])[0, 1])

    fig, ax = plt.subplots(figsize=(6.6, 4.2))
    for label, wl, color in SERIES:
        ys = [prob(a, wl) for a in ALTS]
        ax.plot(ALTS, ys, "o-", color=color, lw=2, label=f"{label}")
        print(f"{label}:")
        for a, y in zip(ALTS, ys):
            verdict = "flood" if y >= thr else "no flood"
            print(f"  camp altitude {a:2d} m -> prob {y:.3f}  ({verdict})")
        print()
    print(f"saturation check (alt 10 m): wl=6 -> {prob(10, 6):.3f}, "
          f"wl=8(minor) -> {prob(10, 8):.3f}  [model flags flood at any altitude "
          f"once stage approaches minor-flood]")

    ax.axhline(thr, color="#D97706", ls="--", lw=1, label=f"threshold {thr:.2f}")
    ax.set_xlabel("Camp altitude (m)")
    ax.set_ylabel("Flood probability")
    ax.set_ylim(0, 1)
    ax.set_title(f"Camp 500 m from Kelani Ganga (Hanwella) — rainfall {RAIN_MM:.0f} mm/7d "
                 f"(real wet-week)", fontsize=9)
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT / "camp_altitude_risk.png", dpi=140)
    print(f"\nthreshold={thr:.3f}  gauge={st['station_name']} alert/minor="
          f"{float(st['alert_level'])}/{minor} m")
    print(f"saved -> {OUT / 'camp_altitude_risk.png'}")


if __name__ == "__main__":
    main()
