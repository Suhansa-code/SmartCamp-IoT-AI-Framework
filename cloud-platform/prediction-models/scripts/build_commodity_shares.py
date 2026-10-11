"""
build_commodity_shares.py

Per-commodity share of the daily food basket, measured from the BRIGHT Sri
Lanka household survey (mod_j1_fah_long, 131 food items, 7-day recall).

Beverages are excluded: the model reports a separate drinking-water allowance,
so counting tea and bottled water as food would double-count them.

Output: models/lka_v2/commodity_shares.json  — read by the Node backend to turn
a single food_kg_day figure into per-item draw-down against stock.
"""
import json, re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "models" / "lka_v2" / "commodity_shares.json"
HOUSEHOLDS = HERE.parent / "resource-model" / "lka_household_food.csv"
BRIGHT = Path("/home/suhansa-kashmira/Downloads/data-sets/dataverse_files (1)")
BEVERAGE = re.compile(r"soft drink|bottled water|fruit juice|tea leaves|coffee|other beverages", re.I)


def main():
    cb = pd.read_csv(BRIGHT / "Documentation/Codebook/mod_j1_fah_long_codebook.tab",
                     sep="\t", low_memory=False)
    cb["v"] = cb["Variable Name"].ffill()
    it = cb[cb.v == "j1_item"][["Answer Code", "Answer Label"]].dropna()
    lab = dict(zip(it["Answer Code"].astype(int), it["Answer Label"]))

    j1 = pd.read_csv(BRIGHT / "Data/mod_j1_fah_long.tab", sep="\t", low_memory=False)

    # Restrict to the households the food model is fitted on. Without this the
    # shares are computed over a different denominator -- a handful of extreme
    # bulk-buying households dominate total mass and push rice's share down from
    # 23.5 % to 18.2 %, which then disagrees with the rate it is multiplied by.
    if not HOUSEHOLDS.exists():
        raise SystemExit(
            f"{HOUSEHOLDS} not found. Run scripts/prepare_household_food_data.py first."
        )
    keep = set(pd.read_csv(HOUSEHOLDS).hhcode)
    j1 = j1[j1.hhcode.isin(keep)]

    c = j1[(j1.j1_01 == 1) & j1.j1_02.notna() & j1.fcf_kg.notna()].copy()
    c["kg7"] = c.j1_02 * c.fcf_kg
    c["name"] = c.j1_item.map(lab)
    n_items_total = c.name.nunique()
    c = c[~c.name.fillna("").str.contains(BEVERAGE)]

    mass = c.groupby("name")["kg7"].sum().sort_values(ascending=False)
    share = (mass / mass.sum()).round(6)

    artifact = {
        "schema_version": 1,
        "artifact_id": "lka_commodity_shares",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_by": "scripts/build_commodity_shares.py",
        "basis": "share of daily food mass, solid food only (beverages excluded)",
        "source": "BRIGHT Sri Lanka household survey, mod_j1_fah_long, 7-day recall",
        "evidence": "measured",
        "n_households": int(j1.hhcode.nunique()),
        "household_set": "same filtered households as food_rates_raw.json "
                         "(prepare_household_food_data.py bounds)",
        "n_items_surveyed": int(n_items_total),
        "n_items_after_beverage_exclusion": int(len(share)),
        "unconvertible_row_share": round(float(1 - j1[j1.j1_01 == 1].fcf_kg.notna().mean()), 4),
        "caveat": "Household acquisition shares, not camp issuance. A camp store "
                  "may stock a narrower basket; unmatched resource names fall back "
                  "to an even split of the unallocated remainder.",
        "shares": {k: float(v) for k, v in share.items() if v >= 0.001},
    }
    OUT.write_text(json.dumps(artifact, indent=2))
    print(f"  wrote {OUT}")
    print(f"  {len(artifact['shares'])} commodities at >=0.1 % share")
    for k, v in list(artifact["shares"].items())[:8]:
        print(f"    {k:<36}{v*100:6.2f} %")


if __name__ == "__main__":
    main()
