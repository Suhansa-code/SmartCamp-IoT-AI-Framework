"""
prepare_household_food_data.py

Derives a compact household food-consumption dataset from the BRIGHT Sri Lanka
household survey, so the modelling scripts do not depend on a 45 MB raw file
sitting in a Downloads folder.

Why this dataset matters
------------------------
The FAO/WHO GIFT survey already in this project covers ages 6-14 only, which is
why the adult rate came from a configuration file and the elderly rate was an
assumption. BRIGHT covers whole households -- 6,847 of them across all 9
provinces and 25 districts, surveyed February 2025 -- so every age band appears,
including 16,022 adults and 5,443 people aged 60+.

Source modules
    mod_j1_fah_long.tab   food consumed at home, 7-day recall, one row per item
                          per household. j1_02 is the reported quantity, j1_03
                          the unit, and fcf_kg converts that unit to kilograms.
    mod_b0_roster_long.tab  one row per household member, with b0_04_years age.
    mod_a_household_identification.tab  province, district, survey weight.

Derivation
    household kg/day = sum over consumed items of (j1_02 * fcf_kg) / 7
    cohort counts    = roster members bucketed into six age bands

Measurement basis -- read this before comparing to the rate table
    These are quantities of food a household consumed at home over a week, in
    the form it was acquired: raw rice, raw vegetables, and so on. The rate
    table's child figure (1.76 kg) is AS-CONSUMED cooked weight from a 24-hour
    recall, and its adult figure (1.60 kg) is an issued ration. The three are on
    different bases and their absolute levels are not comparable.

    What transfers is the RATIO between cohorts, which is measured here on one
    consistent basis for the first time.

Usage
    python scripts/prepare_household_food_data.py \
        --source "~/Downloads/data-sets/dataverse_files (1)/Data"
"""

import argparse
import re
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "resource-model" / "lka_household_food.csv"

DEFAULT_SOURCE = "~/Downloads/data-sets/dataverse_files (1)/Data"

# Six bands: the model's three cohorts, each split where the data shows the
# split matters. 60-74 and 75+ turn out to differ substantially.
AGE_BANDS = {
    "infant_0_5":  (0, 5),
    "child_6_14":  (6, 14),
    "teen_15_17":  (15, 17),
    "adult_18_59": (18, 59),
    "eld_60_74":   (60, 74),
    "eld_75plus":  (75, 130),
}

# Households outside these bounds are data errors or institutions, not families.
MAX_HOUSEHOLD_SIZE = 15
MIN_KG_DAY, MAX_KG_DAY = 0.1, 40.0

# Beverages are recorded in the same module as food. They must be excluded from
# any figure that is later combined with the separate drinking-water allowance,
# or the water is counted twice. Both totals are emitted so downstream scripts
# can pick the basis they need -- but they must not mix one with the other.
BEVERAGE_ITEMS = re.compile(
    r"soft drink|bottled water|fruit juice|tea leaves|coffee|other beverages", re.I
)


