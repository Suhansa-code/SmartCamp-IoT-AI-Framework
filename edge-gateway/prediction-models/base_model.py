from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_curve,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, train_test_split

DATASET_PATH = (
    Path(__file__).resolve().parents[1]
    / "resources"
    / "sri_lanka_flood_real_dataset.csv"
)

# ── Feature sets ─────────────────────────────────────────────────────────
# Original 5 features used by the legacy model
BASE_FEATURES = [
    "rainfall_7d_mm",
    "longitude",
    "latitude",
    "elevation_m",
    "distance_to_river_m",
]

# Extended feature set (10 features) — adds 5 derived/safe features
EXTENDED_FEATURES = BASE_FEATURES + [
    "monthly_rainfall_mm",
    "drainage_index",
    "water_level_m",
    "elevation_ratio",
    "river_proximity_score",
]

# Active feature set — change this to switch between base and extended
MODEL_FEATURES = EXTENDED_FEATURES

# Improved model path
IMPROVED_MODEL_PATH = Path(__file__).resolve().parent / "models" / "xgboost_model_improved.pkl"

MODELS_DIR = Path(__file__).resolve().parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


@dataclass
class FloodPrediction:
    flood_possibility: str
    category: str
    future_forecast: Dict[str, object]
    probability: float
    source: str
    shap_values: Optional[Dict[str, float]] = field(default_factory=dict)


