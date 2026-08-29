"""
generate_camp_scenarios.py

Camp operations scenario set: registrations, per-person issuance, stock ledger.

Rates and scales are drawn from measured Sri Lankan sources (see MANIFEST.json
written alongside the output). Nine data-quality defects observed in real camp
operations are injected so the set does not behave like clean simulation output.

Usage:  python scripts/generate_camp_scenarios.py [--camps 40] [--seed 42]
"""
import argparse, json, re
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
BRIGHT = Path("/home/suhansa-kashmira/Downloads/data-sets/dataverse_files (1)")
OUT = REPO / "data" / "scenarios"

# ---- MEASURED: camp scale and decay (PDNA Cyclone Ditwah, DMC sitreps) -----
PDNA_PEAK_MEAN = 233015 / 1441               # 161.7 people per safety centre
PDNA_DECAY = 1 - (8294 / 233015) ** (1 / 48)  # 6.71 %/day population decline

# ---- Defect rates: observed operational failure modes ----------------------
D_MISSING_AGE      = 0.08   # staff enter estimates or leave blank under load
D_DUPLICATE_REG    = 0.02   # same person, two fingerprint reads
D_LATE_CHECKIN     = 0.12   # MQTT sync delay -> out-of-order arrival
D_UNCONVERTIBLE    = 0.27   # matches BRIGHT's real fcf_kg gap
D_UNRECORDED_ISSUE = 0.06   # food handed out without scanning
D_RECOUNT_ERROR    = 0.15   # manual stock recount disagrees with the ledger
D_LATE_DELIVERY    = 0.20   # road access after a cyclone
PERSON_CV          = 0.42   # per-person daily intake CV (GIFT: sd .804/mean 1.914)

# Camp trajectory archetypes. PDNA's 6.71 %/day is a NATIONAL aggregate across
# 1,441 centres; individual camps vary widely around it, so decay rate, onset
# duration and plateau length are drawn per camp rather than held constant.
ARCHETYPES = {
    "flash_flood":   dict(w=0.30, onset=(1, 3),  plateau=(0, 2),  decay=(0.10, 0.20)),
    "cyclone":       dict(w=0.35, onset=(2, 5),  plateau=(1, 5),  decay=(0.05, 0.10)),
    "landslide":     dict(w=0.15, onset=(1, 2),  plateau=(3, 10), decay=(0.03, 0.07)),
    "protracted":    dict(w=0.20, onset=(3, 8),  plateau=(5, 14), decay=(0.01, 0.04)),
}
P_SECOND_INFLUX = 0.25   # a second hazard event repopulates the camp

A_INITIAL_COVER_DAYS = 5.0
A_LEAD_TIME_DAYS     = 3
A_REORDER_COVER_DAYS = 10
A_INTAKE_DAYS        = 3


def load_measured():
    """Cohort rates, age composition and commodity mix from BRIGHT."""
    rates = json.loads((REPO / "models/lka_v2/household_cohort_rates.json").read_text())["rates"]

    ros = pd.read_csv(BRIGHT / "Data/mod_b0_roster_long.tab", sep="\t", low_memory=False)
    ages = ros.b0_04_years.dropna().values

    cb = pd.read_csv(BRIGHT / "Documentation/Codebook/mod_j1_fah_long_codebook.tab",
                     sep="\t", low_memory=False)
    cb["v"] = cb["Variable Name"].ffill()
    it = cb[cb.v == "j1_item"][["Answer Code", "Answer Label"]].dropna()
    lab = dict(zip(it["Answer Code"].astype(int), it["Answer Label"]))

    j1 = pd.read_csv(BRIGHT / "Data/mod_j1_fah_long.tab", sep="\t", low_memory=False)
    c = j1[j1.j1_01 == 1].copy()
    c["kg7"] = c.j1_02 * c.fcf_kg
    c["name"] = c.j1_item.map(lab)
    bev = re.compile(r"soft drink|bottled water|fruit juice|tea leaves|coffee|other beverages", re.I)
    c = c[~c.name.fillna("").str.contains(bev)]
    mix = c.groupby("name")["kg7"].sum()
    return rates, ages, (mix / mix.sum()).sort_values(ascending=False)


