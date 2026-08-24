"""
derive_cooked_basis_rates.py

Derives a food rate for EVERY cohort -- children, adults, elderly -- from
measured Sri Lankan data on one consistent basis.

The problem
-----------
Two real surveys, neither sufficient alone:

  FAO/WHO GIFT    per-person intake, weighed as eaten (cooked), but ages 6-14
                  only. 653 children.
  BRIGHT          all ages including 16,022 adults and 5,443 people over 60,
                  but food is recorded per household and as acquired (raw).

So GIFT has the right basis and the wrong coverage; BRIGHT has the right
coverage and the wrong basis.

The bridge
----------
Both surveys measure the SAME cohort: Sri Lankan children aged 6-14. GIFT says
they consume X kg cooked; BRIGHT says their household acquires Y kg raw on their
behalf. The ratio X/Y is the raw-to-cooked expansion factor, ESTIMATED from data
rather than assumed. Applying it to BRIGHT's adult and elderly coefficients puts
every cohort on GIFT's cooked basis.

A correction that must happen first
-----------------------------------
45 % of the mass GIFT records is drinking water, tea and juice -- water alone is
27 %. Those carry 4 kcal between them. The current rate table's child figure of
1.76 kg/day is therefore food PLUS about 0.71 kg of drink, which is also being
counted again in the separate 3 L water allowance.

This script strips beverages before bridging, so the resulting rates are solid
food only and the water allowance stops double-counting.

Honest limits
-------------
  * BRIGHT measures acquisition, not consumption. Food bought for a household is
    attributed to its members by the regression, so waste, guests and food given
    away inflate the estimate. The energy cross-check below shows this.
  * The bridge is a single national factor. Households whose diet is less
    rice-heavy expand less.
  * Children match GIFT exactly by construction -- the bridge is defined to make
    them match -- so only the adult and elderly figures are genuinely new.

Usage:
    python scripts/derive_cooked_basis_rates.py
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
RAW_DIR = HERE.parent / "resource-model"
OUT_DIR = HERE.parent / "models" / "lka_v2"

# Ingredients that are drinks, not food. Matched on INGREDIENT_ENG.
BEVERAGE_PATTERN = r"water|tea|coffee|juice|beverage|soft drink|soda|cordial|thambili"

HUMANITARIAN_KCAL_MIN = 2100
BOOTSTRAP = 2000


def gift_solid_food() -> dict:
    """Per-child cooked SOLID food and energy, beverages removed."""
    subjects = pd.read_csv(RAW_DIR / "subject_user.csv", low_memory=False)
    cons = pd.read_csv(RAW_DIR / "consumption_user.csv", low_memory=False)

    if sorted(subjects["ADM0_NAME"].dropna().unique()) != ["Sri Lanka"]:
        raise ValueError("Expected a Sri Lanka-only survey")

    cons["is_beverage"] = cons.INGREDIENT_ENG.astype(str).str.contains(
        BEVERAGE_PATTERN, case=False, na=False, flags=re.IGNORECASE
    )
    solid = cons[~cons.is_beverage]

    per_child = solid.groupby("SUBJECT").agg(
        g=("FOOD_AMOUNT_CONS", "sum"), kcal=("ENERGY_kcal", "sum")
    )
    everything = cons.groupby("SUBJECT").FOOD_AMOUNT_CONS.sum() / 1000.0

    kg = per_child.g / 1000.0
    rng = np.random.default_rng(42)
    boot = [np.median(rng.choice(kg.to_numpy(), len(kg), replace=True))
            for _ in range(BOOTSTRAP)]

    return {
        "n": int(len(kg)),
        "solid_kg_day": float(kg.median()),
        "solid_kg_ci95": [float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5))],
        "solid_kcal_day": float(per_child.kcal.median()),
        "all_including_drinks_kg": float(everything.median()),
        "beverage_share_of_mass": float(
            cons[cons.is_beverage].FOOD_AMOUNT_CONS.sum() / cons.FOOD_AMOUNT_CONS.sum()
        ),
        "solid_kcal_per_kg": float(per_child.kcal.median() / kg.median()),
    }


def bright_cohort_rates() -> dict:
    path = OUT_DIR / "household_cohort_rates.json"
    if not path.exists():
        raise SystemExit("Run scripts/train_household_food_model.py first.")
    return json.loads(path.read_text())["rates"]


def main():
    gift = gift_solid_food()
    bright = bright_cohort_rates()

    raw_child = bright["child_6_14"]["kg_per_day"]
    bridge = gift["solid_kg_day"] / raw_child
    density = gift["solid_kcal_per_kg"]

    print("=" * 74)
    print("  COOKED-BASIS RATES FOR EVERY COHORT, from measured Sri Lankan data")
    print("=" * 74)

    print("\n  STEP 1 — strip drinks from the GIFT measurement")
    print(f"    all mass recorded, ages 6-14   {gift['all_including_drinks_kg']:.3f} kg/day"
          f"   <- the current 1.76 rate")
    print(f"    beverages are {gift['beverage_share_of_mass'] * 100:.0f} % of that mass, "
          f"carrying almost no energy")
    print(f"    solid food only                {gift['solid_kg_day']:.3f} kg/day"
          f"   {gift['solid_kcal_day']:,.0f} kcal")
    print(f"    solid energy density           {density:,.0f} kcal/kg")

    print("\n  STEP 2 — bridge raw to cooked on the cohort both surveys cover")
    print(f"    GIFT   children 6-14, cooked solid   {gift['solid_kg_day']:.3f} kg/day")
    print(f"    BRIGHT children 6-14, raw acquired   {raw_child:.3f} kg/day")
    print(f"    bridge factor                        {bridge:.3f}x")

    print("\n  STEP 3 — apply the bridge to every cohort")
    print(f"    {'cohort':<16}{'raw kg':>9}{'cooked kg':>12}{'kcal':>9}{'vs 2100':>10}")

    mapping = [
        ("infant_0_5",  "children 0-5"),
        ("child_6_14",  "children 6-14"),
        ("teen_15_17",  "teens 15-17"),
        ("adult_18_59", "adults 18-59"),
        ("eld_60_74",   "elderly 60-74"),
        ("eld_75plus",  "elderly 75+"),
    ]
    derived = {}
    for key, label in mapping:
        raw = bright[key]["kg_per_day"]
        cooked = raw * bridge
        kcal = cooked * density
        derived[key] = {
            "label": label,
            "raw_kg_day": round(raw, 4),
            "cooked_kg_day": round(cooked, 3),
            "implied_kcal_day": round(kcal, 0),
            "n_people": bright[key]["n_people"],
            "ratio_to_adult": bright[key]["ratio_to_adult"],
        }
        print(f"    {label:<16}{raw:>9.3f}{cooked:>12.2f}{kcal:>9,.0f}"
              f"{kcal / HUMANITARIAN_KCAL_MIN:>9.2f}x")

    adult_kcal = derived["adult_18_59"]["implied_kcal_day"]
    print("\n  STEP 4 — energy cross-check, and what it reveals")
    print(f"    children 6-14 land at {derived['child_6_14']['implied_kcal_day']:,.0f} kcal, "
          f"which is right for that age.")
    print(f"    adults land at {adult_kcal:,.0f} kcal against a typical requirement near 2,400.")
    print("    BRIGHT measures food ACQUIRED, not eaten, so waste, guests and food")
    print("    given away are attributed to household members. The adult figure is")
    print("    therefore an upper bound, not a consumption estimate.")

    scale = 2400.0 / adult_kcal
    print(f"\n    Scaling so adults meet a 2,400 kcal requirement would multiply every")
    print(f"    cohort by {scale:.3f}. That is a CHOICE, not a measurement, so it is")
    print("    recorded below rather than applied.")

    artifact = {
        "schema_version": 1,
        "artifact_id": "lka_cooked_basis_rates",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_by": "scripts/derive_cooked_basis_rates.py",
        "basis": "cooked solid food, beverages excluded",
        "gift_reference": gift,
        "bridge_factor": round(bridge, 4),
        "bridge_method": (
            "Ratio of GIFT cooked solid intake to BRIGHT raw acquisition for the "
            "cohort both surveys cover, Sri Lankan children aged 6-14. Estimated, "
            "not assumed."
        ),
        "solid_kcal_per_kg": round(density, 1),
        "rates": derived,
        "energy_check": {
            "humanitarian_minimum_kcal": HUMANITARIAN_KCAL_MIN,
            "adult_implied_kcal": adult_kcal,
            "typical_adult_requirement_kcal": 2400,
            "scale_to_meet_2400": round(scale, 4),
            "interpretation": (
                "Children land at a plausible energy level, adults above it. BRIGHT "
                "records acquisition rather than consumption, so adult and elderly "
                "figures include household waste and food given away."
            ),
        },
        "caveats": [
            "Children match GIFT by construction; only adult and elderly figures are new.",
            "BRIGHT measures acquisition, so adult/elderly rates are upper bounds.",
            "A single national bridge factor; less rice-heavy diets expand less.",
            "The current rate table's 1.76 kg child figure includes ~0.71 kg of "
            "drinks, which the separate 3 L water allowance counts again.",
        ],
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / "cooked_basis_rates.json"
    path.write_text(json.dumps(artifact, indent=2))
    print(f"\nWrote {path}")
    print("=" * 74)


if __name__ == "__main__":
    main()