class BaseFloodModel(ABC):
    def __init__(self, model_name: str, source: str):
        self._estimator = None
        self._is_trained = False
        self.metrics_: Dict[str, object] = {}
        self._model_name = model_name
        self._source = source
        model_dir = Path(__file__).resolve().parent / model_name
        self._charts_dir = model_dir / "artifacts"
        self._save_path = MODELS_DIR / f"{model_name}.pkl"

    @abstractmethod
    def _build_estimator(self):
        pass

    @property
    def _chart_prefix(self) -> str:
        return self._model_name.replace("_", " ").title()

    def _fit(self, estimator, x_train, y_train):
        estimator.fit(x_train, y_train)

    def _predict_proba(self, estimator, x):
        return estimator.predict_proba(x)[:, 1]

    def _extract_feature_importance(self, estimator) -> Optional[Dict[str, float]]:
        return None

    # ── Cross-validation ──────────────────────────────────────────────────

    def cross_validate(self, dataset_path: Optional[Path] = None, n_folds: int = 5) -> Dict[str, object]:
        """Run stratified K-fold cross-validation and return aggregated metrics."""
        data = pd.read_csv(dataset_path or DATASET_PATH)
        target = data["flood_occurrence_current_event"].map({"Yes": 1, "No": 0})
        if target.isna().any():
            raise ValueError("Target column contains unexpected values.")

        features = data[MODEL_FEATURES].copy()
        features = features.fillna(features.median(numeric_only=True))
        y = target.astype(int)

        skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
        fold_metrics = []

        for fold_idx, (train_idx, val_idx) in enumerate(skf.split(features, y)):
            x_train, x_val = features.iloc[train_idx], features.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

            estimator = self._build_estimator()
            self._fit(estimator, x_train, y_train)

            probs = self._predict_proba(estimator, x_val)
            preds = (probs >= 0.5).astype(int)

            fold_metrics.append({
                "fold": fold_idx + 1,
                "roc_auc": float(roc_auc_score(y_val, probs)),
                "accuracy": float((preds == y_val).mean()),
                "precision": float((preds[y_val == 1] == 1).sum() / max((preds == 1).sum(), 1)),
                "recall": float((preds[y_val == 1] == 1).sum() / max((y_val == 1).sum(), 1)),
                "f1": float(2 * (preds[y_val == 1] == 1).sum() / max((preds == 1).sum() + (y_val == 1).sum(), 1)),
                "train_size": len(x_train),
                "val_size": len(x_val),
            })

        # Aggregate across folds
        agg = {}
        for metric in ["roc_auc", "accuracy", "precision", "recall", "f1"]:
            values = [f[metric] for f in fold_metrics]
            agg[metric] = {
                "mean": float(np.mean(values)),
                "std": float(np.std(values)),
                "min": float(np.min(values)),
                "max": float(np.max(values)),
                "folds": [f[metric] for f in fold_metrics],
            }

        self.metrics_["cross_validation"] = {
            "n_folds": n_folds,
            "fold_metrics": fold_metrics,
            "aggregated": agg,
        }
        return self.metrics_["cross_validation"]

    # ── SHAP explainability ───────────────────────────────────────────────

    def explain_prediction(self, rainfall_mm: float, longitude: float, latitude: float,
                           altitude_m: float, dem_elevation_m: Optional[float],
                           nearest_river_m: float, water_level_m: float = 0.0,
                           monthly_rainfall_mm: float = 0.0, drainage_index: float = 0.5,
                           elevation_ratio: float = 1.0,
                           river_proximity_score: float = 0.0) -> Dict[str, float]:
        """Return SHAP values for a single prediction (feature importance)."""
        self._require_trained()
        try:
            import shap
        except ImportError:
            return {}

        effective_elevation = dem_elevation_m if dem_elevation_m is not None else altitude_m
        row = pd.DataFrame([{
            "rainfall_7d_mm": rainfall_mm,
            "longitude": longitude,
            "latitude": latitude,
            "elevation_m": effective_elevation,
            "distance_to_river_m": nearest_river_m,
            "monthly_rainfall_mm": monthly_rainfall_mm,
            "drainage_index": drainage_index,
            "water_level_m": water_level_m,
            "elevation_ratio": elevation_ratio,
            "river_proximity_score": river_proximity_score,
        }])

        # Load the actual estimator (not the raw artifact dict)
        estimator = None
        features = MODEL_FEATURES
        if IMPROVED_MODEL_PATH.exists():
            try:
                artifact = joblib.load(IMPROVED_MODEL_PATH)
                estimator = artifact["estimator"]
                features = artifact.get("features", MODEL_FEATURES)
            except Exception:
                pass
        if estimator is None:
            # Fallback: try to unwrap self._estimator if it's a dict artifact
            if isinstance(self._estimator, dict):
                estimator = self._estimator.get("estimator")
            else:
                estimator = self._estimator
        if estimator is None or isinstance(estimator, dict):
            return {}

        row_aligned = row[features]

        # Unwrap CalibratedClassifierCV to get the base estimator for SHAP
        shap_estimator = estimator
        if hasattr(estimator, 'base_estimator_'):
            shap_estimator = estimator.base_estimator_
        elif hasattr(estimator, 'estimator'):
            shap_estimator = estimator.estimator

        try:
            explainer = shap.TreeExplainer(shap_estimator)
            shap_values = explainer.shap_values(row_aligned)
        except Exception:
            return {}
        # For binary classification, shap_values may be a list [neg, pos]
        if isinstance(shap_values, list):
            vals = shap_values[1][0]
        else:
            vals = shap_values[0]

        return {
            feature: float(val)
            for feature, val in zip(features, vals)
        }

    # ── Training ──────────────────────────────────────────────────────────

    def train(self, dataset_path: Optional[Path] = None, test_size: float = 0.2) -> Dict[str, object]:
        data = pd.read_csv(dataset_path or DATASET_PATH)

        target = data["flood_occurrence_current_event"].map({"Yes": 1, "No": 0})
        if target.isna().any():
            raise ValueError("Target column 'flood_occurrence_current_event' contains unexpected values.")

        features = data[MODEL_FEATURES].copy()
        features = features.fillna(features.median(numeric_only=True))

        x_train, x_test, y_train, y_test = train_test_split(
            features, target.astype(int), test_size=test_size, random_state=42, stratify=target.astype(int),
        )

        self._estimator = self._build_estimator()
        self._fit(self._estimator, x_train, y_train)
        self._is_trained = True

        probabilities = self._predict_proba(self._estimator, x_test)
        predicted_labels = (probabilities >= 0.5).astype(int)
        self._save_charts(y_test.to_numpy(), probabilities, predicted_labels)

        self.metrics_ = {
            "roc_auc": float(roc_auc_score(y_test, probabilities)),
            "classification_report": classification_report(y_test, predicted_labels, output_dict=True),
            "confusion_matrix": confusion_matrix(y_test, predicted_labels).tolist(),
            "train_size": int(len(x_train)),
            "test_size": int(len(x_test)),
            "charts_output_dir": str(self._charts_dir),
            "features_used": MODEL_FEATURES,
        }

        importance = self._extract_feature_importance(self._estimator)
        if importance is not None:
            self.metrics_["feature_importance"] = importance

        self.save()
        return self.metrics_

    def _save_charts(self, y_true: np.ndarray, y_prob: np.ndarray, y_pred: np.ndarray, output_dir: Optional[Path] = None) -> None:
        chart_dir = output_dir or self._charts_dir
        chart_dir.mkdir(parents=True, exist_ok=True)
        prefix = self._chart_prefix

        fpr, tpr, _ = roc_curve(y_true, y_prob)
        auc = roc_auc_score(y_true, y_prob)
        plt.figure(figsize=(7, 5))
        plt.plot(fpr, tpr, label=f"ROC AUC = {auc:.3f}", linewidth=2)
        plt.plot([0, 1], [0, 1], linestyle="--", color="gray")
        plt.xlabel("False Positive Rate")
        plt.ylabel("True Positive Rate")
        plt.title(f"ROC Curve - {prefix} Flood Classification")
        plt.legend(loc="lower right")
        plt.tight_layout()
        plt.savefig(chart_dir / "roc_curve.png", dpi=150)
        plt.close()

        precision, recall, _ = precision_recall_curve(y_true, y_prob)
        plt.figure(figsize=(7, 5))
        plt.plot(recall, precision, linewidth=2)
        plt.xlabel("Recall")
        plt.ylabel("Precision")
        plt.title(f"Precision-Recall Curve - {prefix} Flood Classification")
        plt.tight_layout()
        plt.savefig(chart_dir / "precision_recall_curve.png", dpi=150)
        plt.close()

        cm = confusion_matrix(y_true, y_pred)
        plt.figure(figsize=(6, 5))
        plt.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
        plt.title(f"Confusion Matrix - {prefix} Flood Classification")
        plt.colorbar()
        tick_marks = np.arange(2)
        plt.xticks(tick_marks, ["No Flood", "Flood"])
        plt.yticks(tick_marks, ["No Flood", "Flood"])
        plt.ylabel("True label")
        plt.xlabel("Predicted label")
        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                plt.text(j, i, str(cm[i, j]), ha="center", va="center", color="black")
        plt.tight_layout()
        plt.savefig(chart_dir / "confusion_matrix.png", dpi=150)
        plt.close()

    def save(self, output_path: Optional[Path] = None) -> str:
        if not self._is_trained:
            raise RuntimeError("Cannot save untrained model. Call train() first.")

        save_path = output_path or self._save_path
        save_path.parent.mkdir(parents=True, exist_ok=True)

        joblib.dump(self._estimator, save_path)
        print(f"Model saved to: {save_path}")
        return str(save_path)

    def _require_trained(self) -> None:
        if not self._is_trained:
            raise RuntimeError("Model is not trained. Call train() before prediction.")

    @staticmethod
    def _category_from_probability(probability: float, threshold: float = 0.50) -> str:
        if probability >= 0.70:
            return "High"
        if probability >= 0.40:
            return "Medium"
        return "Low"

    @staticmethod
    def _adjust_probability(base_probability: float, water_level_m: float,
                            gauge_alert_level: float = 2.0,
                            use_heuristic: bool = False) -> float:
        """Adjust probability based on water level relative to station alert threshold.

        The heuristic is disabled by default in the improved model.
        Set use_heuristic=True to enable the legacy behavior.
        """
        if not use_heuristic:
            return float(np.clip(base_probability, 0.0, 1.0))
        correction = np.clip((water_level_m - gauge_alert_level) * 0.05, -0.12, 0.25)
        return float(np.clip(base_probability + correction, 0.0, 1.0))

    def predict_one(
        self,
        rainfall_mm: float,
        longitude: float,
        latitude: float,
        altitude_m: float,
        dem_elevation_m: Optional[float],
        nearest_river_m: float,
        water_level_m: float = 0.0,
        monthly_rainfall_mm: float = 0.0,
        drainage_index: float = 0.5,
        is_forecast: bool = False,
        gauge_alert_level: float = 2.0,
        gauge_minor_level: float = 3.0,
        gauge_major_level: float = 5.0,
        return_shap: bool = False,
        use_heuristic: bool = False,
    ) -> FloodPrediction:
        self._require_trained()

        effective_elevation = dem_elevation_m if dem_elevation_m is not None else altitude_m

        # Compute derived features
        elevation_ratio = (
            effective_elevation / gauge_minor_level
            if gauge_minor_level > 0 else 1.0
        )
        # River proximity score: inverse distance weighted (closer = higher score)
        river_proximity_score = (
            1000.0 / max(nearest_river_m, 1.0)
            if nearest_river_m > 0 else 0.0
        )

        row = pd.DataFrame([{
            "rainfall_7d_mm": rainfall_mm,
            "longitude": longitude,
            "latitude": latitude,
            "elevation_m": effective_elevation,
            "distance_to_river_m": nearest_river_m,
            "monthly_rainfall_mm": monthly_rainfall_mm,
            "drainage_index": drainage_index,
            "water_level_m": water_level_m,
            "elevation_ratio": elevation_ratio,
            "river_proximity_score": river_proximity_score,
        }])

        # Try to load improved model artifact first
        if IMPROVED_MODEL_PATH.exists():
            try:
                artifact = joblib.load(IMPROVED_MODEL_PATH)
                estimator = artifact["estimator"]
                threshold = artifact.get("threshold", 0.50)
                features = artifact.get("features", MODEL_FEATURES)

                # Ensure correct column order
                row_aligned = row[features]

                if hasattr(estimator, "predict_proba"):
                    base_probability = float(estimator.predict_proba(row_aligned)[0, 1])
                else:
                    base_probability = float(estimator.decision_function(row_aligned)[0])
            except Exception:
                # Fallback to legacy model
                base_probability = float(self._predict_proba(self._estimator, row)[0])
                threshold = 0.50
        else:
            base_probability = float(self._predict_proba(self._estimator, row)[0])
            threshold = 0.50

        adjusted_probability = self._adjust_probability(
            base_probability, water_level_m, gauge_alert_level, use_heuristic,
        )
        forecast_probability = (
            float(np.clip(adjusted_probability * 1.10 + 0.03, 0.0, 1.0))
            if is_forecast else adjusted_probability
        )

        # Determine flood possibility using the threshold
        flood_possibility = "Likely" if adjusted_probability >= threshold else "Unlikely"

        # SHAP explanation
        shap_values = {}
        if return_shap:
            shap_values = self.explain_prediction(
                rainfall_mm=rainfall_mm,
                longitude=longitude,
                latitude=latitude,
                altitude_m=altitude_m,
                dem_elevation_m=dem_elevation_m,
                nearest_river_m=nearest_river_m,
                water_level_m=water_level_m,
                monthly_rainfall_mm=monthly_rainfall_mm,
                drainage_index=drainage_index,
                elevation_ratio=elevation_ratio,
                river_proximity_score=river_proximity_score,
            )

        return FloodPrediction(
            flood_possibility=flood_possibility,
            category=self._category_from_probability(adjusted_probability, threshold),
            future_forecast={
                "enabled": bool(is_forecast),
                "probability": forecast_probability,
                "category": self._category_from_probability(forecast_probability, threshold),
            },
            probability=adjusted_probability,
            source=self._source,
            shap_values=shap_values,
        )

    def predict_batch(self, inputs: List[Dict[str, object]]) -> List[Dict[str, object]]:
        results: List[Dict[str, object]] = []
        for item in inputs:
            pred = self.predict_one(
                rainfall_mm=float(item["rainfall_mm"]),
                longitude=float(item["longitude"]),
                latitude=float(item["latitude"]),
                altitude_m=float(item["altitude_m"]),
                dem_elevation_m=None if item.get("dem_elevation_m") is None else float(item["dem_elevation_m"]),
                nearest_river_m=float(item["nearest_river_m"]),
                water_level_m=float(item.get("water_level_m", 0.0)),
                monthly_rainfall_mm=float(item.get("monthly_rainfall_mm", 0.0)),
                drainage_index=float(item.get("drainage_index", 0.5)),
                is_forecast=bool(item.get("is_forecast", False)),
                gauge_alert_level=float(item.get("gauge_alert_level", 2.0)),
                gauge_minor_level=float(item.get("gauge_minor_level", 3.0)),
                gauge_major_level=float(item.get("gauge_major_level", 5.0)),
                return_shap=bool(item.get("return_shap", False)),
            )
            results.append({
                "input": item,
                "flood_possibility": pred.flood_possibility,
                "category": pred.category,
                "future_forecast": pred.future_forecast,
                "probability": pred.probability,
                "source": pred.source,
                "shap_values": pred.shap_values,
            })
        return results