def band(age):
    if age < 6:   return "infant_0_5"
    if age < 15:  return "child_6_14"
    if age < 18:  return "teen_15_17"
    if age < 60:  return "adult_18_59"
    if age < 75:  return "eld_60_74"
    return "eld_75plus"


def build(camps, seed):
    rng = np.random.default_rng(seed)
    rates, ages_pool, mix = load_measured()
    # Per-camp rate draw from the MEASURED bootstrap interval.
    def draw(b):
        lo, hi = rates[b]["ci95"]
        return rng.normal(rates[b]["kg_per_day"], (hi - lo) / 3.92)

    commodities = mix.head(10).index.tolist()
    reg_rows, issue_rows, day_rows, stock_rows = [], [], [], []
    pid = 0

    peaks = rng.lognormal(np.log(PDNA_PEAK_MEAN), 0.9, camps).round().astype(int)
    for ci, peak in enumerate(peaks, 1):
        camp = f"CAMP{ci:03d}"
        start = date(2025, 12, 1) + timedelta(days=int(rng.integers(0, 40)))
        days = int(rng.integers(18, 45))
        camp_rate = {b: draw(b) for b in rates}
        names = list(ARCHETYPES); ws = np.array([ARCHETYPES[n]["w"] for n in names])
        arch = ARCHETYPES[names[rng.choice(len(names), p=ws / ws.sum())]]
        onset = int(rng.integers(*arch["onset"], endpoint=True))
        plateau = int(rng.integers(*arch["plateau"], endpoint=True))
        decay = rng.uniform(*arch["decay"])
        influx_day = (int(rng.integers(onset + plateau + 2, max(onset + plateau + 3, days - 4)))
                      if rng.random() < P_SECOND_INFLUX else None)
        influx_mult = rng.uniform(0.3, 1.2)
        roster = []          # (pid, true_age, sex)
        stock = None
        pending = {}

        for d in range(days):
            if d < onset:
                target = peak * (d + 1) / onset
            elif d < onset + plateau:
                target = peak
            else:
                target = peak * (1 - decay) ** (d - onset - plateau + 1)
            if influx_day is not None and d >= influx_day:
                extra = peak * influx_mult
                target += extra * (1 - decay) ** (d - influx_day)
            target = max(0, int(round(target * rng.normal(1, 0.06))))
            today = start + timedelta(days=d)

            # --- arrivals -> registrations -------------------------------
            while len(roster) < target:
                pid += 1
                true_age = int(rng.choice(ages_pool))
                sex = "F" if rng.random() < 0.51 else "M"
                roster.append((pid, true_age, sex))
                rec_age = "" if rng.random() < D_MISSING_AGE else true_age
                seen = today
                if rng.random() < D_LATE_CHECKIN:          # out-of-order sync
                    seen = today + timedelta(days=int(rng.integers(1, 3)))
                reg_rows.append({"camp_id": camp, "person_id": pid, "age": rec_age,
                                 "gender": sex, "registration_date": today.isoformat(),
                                 "synced_at": seen.isoformat(),
                                 "is_pregnant": int(sex == "F" and rng.random() < 0.03)})
                if rng.random() < D_DUPLICATE_REG:          # duplicate fingerprint read
                    pid += 1
                    reg_rows.append({"camp_id": camp, "person_id": pid, "age": rec_age,
                                     "gender": sex, "registration_date": today.isoformat(),
                                     "synced_at": seen.isoformat(), "is_pregnant": 0})
                    roster.append((pid, true_age, sex))
            if len(roster) > target:                        # departures
                keep = rng.choice(len(roster), target, replace=False)
                roster = [roster[i] for i in sorted(keep)]

            # --- true demand, per person ---------------------------------
            demand = 0.0
            per_person = []
            for p, a, s in roster:
                r = camp_rate[band(a)] * rng.lognormal(0, PERSON_CV)
                per_person.append((p, a, s, r))
                demand += r
            if stock is None:
                stock = demand * A_INITIAL_COVER_DAYS

            arrived = pending.pop(d, 0.0)
            stock += arrived
            issued_total = min(stock, demand)
            ratio = issued_total / demand if demand else 0
            stock -= issued_total

            for p, a, s, r in per_person:
                if rng.random() < D_UNRECORDED_ISSUE:       # handed out unscanned
                    continue
                q = r * ratio
                if rng.random() < D_UNCONVERTIBLE:          # unit not convertible
                    q = np.nan
                issue_rows.append({"camp_id": camp, "person_id": p,
                                   "date": today.isoformat(),
                                   "quantity_kg": None if pd.isna(q) else round(q, 3)})

            cover = stock / demand if demand else 0
            order = 0.0
            if cover < A_LEAD_TIME_DAYS and not any(k > d for k in pending):
                order = max(0.0, demand * A_REORDER_COVER_DAYS - stock)
                lead = A_LEAD_TIME_DAYS + (int(rng.integers(1, 4))
                                           if rng.random() < D_LATE_DELIVERY else 0)
                pending[d + lead] = order

            counted = stock * (rng.normal(1, 0.03) if rng.random() < D_RECOUNT_ERROR else 1)
            day_rows.append({"camp_id": camp, "date": today.isoformat(), "camp_day": d,
                             "population": len(roster),
                             "food_kg_required": round(demand, 1),
                             "food_kg_issued": round(issued_total, 1),
                             "shortfall_kg": round(max(0.0, demand - issued_total), 1),
                             "stock_kg_end": round(stock, 1),
                             "stock_kg_counted": round(counted, 1),
                             "days_cover": round(cover, 2)})
            for cm in commodities:
                stock_rows.append({"camp_id": camp, "date": today.isoformat(),
                                   "commodity": cm,
                                   "required_kg": round(demand * mix[cm], 2),
                                   "delivered_kg": round(arrived * mix[cm], 2)})

    return (pd.DataFrame(reg_rows), pd.DataFrame(issue_rows),
            pd.DataFrame(day_rows), pd.DataFrame(stock_rows), rates, mix)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--camps", type=int, default=40)
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    reg, iss, day, stk, rates, mix = build(a.camps, a.seed)
    for name, df in (("registrations", reg), ("issuance", iss),
                     ("camp_days", day), ("commodity_ledger", stk)):
        df.to_csv(OUT / f"{name}.csv", index=False)
        print(f"  {name+'.csv':<24}{len(df):>8,} rows")

    manifest = {
        "generated_by": "scripts/generate_camp_scenarios.py",
        "nature": "Generated scenario set. Rates and scales measured; camp-days constructed.",
        "not_for_training": "Rates were used to construct this set; refitting them to it is circular.",
        "measured_inputs": {
            "cohort_rates": "BRIGHT Sri Lanka household survey, n=27,689, sampled from bootstrap CI95",
            "age_composition": "BRIGHT roster module mod_b0_roster_long",
            "commodity_mix": "BRIGHT mod_j1_fah_long, 131 items, beverages excluded",
            "camp_scale": f"PDNA Cyclone Ditwah: 233,015 people / 1,441 safety centres = {PDNA_PEAK_MEAN:.1f}",
            "camp_decay": f"PDNA national aggregate {PDNA_DECAY:.4f}/day; per-camp rates drawn per archetype around it",
            "archetypes": {k: {kk: vv for kk, vv in v.items()} for k, v in ARCHETYPES.items()},
        },
        "assumptions": {
            "initial_cover_days": A_INITIAL_COVER_DAYS, "lead_time_days": A_LEAD_TIME_DAYS,
            "reorder_cover_days": A_REORDER_COVER_DAYS, "intake_days": A_INTAKE_DAYS,
        },
        "injected_defects": {
            "missing_age": D_MISSING_AGE, "duplicate_registration": D_DUPLICATE_REG,
            "late_checkin_sync": D_LATE_CHECKIN, "unconvertible_quantity": D_UNCONVERTIBLE,
            "unrecorded_issuance": D_UNRECORDED_ISSUE, "stock_recount_error": D_RECOUNT_ERROR,
            "late_delivery": D_LATE_DELIVERY, "person_intake_cv": PERSON_CV,
            "stockout_censoring": "emergent — issuance capped by stock",
        },
    }
    (OUT / "MANIFEST.json").write_text(json.dumps(manifest, indent=2))
    print(f"\n  MANIFEST.json written to {OUT}")


if __name__ == "__main__":
    main()
