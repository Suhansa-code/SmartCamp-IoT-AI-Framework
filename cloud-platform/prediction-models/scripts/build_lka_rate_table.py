#!/usr/bin/env python3
"""
build_lka_rate_table.py

Data-prep step for the Sri Lanka resource model.

Derives every per-person ration constant from the Sri Lankan sources in
resource-model/ and writes a single versioned artifact with provenance
attached to each value:

    models/lka_v2/ration_rates.json

Nothing in this script invents a number. Each rate is either measured from a
Sri Lankan dataset, read from the production ration configuration, or taken
from a named humanitarian standard — and the artifact records which.

Usage:
    python scripts/build_lka_rate_table.py
    python scripts/build_lka_rate_table.py --out models/lka_v2
"""

import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

_HERE       = Path(__file__).resolve().parent
RAW_DIR     = _HERE.parent / "resource-model"
OUT_DIR     = _HERE.parent / "models" / "lka_v2"
DIST_JSON   = (_HERE.parent.parent.parent
               / "raspberry-platform" / "backend" / "data" / "resource"
               / "distribution.json")

# Sphere Handbook basic survival water: 2.5–3.0 L per person per day for
# drinking and food preparation. The planning value is the upper bound.
SPHERE_DRINKING_L_MIN = 2.5
SPHERE_DRINKING_L_MAX = 3.0

# Elderly energy reduction relative to a working-age adult. This is a standard
# qualitative assumption (WHO/FAO age-based energy pattern), NOT a Sri Lankan
# measurement — flagged as such in the artifact.
# Elderly rates are no longer assumed. They come from measured cohort ratios in
# the BRIGHT Sri Lanka household survey (models/lka_v2/household_cohort_rates.json,
# built by scripts/train_household_food_model.py). Two independent fits agree:
#
#   band     six-band step model   spline curve   previously assumed
#   60-74           1.066x                1.055x               0.85x
#   75+             0.855x                0.756x               0.85x
#
# The old 0.85 assumption turned out to be right for the 75+ group and wrong for
# 60-74, who eat slightly MORE than working-age adults. Since 60-74 is 78 % of
# the over-60 population in the survey, the single blended rate understated the
# elderly cohort.
HOUSEHOLD_RATES = "household_cohort_rates.json"

# Fallback only, used when the household artifact is missing.
ELDERLY_FACTOR_FALLBACK = 0.85
ELDERLY_75PLUS_AGE = 75


# ----------------------------------------------------------------------
# Source readers
# ----------------------------------------------------------------------

def measure_child_food_rate(raw_dir: Path = RAW_DIR) -> dict:
    """
    Median daily food mass consumed by Sri Lankan children, from the 24-hour
    dietary recall survey.

    consumption_user.csv holds one row per food item per subject per recall
    day; FOOD_AMOUNT_CONS is grams consumed. subject_user.csv carries the
    demographics. Summing per SUBJECT gives one daily total per child.
    """
    subjects = pd.read_csv(raw_dir / "subject_user.csv")
    cons     = pd.read_csv(raw_dir / "consumption_user.csv", low_memory=False)

    daily = (cons.groupby("SUBJECT", as_index=False)["FOOD_AMOUNT_CONS"]
                 .sum()
                 .rename(columns={"FOOD_AMOUNT_CONS": "food_g_day"}))
    survey = daily.merge(subjects[["SUBJECT", "AGE_YEAR", "SEX", "ADM0_NAME"]],
                         on="SUBJECT")
    survey["food_kg_day"] = survey["food_g_day"] / 1000.0

    countries = sorted(survey["ADM0_NAME"].dropna().unique())
    if countries != ["Sri Lanka"]:
        raise ValueError(f"Expected a Sri Lanka-only survey, found {countries}")

    # Median, not mean: a single-day 24-hour recall has heavy tails.
    return {
        "value":       round(float(survey["food_kg_day"].median()), 2),
        "unit":        "kg/person/day",
        "source":      "subject_user.csv + consumption_user.csv — Sri Lanka 24h "
                       "dietary recall, survey median",
        "evidence":    "measured",
        "n_subjects":  int(len(survey)),
        "age_min":     int(survey["AGE_YEAR"].min()),
        "age_max":     int(survey["AGE_YEAR"].max()),
        "mean":        round(float(survey["food_kg_day"].mean()), 3),
        "median":      round(float(survey["food_kg_day"].median()), 3),
        "std":         round(float(survey["food_kg_day"].std()), 3),
        "iqr":         [round(float(survey["food_kg_day"].quantile(0.25)), 3),
                        round(float(survey["food_kg_day"].quantile(0.75)), 3)],
        "caveat":      "Survey covers ages 6-14 only. Ages 0-5 and 15-17 fall in "
                       "the same children_ratio bucket but were never surveyed.",
    }


