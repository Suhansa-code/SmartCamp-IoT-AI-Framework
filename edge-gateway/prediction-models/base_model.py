from abc import ABC, abstractmethod
from dataclasses import dataclass
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
from sklearn.model_selection import train_test_split

DATASET_PATH = (
    Path(__file__).resolve().parents[1]
    / "resources"
    / "sri_lanka_flood_risk_dataset_25000.csv"
)

MODEL_FEATURES = [
    "rainfall_7d_mm",
    "longitude",
    "latitude",
    "elevation_m",
    "distance_to_river_m",
]

MODELS_DIR = Path(__file__).resolve().parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


@dataclass
class FloodPrediction:
    flood_possibility: str
    category: str
    future_forecast: Dict[str, object]
    probability: float
    source: str


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
    def _category_from_probability(probability: float) -> str:
        if probability >= 0.70:
            return "High"
        if probability >= 0.40:
            return "Medium"
        return "Low"

    @staticmethod
    def _adjust_probability(base_probability: float, gauging_station_current_water_level_m: float) -> float:
        correction = np.clip((gauging_station_current_water_level_m - 2.0) * 0.05, -0.12, 0.25)
        return float(np.clip(base_probability + correction, 0.0, 1.0))

    def predict_one(
        self,
        rainfall_mm: float,
        longitude: float,
        latitude: float,
        altitude_m: float,
        dem_elevation_m: Optional[float],
        nearest_river_m: float,
        gauging_station_current_water_level_m: float,
        is_forecast: bool,
    ) -> FloodPrediction:
        self._require_trained()

        effective_elevation = dem_elevation_m if dem_elevation_m is not None else altitude_m
        row = pd.DataFrame([{
            "rainfall_7d_mm": rainfall_mm,
            "longitude": longitude,
            "latitude": latitude,
            "elevation_m": effective_elevation,
            "distance_to_river_m": nearest_river_m,
        }])

        base_probability = float(self._predict_proba(self._estimator, row)[0])
        adjusted_probability = self._adjust_probability(base_probability, gauging_station_current_water_level_m)
        forecast_probability = (
            float(np.clip(adjusted_probability * 1.10 + 0.03, 0.0, 1.0)) if is_forecast else adjusted_probability
        )

        return FloodPrediction(
            flood_possibility="Likely" if adjusted_probability >= 0.50 else "Unlikely",
            category=self._category_from_probability(adjusted_probability),
            future_forecast={
                "enabled": bool(is_forecast),
                "probability": forecast_probability,
                "category": self._category_from_probability(forecast_probability),
            },
            probability=adjusted_probability,
            source=self._source,
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
                gauging_station_current_water_level_m=float(item["gauging_station_current_water_level_m"]),
                is_forecast=bool(item["is_forecast"]),
            )
            results.append({
                "input": item,
                "flood_possibility": pred.flood_possibility,
                "category": pred.category,
                "future_forecast": pred.future_forecast,
                "probability": pred.probability,
                "source": pred.source,
            })
        return results
