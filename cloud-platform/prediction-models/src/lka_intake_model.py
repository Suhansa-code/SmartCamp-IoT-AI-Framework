"""
lka_intake_model.py

Loads the child intake model trained on the Sri Lankan dietary recall survey
(models/lka_v2/child_intake_model.json) and applies it.

The artifact stores the fitted Ridge as plain numbers -- feature order, scaler
mean and scale, coefficients, intercept -- rather than a pickle, so the Node
backend applies exactly the same model from exactly the same file. Nothing here
depends on scikit-learn at prediction time.

What it predicts: expected kilograms of food per day for ONE child, given age,
sex and province. Read the metrics in the artifact before relying on it; the
per-person cross-validated R2 is about 0.07, and the model earns its place at
camp scale rather than per person.
"""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_HERE = Path(__file__).resolve().parent
MODEL_PATH = _HERE.parent / "models" / "lka_v2" / "child_intake_model.json"


class ChildIntakeModel:
    """Ridge model over age, sex and province. Children only."""

    def __init__(self, model_path: Path = MODEL_PATH):
        self.model_path = Path(model_path)
        artifact = json.loads(self.model_path.read_text())

        self.features = artifact["features"]
        self.coefficients = artifact["coefficients"]
        self.intercept = artifact["intercept"]
        self.scaler_mean = artifact["scaler"]["mean"]
        self.scaler_scale = artifact["scaler"]["scale"]
        self.provinces = artifact["provinces"]
        self.reference_province = artifact["reference_province"]
        self.province_dummy_means = artifact["province_dummy_means"]
        self.age_min, self.age_max = artifact["age_clamp"]
        self.metrics = artifact["metrics"]
        self.artifact = artifact

        logger.info(
            "Child intake model v%s loaded (%s, alpha=%s, CV R2=%s)",
            artifact["schema_version"], artifact["model_id"],
            artifact["alpha"], self.metrics["per_person"]["cv_r2"],
        )

    # ------------------------------------------------------------------
    def _row(self, age, sex, province):
        """Design row in the artifact's feature order."""
        # Ages outside the training range are extrapolation; clamp and say so.
        clamped = min(max(float(age), self.age_min), self.age_max)

        row = [clamped, 1.0 if str(sex).upper().startswith("F") or sex == 2 else 0.0]

        for name in self.features[2:]:
            province_name = name.removeprefix("province_")
            if province is None:
                # Unknown province -> national marginal, not the reference one.
                row.append(self.province_dummy_means[name])
            else:
                row.append(1.0 if province == province_name else 0.0)
        return row, clamped != float(age)

    def predict_person(self, age, sex="M", province=None) -> dict:
        """Expected kg/day for one child."""
        row, extrapolated = self._row(age, sex, province)
        z = [(v - m) / s for v, m, s in zip(row, self.scaler_mean, self.scaler_scale)]
        kg = self.intercept + sum(c * v for c, v in zip(self.coefficients, z))
        return {
            "food_kg_day": round(max(0.0, kg), 3),
            "age_extrapolated": extrapolated,
            "province": province or "national marginal",
        }

    def predict_cohort(self, people, province=None) -> dict:
        """
        Expected total kg/day for a list of children.

        Args:
            people — iterable of dicts with 'age' and optionally 'gender'/'sex'

        Camp totals are where this model is meant to be used: individual error
        is large but largely independent, so it averages down across the cohort.
        """
        total = 0.0
        extrapolated = 0
        counted = 0
        for person in people:
            age = person.get("age")
            if age is None:
                continue
            result = self.predict_person(age, person.get("gender") or person.get("sex") or "M", province)
            total += result["food_kg_day"]
            extrapolated += 1 if result["age_extrapolated"] else 0
            counted += 1

        return {
            "children": counted,
            "food_kg_day": round(total, 1),
            "mean_kg_per_child": round(total / counted, 3) if counted else 0.0,
            "age_extrapolated_count": extrapolated,
            "basis": f"ML model {self.artifact['model_id']} "
                     f"(CV R2 {self.metrics['per_person']['cv_r2']})",
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    m = ChildIntakeModel()

    print(f"\n{'age':>5}{'male kg':>10}{'female kg':>11}")
    for age in [3, 6, 8, 10, 12, 14, 17]:
        male = m.predict_person(age, "M")
        female = m.predict_person(age, "F")
        mark = "  (extrapolated)" if male["age_extrapolated"] else ""
        print(f"{age:>5}{male['food_kg_day']:>10.3f}{female['food_kg_day']:>11.3f}{mark}")

    print(f"\n{'province':<16}{'age 10 male kg':>16}")
    for province in [None] + m.provinces:
        r = m.predict_person(10, "M", province)
        print(f"{str(province or 'unknown -> national'):<16}{r['food_kg_day']:>16.3f}")

    kids = [{"age": a, "gender": g} for a, g in
            [(6,'M'),(8,'F'),(9,'M'),(11,'F'),(13,'M'),(14,'F'),(4,'M'),(16,'F')]]
    print(f"\ncohort of {len(kids)}: {m.predict_cohort(kids)}")