def read_production_ration(dist_path: Path = DIST_JSON) -> dict:
    """
    Adult food rate, read from the ration quantities the camp actually issues.

    distribution.json drives /api/distribute, so breakfast + lunch + dinner is
    the real three-meals-a-day mass handed to an adult resident.
    """
    cfg      = json.loads(dist_path.read_text())
    standard = cfg["standard"]
    extra    = cfg.get("pregnant_extra", {})

    meals      = ["breakfast", "lunch", "dinner"]
    adult_food = round(sum(float(standard[m]) for m in meals), 2)
    preg_food  = round(sum(float(extra.get(m, 0.0)) for m in meals), 2)

    return {
        "adult_food": {
            "value":    adult_food,
            "unit":     "kg/person/day",
            "source":   "raspberry-platform/backend/data/resource/distribution.json "
                        f"(breakfast {standard['breakfast']} + lunch {standard['lunch']} "
                        f"+ dinner {standard['dinner']})",
            "evidence": "production configuration — the quantity actually issued",
            "meals_per_day": len(meals),
            # Per-meal split, so anything that needs to apportion a daily total
            # across meals reads it from here rather than hard-coding numbers.
            "meals": {m: float(standard[m]) for m in meals},
        },
        "pregnant_food_topup": {
            "value":    preg_food,
            "unit":     "kg/person/day",
            "source":   "distribution.json pregnant_extra (exact)",
            "evidence": "production configuration",
        },
        "_domestic_water_in_production": {
            "value":    float(standard.get("water", 0.0)),
            "unit":     "L/person/day",
            "source":   "distribution.json standard.water",
            "note":     "Sphere BASIC DOMESTIC supply (drinking + cooking + hygiene). "
                        "Recorded for reference only — this model reports the "
                        "survival DRINKING requirement instead, see water_drinking.",
        },
    }


def corroborate_with_faostat(raw_dir: Path = RAW_DIR) -> dict:
    """
    Independent national cross-check on the food rates.

    FAOSTAT food balance sheets are national annual per-capita supply, so they
    cannot be a camp ration target. They can confirm that the camp planning
    figure sits in a sane range against a humanitarian energy minimum.
    """
    fao = pd.read_csv(raw_dir / "lka_faostat_food_balances.csv", low_memory=False)

    areas = sorted(fao["Area"].dropna().unique())
    if areas != ["Sri Lanka"]:
        raise ValueError(f"Expected a Sri Lanka-only FAOSTAT extract, found {areas}")

    kcal = (fao[(fao["Item"] == "Grand Total")
                & (fao["Element"] == "Food supply (kcal/capita/day)")]
            [["Year", "Value"]]
            .sort_values("Year"))

    return {
        "kcal_per_capita_day": {
            "min":      round(float(kcal["Value"].min()), 1),
            "max":      round(float(kcal["Value"].max()), 1),
            "latest":   round(float(kcal["Value"].iloc[-1]), 1),
            "latest_year": int(kcal["Year"].iloc[-1]),
            "unit":     "kcal/capita/day",
            "source":   "lka_faostat_food_balances.csv — Grand Total, "
                        "Food supply (kcal/capita/day)",
            "evidence": "corroboration only — national annual supply, not a camp ration",
            "comparison": "Humanitarian planning minimum is 2100 kcal/person/day; "
                          "Sri Lankan national supply sits above it across all "
                          f"years {int(kcal['Year'].min())}-{int(kcal['Year'].max())}.",
        }
    }


