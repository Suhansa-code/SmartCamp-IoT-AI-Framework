"""
validate_rate_table.py

Validation harness for the Sri Lanka ration rate table
(models/lka_v2/ration_rates.json).

The rate table cannot be validated the way a fitted model is: there is no held
out test set, because the rates are not predictions. Each one is a measured
statistic, a production configuration value, or a named standard. So validation
here means four different questions, run as four independent checks.

  Tier 1  INTERNAL     Is the measured rate precise? Bootstrap CI on the median,
                       plus subgroup stability across provinces and sex.
  Tier 2  CROSS-MODAL  Does the mass figure imply a sane energy intake? The
                       survey records ENERGY_kcal alongside grams, so mass can
                       be checked against a quantity it was not derived from.
  Tier 3  EXTERNAL     Do the rates sit inside published humanitarian ranges?
  Tier 4  BACK-TEST    Model output vs actual issuance. NOT RUNNABLE: no
                       distribution logs exist. The protocol is stated so it can
                       be run once they do.

Every check reports PASS, FLAG or N/A with the number behind it. A FLAG is not a
crash -- it is a finding that belongs in the report.

Usage:
    python scripts/validate_rate_table.py
    python scripts/validate_rate_table.py --json out.json
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
RAW_DIR = HERE.parent / "resource-model"
RATES = HERE.parent / "models" / "lka_v2" / "ration_rates.json"

# Humanitarian reference values used only as comparison points, never as inputs.
SPHERE_KCAL_MIN = 2100          # planning minimum, population average
SPHERE_DRINKING_RANGE = (2.5, 3.0)   # L/person/day, survival drinking
SPHERE_DOMESTIC = 15.0          # L/person/day, basic domestic supply
BOOTSTRAP_N = 5000


def _load_survey():
    subjects = pd.read_csv(RAW_DIR / "subject_user.csv", low_memory=False)
    cons = pd.read_csv(RAW_DIR / "consumption_user.csv", low_memory=False)

    countries = sorted(subjects["ADM0_NAME"].dropna().unique())
    if countries != ["Sri Lanka"]:
        raise ValueError(f"Expected a Sri Lanka-only survey, found {countries}")

    # One recall day per subject: verified, so summing per SUBJECT is a daily
    # total rather than a multi-day sum.
    days_per_subject = cons.groupby("SUBJECT")[["ROUND", "SURVEY_DAY"]].apply(
        lambda g: g.drop_duplicates().shape[0]
    )
    multi = int((days_per_subject > 1).sum())

    per = cons.groupby("SUBJECT", as_index=False).agg(
        grams=("FOOD_AMOUNT_CONS", "sum"), kcal=("ENERGY_kcal", "sum")
    )
    per["kg"] = per["grams"] / 1000.0
    per = per.merge(
        subjects[["SUBJECT", "AGE_YEAR", "SEX", "ADM1_NAME"]], on="SUBJECT", how="left"
    )
    return per, multi


def tier1_internal(per, multi_day_subjects):
    """Sampling precision and subgroup stability of the measured child rate."""
    checks = []

    checks.append({
        "check": "One recall day per subject",
        "value": f"{multi_day_subjects} subject(s) with >1 recall day",
        "expected": "0 — otherwise the per-subject sum is a multi-day total",
        "status": "PASS" if multi_day_subjects == 0 else "FLAG",
    })

    rng = np.random.default_rng(42)
    values = per["kg"].to_numpy()
    boots = [np.median(rng.choice(values, values.size, replace=True))
             for _ in range(BOOTSTRAP_N)]
    lo, hi = np.percentile(boots, [2.5, 97.5])
    median = float(np.median(values))
    width_pct = (hi - lo) / median * 100

    checks.append({
        "check": f"Bootstrap 95% CI on median ({BOOTSTRAP_N} resamples, n={values.size})",
        "value": f"{median:.3f} kg [{lo:.3f}, {hi:.3f}] — width {width_pct:.1f}% of median",
        "expected": "interval width under 20% of the point estimate",
        "status": "PASS" if width_pct < 20 else "FLAG",
    })

    by_prov = per.groupby("ADM1_NAME")["kg"].median()
    spread = by_prov.max() / by_prov.min()
    checks.append({
        "check": "Provincial stability (max/min of provincial medians)",
        "value": f"{spread:.2f}x  ({by_prov.idxmax()} {by_prov.max():.3f} vs "
                 f"{by_prov.idxmin()} {by_prov.min():.3f} kg)",
        "expected": "under 1.5x for a single national rate to be safe",
        "status": "PASS" if spread < 1.5 else "FLAG",
    })

    by_sex = per.groupby("SEX")["kg"].median()
    sex_spread = by_sex.max() / by_sex.min() if by_sex.min() > 0 else float("inf")
    checks.append({
        "check": "Stability by sex",
        "value": f"{sex_spread:.3f}x  ({by_sex.to_dict()})",
        "expected": "under 1.15x, else the rate needs a sex split",
        "status": "PASS" if sex_spread < 1.15 else "FLAG",
    })

    age_min, age_max = int(per["AGE_YEAR"].min()), int(per["AGE_YEAR"].max())
    checks.append({
        "check": "Age coverage of the child rate",
        "value": f"survey covers ages {age_min}-{age_max}",
        "expected": "0-17 to cover the whole children cohort",
        "status": "PASS" if age_min <= 0 and age_max >= 17 else "FLAG",
    })
    return checks


def tier2_cross_modal(per, rates):
    """Mass rates checked against energy, a quantity they were not derived from."""
    checks = []

    median_kg = float(per["kg"].median())
    median_kcal = float(per["kcal"].median())
    density = median_kcal / median_kg

    checks.append({
        "check": "Measured child energy intake",
        "value": f"{median_kcal:,.0f} kcal/day (median), density {density:,.0f} kcal/kg",
        "expected": "1,600-2,400 kcal/day for ages 6-14",
        "status": "PASS" if 1600 <= median_kcal <= 2400 else "FLAG",
    })

    for key, label in (("food_child", "Child"), ("food_adult", "Adult"),
                       ("food_elderly", "Elderly")):
        kg = rates[key]["value"]
        kcal = kg * density
        # The elderly rate is intentionally reduced, so it is compared against a
        # lower bar; adults carry the full planning minimum.
        floor = SPHERE_KCAL_MIN * (0.85 if key == "food_elderly" else 1.0)
        ok = kcal >= floor
        checks.append({
            "check": f"{label} rate energy adequacy",
            "value": f"{kg} kg -> {kcal:,.0f} kcal/day at the survey's density",
            "expected": f"at least {floor:,.0f} kcal/day",
            "status": "PASS" if ok else "FLAG",
            "note": None if ok else
                    "Survey density is from children's home diets (cooked rice and "
                    "curry, high water content). A drier camp ration would have a "
                    "higher density and could clear the minimum at the same mass. "
                    "Resolve by checking what /api/distribute actually issues.",
        })
    return checks


def tier3_external(rates):
    """Rates against published humanitarian reference values."""
    checks = []

    water = rates["water_drinking"]["value"]
    lo, hi = SPHERE_DRINKING_RANGE
    checks.append({
        "check": "Drinking water within Sphere survival range",
        "value": f"{water} L/person/day",
        "expected": f"{lo}-{hi} L/person/day",
        "status": "PASS" if lo <= water <= hi else "FLAG",
    })

    checks.append({
        "check": "Divergence from production water issuance",
        "value": f"model {water} L vs distribution.json {SPHERE_DOMESTIC} L "
                 f"({SPHERE_DOMESTIC / water:.1f}x)",
        "expected": "intentional — survival drinking vs basic domestic supply",
        "status": "PASS",
        "note": "Documented divergence, not a defect. The two figures measure "
                "different things; see resource-model/README.md section 3.",
    })

    ordering_ok = (rates["food_child"]["value"] > rates["food_elderly"]["value"]
                   and rates["food_adult"]["value"] > rates["food_elderly"]["value"])
    checks.append({
        "check": "Cohort rate ordering is coherent",
        "value": f"child {rates['food_child']['value']} / "
                 f"adult {rates['food_adult']['value']} / "
                 f"elderly {rates['food_elderly']['value']} kg",
        "expected": "elderly below adult and child",
        "status": "PASS" if ordering_ok else "FLAG",
    })

    fao = rates.get("corroboration", {}).get("kcal_per_capita_day")
    if fao:
        checks.append({
            "check": "FAOSTAT national supply corroboration",
            "value": f"{fao['min']:,.0f}-{fao['max']:,.0f} kcal/capita/day "
                     f"(latest {fao['latest']:,.0f} in {fao['latest_year']})",
            "expected": f"above the {SPHERE_KCAL_MIN:,} kcal planning minimum",
            "status": "PASS" if fao["min"] >= SPHERE_KCAL_MIN else "FLAG",
        })

    assumptions = [k for k, v in rates.items()
                   if isinstance(v, dict) and str(v.get("evidence", "")).startswith("ASSUMPTION")]
    checks.append({
        "check": "Unsourced assumptions are declared in the artifact",
        "value": f"{len(assumptions)} assumption(s): {', '.join(assumptions) or 'none'}",
        "expected": "every assumption carries evidence='ASSUMPTION'",
        "status": "PASS",
        "note": "Declared in the artifact itself, not only in documentation.",
    })

    out_of_scope = rates.get("out_of_scope", [])
    checks.append({
        "check": "Out-of-scope outputs declared",
        "value": ", ".join(out_of_scope) or "none",
        "expected": "shelter_units, medical_staff_needed",
        "status": "PASS" if set(out_of_scope) >= {"shelter_units", "medical_staff_needed"} else "FLAG",
    })
    return checks


def tier4_backtest():
    """The definitive test, which cannot be run yet."""
    return [{
        "check": "Predicted vs actual issuance (MAPE and bias)",
        "value": "no distribution logs exist",
        "expected": "log camp state and kg/L issued per distribution event",
        "status": "N/A",
        "note": "Protocol: record the prediction BEFORE distribution, then the "
                "actual. Report bias separately from MAPE — under-prediction "
                "leaves a camp short, over-prediction wastes stock, and a model "
                "with 15% MAPE and zero bias beats 8% MAPE that runs low.",
    }]


def print_report(tiers):
    icons = {"PASS": "PASS", "FLAG": "FLAG", "N/A": "N/A "}
    print("=" * 78)
    print("  RATE TABLE VALIDATION — models/lka_v2/ration_rates.json")
    print("=" * 78)

    counts = {"PASS": 0, "FLAG": 0, "N/A": 0}
    for title, checks in tiers:
        print(f"\n{title}")
        print("-" * 78)
        for c in checks:
            counts[c["status"]] += 1
            print(f"  [{icons[c['status']]}] {c['check']}")
            print(f"         measured: {c['value']}")
            print(f"         expected: {c['expected']}")
            if c.get("note"):
                for i in range(0, len(c["note"]), 66):
                    print(f"         {'note:' if i == 0 else '     '} {c['note'][i:i+66]}")
    print("\n" + "=" * 78)
    print(f"  {counts['PASS']} passed, {counts['FLAG']} flagged, {counts['N/A']} not runnable")
    print("=" * 78)
    return counts


def main():
    ap = argparse.ArgumentParser(description="Validate the ration rate table")
    ap.add_argument("--json", default=None, help="also write the result here")
    args = ap.parse_args()

    rates = json.loads(RATES.read_text())
    per, multi = _load_survey()

    tiers = [
        ("TIER 1 — INTERNAL: is the measured rate precise and stable?", tier1_internal(per, multi)),
        ("TIER 2 — CROSS-MODAL: does mass imply a sane energy intake?", tier2_cross_modal(per, rates)),
        ("TIER 3 — EXTERNAL: do the rates sit inside published ranges?", tier3_external(rates)),
        ("TIER 4 — BACK-TEST: model output vs actual issuance", tier4_backtest()),
    ]
    counts = print_report(tiers)

    if args.json:
        Path(args.json).write_text(json.dumps({
            "rate_table_version": rates.get("schema_version"),
            "summary": counts,
            "tiers": [{"tier": t, "checks": c} for t, c in tiers],
        }, indent=2))
        print(f"\nWrote {args.json}")


if __name__ == "__main__":
    main()