def build(source: Path) -> pd.DataFrame:
    food = pd.read_csv(source / "mod_j1_fah_long.tab", sep="\t", low_memory=False)
    roster = pd.read_csv(source / "mod_b0_roster_long.tab", sep="\t", low_memory=False)
    ident = pd.read_csv(source / "mod_a_household_identification.tab", sep="\t", low_memory=False)

    # ── food: only items actually consumed, and only where the unit converts ──
    consumed = food[(food.j1_01 == 1) & food.j1_02.notna() & food.fcf_kg.notna()].copy()
    consumed["kg"] = consumed.j1_02 * consumed.fcf_kg

    labels = item_labels(source)
    consumed["item_name"] = consumed.j1_item.map(labels)
    consumed["is_beverage"] = consumed.item_name.fillna("").str.contains(BEVERAGE_ITEMS)

    weekly = consumed.groupby("hhcode", as_index=False).agg(
        kg_week=("kg", "sum"), items_consumed=("kg", "size")
    )
    solid = (consumed[~consumed.is_beverage]
             .groupby("hhcode", as_index=False)["kg"].sum()
             .rename(columns={"kg": "kg_week_solid"}))
    weekly = weekly.merge(solid, on="hhcode", how="left")
    weekly["kg_week_solid"] = weekly.kg_week_solid.fillna(0.0)

    # ── roster: cohort counts ────────────────────────────────────────────────
    people = roster[roster.b0_04_years.notna()].copy()
    for name, (lo, hi) in AGE_BANDS.items():
        people[name] = ((people.b0_04_years >= lo) & (people.b0_04_years <= hi)).astype(int)
    comp = people.groupby("hhcode")[list(AGE_BANDS)].sum().reset_index()
    comp["household_size"] = comp[list(AGE_BANDS)].sum(axis=1)

    frame = (weekly
             .merge(comp, on="hhcode")
             .merge(ident[["hhcode", "a_01_province", "a_02_district", "hhweight"]],
                    on="hhcode", how="left"))
    frame["kg_day"] = frame.kg_week / 7.0
    frame["kg_day_solid"] = frame.kg_week_solid / 7.0

    before = len(frame)
    frame = frame[
        (frame.household_size > 0)
        & (frame.household_size <= MAX_HOUSEHOLD_SIZE)
        & (frame.kg_day > MIN_KG_DAY)
        & (frame.kg_day < MAX_KG_DAY)
    ].copy()

    frame["kg_per_person_day"] = (frame.kg_day / frame.household_size).round(4)
    frame["kg_day"] = frame.kg_day.round(4)
    frame["kg_day_solid"] = frame.kg_day_solid.round(4)
    frame = frame.rename(columns={"a_01_province": "province", "a_02_district": "district"})

    print(f"  {before:,} households joined, {before - len(frame):,} dropped as out of bounds")
    return frame[["hhcode", "province", "district", "hhweight", "household_size",
                  *AGE_BANDS, "items_consumed", "kg_week", "kg_day", "kg_day_solid",
                  "kg_per_person_day"]]


def item_labels(source: Path) -> dict:
    """Food item code -> name, from the survey's own codebook."""
    codebook = source.parent / "Documentation" / "Codebook" / "mod_j1_fah_long_codebook.tab"
    if not codebook.exists():
        raise SystemExit(f"Codebook not found at {codebook}; needed to identify beverages.")
    cb = pd.read_csv(codebook, sep="\t", low_memory=False)
    cb["v"] = cb["Variable Name"].ffill()
    items = cb[cb.v == "j1_item"][["Answer Code", "Answer Label"]].dropna()
    return dict(zip(items["Answer Code"].astype(int), items["Answer Label"]))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[2])
    ap.add_argument("--source", default=DEFAULT_SOURCE,
                    help="BRIGHT survey Data directory")
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    source = Path(args.source).expanduser()
    if not (source / "mod_j1_fah_long.tab").exists():
        raise SystemExit(f"BRIGHT survey not found at {source}")

    frame = build(source)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(out, index=False)

    print(f"\nWrote {out}  ({len(frame):,} households, {frame.household_size.sum():,.0f} people)")
    print(f"\n  {'age band':<14}{'people':>9}{'in % of hh':>12}")
    for name in AGE_BANDS:
        print(f"  {name:<14}{int(frame[name].sum()):>9,}{(frame[name] > 0).mean() * 100:>11.1f}%")
    print(f"\n  household size  median {frame.household_size.median():.0f}  "
          f"mean {frame.household_size.mean():.2f}")
    print(f"  kg/day          median {frame.kg_day.median():.2f}  "
          f"mean {frame.kg_day.mean():.2f}")
    print(f"  kg/day solid    median {frame.kg_day_solid.median():.2f}  "
          f"mean {frame.kg_day_solid.mean():.2f}  "
          f"({(1 - frame.kg_day_solid.sum()/frame.kg_day.sum())*100:.1f} % is beverages)")
    print(f"  kg/person/day   median {frame.kg_per_person_day.median():.3f}  "
          f"mean {frame.kg_per_person_day.mean():.3f}")
    print(f"  provinces {frame.province.nunique()}  districts {frame.district.nunique()}")


if __name__ == "__main__":
    main()