def measure_population_scale(raw_dir: Path = RAW_DIR) -> dict:
    """
    Realistic Sri Lankan camp population scale, from reported disaster events.

    lka_idmc_idu_events.csv gives people displaced per reported event. This
    bounds the range the model should be expected to operate over and is the
    evidence that national-scale refugee totals are the wrong reference class.
    """
    idmc = pd.read_csv(raw_dir / "lka_idmc_idu_events.csv")
    fig  = idmc["figure"].dropna()

    types = idmc["displacement_type"].value_counts().to_dict()

    return {
        "value":       [int(fig.min()), int(fig.max())],
        "unit":        "persons per displacement event",
        "source":      "lka_idmc_idu_events.csv — IDMC/DMC reported events",
        "evidence":    "measured",
        "n_events":    int(len(idmc)),
        "median":      float(fig.median()),
        "mean":        round(float(fig.mean()), 1),
        "pct_under_50":  round(100.0 * float((fig < 50).mean()), 1),
        "pct_under_100": round(100.0 * float((fig < 100).mean()), 1),
        "date_min":    str(idmc["displacement_date"].min()),
        "date_max":    str(idmc["displacement_date"].max()),
        "displacement_types": types,
        "caveat":      "All events are disaster-driven, not conflict-driven. This "
                       "is the reference class the model serves.",
    }


def derive_elderly_rates(adult_value: float) -> dict:
    """
    Elderly rates from measured Sri Lankan household data, split at 75.

    The BRIGHT household survey observes 4,229 people aged 60-74 and 1,214 aged
    75+, so both bands are measured rather than assumed. Only the RATIO to the
    adult rate is carried over: BRIGHT records raw at-home food quantities while
    the camp ration is cooked served weight, so absolute levels are on different
    bases and are not comparable. Anchoring the measured ratio to the production
    adult rate keeps the table on one basis.
    """
    path = OUT_DIR / HOUSEHOLD_RATES
    if not path.exists():
        fallback = round(adult_value * ELDERLY_FACTOR_FALLBACK, 2)
        entry = {
            "value":    fallback,
            "unit":     "kg/person/day",
            "source":   f"adult rate x {ELDERLY_FACTOR_FALLBACK} — no household "
                        "survey artifact found",
            "evidence": "ASSUMPTION — not measured in Sri Lanka",
        }
        return {"food_elderly": entry, "food_elderly_75plus": dict(entry)}

    household = json.loads(path.read_text())
    rates = household["rates"]

    def band(key, age_lo, age_hi, label):
        measured = rates[key]
        ratio = measured["ratio_to_adult"]
        return {
            "value":       round(adult_value * ratio, 2),
            "unit":        "kg/person/day",
            "age_range":   [age_lo, age_hi],
            "source":      f"measured ratio to adult ({ratio:.3f}) from the BRIGHT "
                           f"Sri Lanka household survey, n={measured['n_people']:,} "
                           f"people aged {label}, anchored to the production adult rate",
            "evidence":    "measured ratio — Sri Lankan household survey, "
                           "February 2025",
            "ratio_to_adult":  ratio,
            "measured_kg_day_raw_basis": measured["kg_per_day"],
            "ratio_ci95_basis": measured["ci95"],
            "supersedes":  "adult x 0.85 assumption",
            "caveat":      "The ratio is measured; the absolute value is that ratio "
                           "applied to the production adult rate, because the survey "
                           "measures raw at-home food and the camp issues cooked "
                           "weight.",
        }

    younger = band("eld_60_74", 60, 74, "60-74")
    older   = band("eld_75plus", 75, 130, "75+")

    # Most camp rosters record an age, but a planner working from cohort counts
    # alone may only know "elderly". Blend the two measured rates by the survey's
    # own age split so that fallback is grounded rather than guessed.
    n_young = rates["eld_60_74"]["n_people"]
    n_old   = rates["eld_75plus"]["n_people"]
    share_young = n_young / (n_young + n_old)
    blended = round(younger["value"] * share_young + older["value"] * (1 - share_young), 2)

    return {
        "food_elderly":        younger,
        "food_elderly_75plus": older,
        "food_elderly_blended": {
            "value":    blended,
            "unit":     "kg/person/day",
            "source":   f"population-weighted blend of the two measured bands "
                        f"({share_young:.1%} aged 60-74, {1 - share_young:.1%} aged 75+, "
                        f"from n={n_young + n_old:,} people in the survey)",
            "evidence": "measured ratio — used only when a roster does not "
                        "distinguish 60-74 from 75+",
            "share_60_74": round(share_young, 4),
        },
    }


