"""Dataset audit script — run once to understand data quality issues."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    roc_auc_score,
    roc_curve,
)

DATASET_PATH = Path(__file__).resolve().parents[1] / "resources" / "sri_lanka_flood_risk_dataset_25000.csv"
df = pd.read_csv(DATASET_PATH)
target = df["flood_occurrence_current_event"].map({"Yes": 1, "No": 0}).astype(int)

print("=" * 70)
print("DATASET AUDIT REPORT")
print("=" * 70)

# ── 1. Basic info ──
print(f"\nShape: {df.shape}")
print(f"Target distribution:")
print(f"  No flood:  {(target == 0).sum()} ({(target == 0).mean()*100:.1f}%)")
print(f"  Flood:     {(target == 1).sum()} ({(target == 1).mean()*100:.1f}%)")
print(f"  Imbalance ratio: {(target == 0).sum() / max((target == 1).sum(), 1):.1f}:1")

# ── 2. Missing values ──
print(f"\nMissing values:")
missing = df.isnull().sum()
for col in missing[missing > 0].index:
    print(f"  {col}: {missing[col]} ({missing[col]/len(df)*100:.1f}%)")

# ── 3. Synthetic data ──
print(f"\nSynthetic data: is_synthetic unique = {df['is_synthetic'].unique()}")
print(f"All rows synthetic: {df['is_synthetic'].all()}")

# ── 4. Leakage analysis ──
print("\n" + "=" * 70)
print("LEAKAGE ANALYSIS")
print("=" * 70)

leakage_candidates = [
    "inundation_area_sqm",
    "flood_risk_score",
    "is_good_to_live",
    "reason_not_good_to_live",
    "historical_flood_count",
]

for col in leakage_candidates:
    if col not in df.columns:
        continue
    print(f"\n--- {col} ---")
    if df[col].dtype in [np.float64, np.int64, np.float32]:
        mean_yes = df.loc[target == 1, col].mean()
        mean_no = df.loc[target == 0, col].mean()
        print(f"  Mean (flood=Yes): {mean_yes:.4f}")
        print(f"  Mean (flood=No):  {mean_no:.4f}")
        corr = df[col].corr(target)
        print(f"  Correlation with target: {corr:.4f}")
    else:
        ct = pd.crosstab(df[col], target, margins=True)
        print(f"  Cross-tab:\n{ct}")

# ── 5. inundation_area is perfect leak ──
print("\n--- inUNATION AREA LEAKAGE CHECK ---")
no_flood_inundation = df.loc[target == 0, "inundation_area_sqm"]
print(f"  flood=No: all zero? {(no_flood_inundation == 0).all()}")
print(f"  flood=No: non-zero count: {(no_flood_inundation != 0).sum()}")
flood_inundation = df.loc[target == 1, "inundation_area_sqm"]
print(f"  flood=Yes: all > 0? {(flood_inundation > 0).all()}")
print(f"  flood=Yes: zero count: {(flood_inundation == 0).sum()}")

# ── 6. Feature correlations ──
print("\n" + "=" * 70)
print("FEATURE CORRELATIONS WITH TARGET")
print("=" * 70)
numerical_cols = df.select_dtypes(include=[np.number]).columns
for col in numerical_cols:
    corr = df[col].corr(target)
    if abs(corr) > 0.05:
        marker = " *** POSSIBLE LEAKAGE" if abs(corr) > 0.3 else ""
        print(f"  {col}: {corr:.4f}{marker}")

# ── 7. Current model features only ──
print("\n" + "=" * 70)
print("CURRENT MODEL FEATURES ANALYSIS")
print("=" * 70)
MODEL_FEATURES = [
    "rainfall_7d_mm", "longitude", "latitude", "elevation_m",
    "distance_to_river_m", "water_level_m", "elevation_ratio", "river_proximity_score",
]
for f in MODEL_FEATURES:
    if f in df.columns:
        print(f"  {f}: present, dtype={df[f].dtype}")
    else:
        print(f"  {f}: NOT IN DATASET (derived at runtime)")

# ── 8. Available features for training ──
print("\n" + "=" * 70)
print("ALL AVAILABLE NUMERICAL FEATURES")
print("=" * 70)
for col in sorted(numerical_cols):
    print(f"  {col}: mean={df[col].mean():.4f}, std={df[col].std():.4f}, "
          f"min={df[col].min():.4f}, max={df[col].max():.4f}")

# ── 9. Categorical features ──
print("\n" + "=" * 70)
print("CATEGORICAL FEATURES")
print("=" * 70)
cat_cols = df.select_dtypes(include=["object"]).columns
for col in sorted(cat_cols):
    if col in ["record_id", "generation_date"]:
        continue
    nunique = df[col].nunique()
    print(f"  {col}: {nunique} unique values")
    if nunique <= 10:
        print(f"    Values: {df[col].unique().tolist()}")

# ── 10. Duplicate locations ──
print("\n" + "=" * 70)
print("DUPLICATE LOCATIONS")
print("=" * 70)
loc_dupes = df.duplicated(subset=["latitude", "longitude"], keep=False)
print(f"Rows sharing exact lat/lon with another row: {loc_dupes.sum()}")

# ── 11. District distribution ──
print("\n" + "=" * 70)
print("DISTRICT DISTRIBUTION")
print("=" * 70)
district_flood = pd.crosstab(df["district"], target, margins=True)
district_flood.columns = ["No Flood", "Flood", "Total"]
district_flood["Flood %"] = (district_flood["Flood"] / district_flood["Total"] * 100).round(1)
print(district_flood.sort_values("Flood", ascending=False).head(10))

print("\n" + "=" * 70)
print("AUDIT COMPLETE")
print("=" * 70)
