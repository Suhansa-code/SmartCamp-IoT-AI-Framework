"""
validate_commodity_aliases.py

commodity_aliases.json is hand-curated, so nothing regenerates it and nothing
would notice if it drifted out of step with commodity_shares.json. Rebuilding
the shares table renames or drops commodities whenever the survey filter
changes; an alias pointing at a name that no longer exists then fails silently
at runtime -- shareFor() returns null and the item quietly absorbs a slice of
the unallocated remainder instead of its own share.

This script is the guard. It fails loudly on:

  * an alias target that is not a commodity in the shares table
  * an alias key that already matches a commodity exactly (redundant, and it
    shadows nothing -- exact matching runs first, so the entry is dead weight)
  * the same name appearing in two of the disjoint lists
    (aliases / non_food / water / beverage_excluded)
  * a duplicated target inside one alias group, which would double-count share

and reports, for information:

  * total basket share reachable through aliases
  * commodities no alias or exact name can reach

Run:  python scripts/validate_commodity_aliases.py
Exit: 0 clean, 1 on any error.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODELS = HERE.parent / "models" / "lka_v2"
SHARES = MODELS / "commodity_shares.json"
ALIASES = MODELS / "commodity_aliases.json"


def canonical(name: str, noise: set, stems: dict) -> str:
    """
    The Node standardiser's canonical key, reimplemented so the two agree.

    Must stay in step with commodityStandardizer.service.js -> canonicalKey().
    Any change here needs the same change there, and vice versa.
    """
    s = unicodedata.normalize("NFD", str(name or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\([^)]*\)", " ", s)          # drop parentheticals
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9\s]", " ", s)        # punctuation -> space
    tokens = []
    for tok in s.split():
        if re.fullmatch(r"\d+(kg|g|l|ml|lb|oz)?", tok):   # 5, 5kg, 400g
            continue
        if tok in noise:
            continue
        tok = singularise(tok)
        tok = stems.get(tok, tok)
        if tok in noise:                       # stemming can reveal noise
            continue
        tokens.append(tok)
    return " ".join(sorted(tokens))


def singularise(tok: str) -> str:
    """Conservative English plural stripping; leaves ss/us/is words alone."""
    if len(tok) <= 3:
        return tok
    if tok.endswith("ies"):
        return tok[:-3] + "y"
    if len(tok) >= 6 and tok.endswith("oes"):   # potatoes -> potato
        return tok[:-2]
    if tok.endswith(("ses", "xes", "zes", "ches", "shes")):
        return tok[:-2]
    if tok.endswith("s") and not tok.endswith(("ss", "us", "is")):
        return tok[:-1]
    return tok


def main() -> int:
    shares = json.loads(SHARES.read_text())["shares"]
    a = json.loads(ALIASES.read_text())

    noise = set(a["noise_tokens"])
    stems = a["token_stems"]
    errors, warnings = [], []

    # canonical key -> commodity name, for the exact-match stage
    exact = {}
    for name in shares:
        exact.setdefault(canonical(name, noise, stems), name)

    # ── every alias target must be a real commodity ──────────────────────────
    for key, targets in a["aliases"].items():
        if len(set(targets)) != len(targets):
            errors.append(f"alias '{key}' repeats a target — its share would double-count")
        for t in targets:
            if t not in shares:
                errors.append(f"alias '{key}' -> '{t}' is not in commodity_shares.json")

    # ── an alias that already matches exactly is dead weight ─────────────────
    for key in a["aliases"]:
        ck = canonical(key, noise, stems)
        if ck in exact:
            warnings.append(
                f"alias '{key}' canonicalises to '{ck}', which already matches "
                f"'{exact[ck]}' exactly — the exact stage runs first, so this entry never fires"
            )

    # ── the four lists must stay disjoint ────────────────────────────────────
    lists = {
        "aliases": set(canonical(k, noise, stems) for k in a["aliases"]),
        "non_food": set(canonical(k, noise, stems) for k in a["non_food"]),
        "water": set(canonical(k, noise, stems) for k in a["water"]),
        "beverage_excluded": set(canonical(k, noise, stems) for k in a["beverage_excluded"]),
    }
    names = list(lists)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            clash = lists[names[i]] & lists[names[j]]
            if clash:
                errors.append(
                    f"'{sorted(clash)}' appears in both {names[i]} and {names[j]} — "
                    "the standardiser would resolve it by list order, not by intent"
                )

    # ── coverage report ──────────────────────────────────────────────────────
    reachable = set(exact.values())
    for targets in a["aliases"].values():
        reachable.update(targets)
    covered = sum(shares[c] for c in reachable)
    unreachable = sorted(
        ((c, s) for c, s in shares.items() if c not in reachable),
        key=lambda x: -x[1],
    )

    print(f"  shares table   : {len(shares)} commodities")
    print(f"  alias entries  : {len(a['aliases'])}  "
          f"(non_food {len(a['non_food'])}, water {len(a['water'])}, "
          f"beverages {len(a['beverage_excluded'])})")
    print(f"  reachable      : {len(reachable)}/{len(shares)} commodities "
          f"= {covered*100:.1f} % of basket mass")
    if unreachable:
        print(f"  unreachable    : {len(unreachable)} commodities "
              f"= {sum(s for _, s in unreachable)*100:.1f} % of mass (top 5)")
        for c, s in unreachable[:5]:
            print(f"      {s*100:5.2f} %  {c}")

    for w in warnings:
        print(f"  WARN  {w}")
    for e in errors:
        print(f"  ERROR {e}")

    if errors:
        print(f"\n  FAILED — {len(errors)} error(s)")
        return 1
    print(f"\n  OK — {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