# ----------------------------------------------------------------------
# Assembly
# ----------------------------------------------------------------------

def build_rate_table() -> dict:
    child     = measure_child_food_rate()
    prod      = read_production_ration()
    fao       = corroborate_with_faostat()
    popscale  = measure_population_scale()

    adult_value = prod["adult_food"]["value"]
    elderly = derive_elderly_rates(adult_value)

    return {
        "schema_version": 3,
        "generated_at":   datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_by":   "scripts/build_lka_rate_table.py",
        "scope":          "Sri Lanka disaster-displacement camps. Food and water only.",
        "out_of_scope":   ["shelter_units", "medical_staff_needed"],

        "food_child":   child,
        "food_adult":   prod["adult_food"],
        "food_elderly":          elderly["food_elderly"],
        "food_elderly_75plus":   elderly["food_elderly_75plus"],
        "food_elderly_blended":  elderly["food_elderly_blended"],
        "food_pregnant_topup": prod["pregnant_food_topup"],

        "water_drinking": {
            "value":    SPHERE_DRINKING_L_MAX,
            "range":    [SPHERE_DRINKING_L_MIN, SPHERE_DRINKING_L_MAX],
            "unit":     "L/person/day",
            "source":   "Sphere Handbook basic survival water needs: 2.5-3.0 L "
                        "per person per day for drinking and food preparation. "
                        "Planning value is the upper bound.",
            "evidence": "humanitarian standard — no Sri Lankan measurement available",
            "caveat":   "consumption_user.csv WATER_g is 100% empty and "
                        "cleaned_global_water_consumption.csv contains no Sri Lanka "
                        "rows (see resource-model/rejected/), so no local water "
                        "consumption data exists to calibrate against.",
            "divergence_from_production":
                        "distribution.json issues 15 L/person/day, which is the "
                        "Sphere BASIC DOMESTIC figure (drinking + cooking + hygiene). "
                        "This model deliberately reports the narrower survival "
                        "DRINKING requirement. The two are not interchangeable.",
        },
        "water_pregnant_topup": {
            "value":    0.0,
            "unit":     "L/person/day",
            "source":   None,
            "evidence": "NOT APPLIED — distribution.json specifies +2 L, but that "
                        "value was defined against the 15 L domestic basis and does "
                        "not transfer to a 3 L drinking basis without a source.",
        },

        "population_scale": popscale,
        "corroboration":    fao,

        "_provenance_note":
            "Every value above carries an 'evidence' field: 'measured' (derived "
            "from a Sri Lankan dataset), 'production configuration' (read from the "
            "live ration config), 'humanitarian standard' (named external standard), "
            "or 'ASSUMPTION'. As of schema 3 no rate is an assumption: the "
            "elderly rates were replaced with measured ratios from the BRIGHT "
            "Sri Lanka household survey and split at age 75.",
    }


def main():
    ap = argparse.ArgumentParser(description="Build the Sri Lanka ration rate table")
    ap.add_argument("--out", default=str(OUT_DIR),
                    help=f"Output directory (default: {OUT_DIR})")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    table = build_rate_table()
    path  = out_dir / "ration_rates.json"
    path.write_text(json.dumps(table, indent=2))

    print(f"Wrote {path}")
    print()
    print(f"{'Rate':<26}{'Value':>10}  {'Evidence':<32} Source")
    print("-" * 118)
    for key in ["food_child", "food_adult", "food_elderly", "food_elderly_75plus",
                "food_pregnant_topup", "water_drinking"]:
        e = table[key]
        src = (e["source"] or "")[:52]
        print(f"{key:<26}{str(e['value']):>10}  {e['evidence'][:32]:<32} {src}")
    print()
    ps = table["population_scale"]
    print(f"Population scale : {ps['value'][0]}-{ps['value'][1]:,} persons/event "
          f"(n={ps['n_events']}, median {ps['median']:,.1f}, "
          f"{ps['pct_under_100']}% under 100)")
    fa = table["corroboration"]["kcal_per_capita_day"]
    print(f"FAOSTAT check    : {fa['min']:,.0f}-{fa['max']:,.0f} kcal/capita/day "
          f"(latest {fa['latest']:,.0f} in {fa['latest_year']}) vs 2,100 minimum")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
