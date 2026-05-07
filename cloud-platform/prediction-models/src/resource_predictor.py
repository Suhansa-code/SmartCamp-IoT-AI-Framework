"""
resource_predictor.py

Loads the trained ML models and predicts daily resource requirements
for a displaced-population camp given a headcount and demographics.

Usage (from anywhere that can import this module):

    from src.resource_predictor import ResourcePredictor

    predictor = ResourcePredictor()
    result = predictor.predict(
        total_population  = 10500,
        refugees          = 8000,
        idps              = 2000,
        asylum_seekers    = 500,
        children_ratio    = 0.45,
        elderly_ratio     = 0.08,
        female_ratio      = 0.51,
    )
    print(result)
    # {
    #   'food_kg_day': 6300.0,
    #   'water_liters_day': 210000.0,
    #   'shelter_units': 2333,
    #   'medical_staff_needed': 32.5,
    #   'population': 10500,
    #   'model_types': {'food_kg_day': 'Ridge', ...}
    # }
"""

import json
import logging
import numpy as np
import pandas as pd
import joblib
from pathlib import Path

logger = logging.getLogger(__name__)

# Resolve models/ relative to this file so it works from any working directory
_HERE       = Path(__file__).parent
MODELS_DIR  = _HERE.parent / "models"


class ResourcePredictor:
    """Wraps the four trained resource-prediction models."""

    TARGETS = [
        "food_kg_day",
        "water_liters_day",
        "shelter_units",
        "medical_staff_needed",
    ]

    def __init__(self, models_dir: Path = MODELS_DIR):
        self.models_dir = Path(models_dir)
        self._load()

    def _load(self):
        meta_path = self.models_dir / "resource_models_meta.json"
        if not meta_path.exists():
            raise FileNotFoundError(
                f"Model metadata not found at {meta_path}.\n"
                "Run notebook 02_resource_prediction_model.ipynb first."
            )

        self.meta = json.loads(meta_path.read_text())
        self.features = self.meta[self.TARGETS[0]]["features"]

        # Which targets use Ridge (needs scaled input)
        self.needs_scaling = {
            t: self.meta[t]["model_type"] == "Ridge" for t in self.TARGETS
        }

        self.models = {
            t: joblib.load(self.models_dir / f"resource_model_{t}.pkl")
            for t in self.TARGETS
        }
        self.scaler = joblib.load(self.models_dir / "resource_scaler.pkl")

        logger.info(
            "ResourcePredictor loaded. Models: %s",
            {t: self.meta[t]["model_type"] for t in self.TARGETS},
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(
        self,
        total_population: int,
        refugees: int = 0,
        asylum_seekers: int = 0,
        returned_refugees: int = 0,
        idps: int = 0,
        returned_idps: int = 0,
        stateless: int = 0,
        ooc: int = 0,
        children_ratio: float = 0.40,
        elderly_ratio: float = 0.05,
        female_ratio: float = 0.49,
        yearly_arrivals: int = 0,
        arrival_growth_rate: float = 0.0,
        year: int = 2024,
    ) -> dict:
        """
        Predict daily resource requirements for a camp.

        Required:
            total_population  — total number of people in the camp

        Optional population breakdown (all default to 0):
            refugees, asylum_seekers, returned_refugees,
            idps, returned_idps, stateless, ooc

        Optional demographics (default to global medians):
            children_ratio    — fraction under 18  (0.0–1.0)
            elderly_ratio     — fraction 60+        (0.0–1.0)
            female_ratio      — fraction female     (0.0–1.0)

        Optional time features:
            yearly_arrivals       — people who arrived this year
            arrival_growth_rate   — year-over-year growth rate (e.g. 0.15 = 15%)
            year                  — calendar year (default 2024)

        Returns:
            dict with keys:
                food_kg_day          — kg of dry food rations per day
                water_liters_day     — litres of water per day
                shelter_units        — shelter units needed
                medical_staff_needed — health workers needed
                population           — the total_population you passed in
                model_types          — which ML algorithm was used per target
        """
        X_raw    = self._build_feature_df(
            total_population, refugees, asylum_seekers, returned_refugees,
            idps, returned_idps, stateless, ooc,
            children_ratio, elderly_ratio, female_ratio,
            yearly_arrivals, arrival_growth_rate, year,
        )
        X_scaled = self.scaler.transform(X_raw)

        results = {"population": total_population}
        for t in self.TARGETS:
            X_input  = X_scaled if self.needs_scaling[t] else X_raw
            val      = float(self.models[t].predict(X_input)[0])
            results[t] = int(round(val)) if t == "shelter_units" else round(val, 1)

        results["model_types"] = {t: self.meta[t]["model_type"] for t in self.TARGETS}
        return results

    def predict_batch(self, camps: list[dict]) -> list[dict]:
        """
        Predict resources for multiple camps at once.

        Args:
            camps — list of dicts, each with the same keys as predict()

        Returns:
            list of result dicts in the same order
        """
        return [self.predict(**camp) for camp in camps]

    def summary(self, result: dict) -> str:
        """Return a human-readable string from a predict() result."""
        pop = result["population"]
        lines = [
            f"{'='*50}",
            f"  RESOURCE PLAN  ({pop:,} people)",
            f"{'='*50}",
            f"  Food needed    : {result['food_kg_day']:>12,.1f}  kg/day",
            f"  Water needed   : {result['water_liters_day']:>12,.1f}  litres/day",
            f"  Shelter units  : {result['shelter_units']:>12,}",
            f"  Medical staff  : {result['medical_staff_needed']:>12,.1f}  workers",
            f"{'='*50}",
            f"  Per person/day :",
            f"    Food   : {result['food_kg_day']/pop:.3f} kg",
            f"    Water  : {result['water_liters_day']/pop:.1f} litres",
            f"{'='*50}",
        ]
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_feature_df(
        self,
        total_population, refugees, asylum_seekers, returned_refugees,
        idps, returned_idps, stateless, ooc,
        children_ratio, elderly_ratio, female_ratio,
        yearly_arrivals, arrival_growth_rate, year,
    ) -> pd.DataFrame:
        pop = float(total_population)
        row = {
            "year":                year,
            "refugees":            refugees,
            "asylum_seekers":      asylum_seekers,
            "returned_refugees":   returned_refugees,
            "idps":                idps,
            "returned_idps":       returned_idps,
            "stateless":           stateless,
            "ooc":                 ooc,
            "total_population":    pop,
            "children_ratio":      children_ratio,
            "elderly_ratio":       elderly_ratio,
            "female_ratio":        female_ratio,
            "yearly_arrivals":     yearly_arrivals,
            "arrival_growth_rate": arrival_growth_rate,
            "log_refugees":        np.log1p(refugees),
            "log_asylum_seekers":  np.log1p(asylum_seekers),
            "log_idps":            np.log1p(idps),
            "log_total_population":np.log1p(pop),
            "log_yearly_arrivals": np.log1p(yearly_arrivals),
            "years_elapsed":       year - 2010,
            "vulnerability_index": children_ratio + elderly_ratio,
        }
        return pd.DataFrame([row], columns=self.features)


# ------------------------------------------------------------------
# Quick test — run directly:  python src/resource_predictor.py
# ------------------------------------------------------------------
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    predictor = ResourcePredictor()

    test_cases = [
        {
            "label": "Small camp (5,000 people, 40% children)",
            "total_population": 5000,
            "refugees": 4000,
            "idps": 1000,
            "children_ratio": 0.40,
            "elderly_ratio": 0.05,
        },
        {
            "label": "Large camp (100,000 people, high child/elderly vulnerability)",
            "total_population": 100000,
            "refugees": 70000,
            "idps": 20000,
            "asylum_seekers": 10000,
            "children_ratio": 0.55,
            "elderly_ratio": 0.10,
            "female_ratio": 0.52,
        },
        {
            "label": "Syria-scale (7,000,000 people)",
            "total_population": 7000000,
            "refugees": 3500000,
            "idps": 3000000,
            "asylum_seekers": 500000,
            "children_ratio": 0.47,
            "elderly_ratio": 0.06,
        },
    ]

    for case in test_cases:
        label = case.pop("label")
        result = predictor.predict(**case)
        print(f"\n{label}")
        print(predictor.summary(result))
