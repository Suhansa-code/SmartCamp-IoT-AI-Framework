"""
model_comparison.py

Discover trained models saved in edge-gateway/prediction-models/models/,
evaluate the compatible ones against the available datasets, and report the
best saved model.

Usage:
    python model_comparison.py
    python model_comparison.py --generate-report
"""

import json
import logging
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import argparse
from dataclasses import dataclass
import sys

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Setup paths - centralized model storage on edge-gateway
HERE = Path(__file__).parent  # edge-gateway/prediction-models/
EDGE_GATEWAY_ROOT = HERE.parent  # edge-gateway/
RESOURCES_DIR = EDGE_GATEWAY_ROOT / "resources"
MODELS_DIR = HERE / "models"  # Central location for all trained models
MODELS_DIR.mkdir(exist_ok=True)
OUTPUT_DIR = HERE / "comparison_results"
OUTPUT_DIR.mkdir(exist_ok=True)
DATA_DIR = HERE / "data" / "processed"

logger.info(f"Models directory: {MODELS_DIR}")
logger.info(f"Resources directory: {RESOURCES_DIR}")

# Import metrics
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    roc_auc_score, confusion_matrix, classification_report,
    mean_absolute_error, mean_squared_error, r2_score
)
from sklearn.model_selection import train_test_split


@dataclass
class ModelMetrics:
    """Container for model evaluation metrics"""
    model_name: str
    model_type: str
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    roc_auc: Optional[float] = None
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2: Optional[float] = None
    
    def to_dict(self) -> Dict:
        """Convert metrics to dictionary"""
        return {k: v for k, v in self.__dict__.items() if v is not None}


class FloodModelComparison:
    """Compare flood prediction models stored in edge-gateway/prediction-models/models/"""
    
    DATASET_PATH = RESOURCES_DIR / "sri_lanka_flood_risk_dataset_25000.csv"
    
    FEATURES = [
        "rainfall_7d_mm",
        "longitude",
        "latitude",
        "elevation_m",
        "distance_to_river_m",
        "water_level_m",
        "elevation_ratio",
        "river_proximity_score",
    ]
    TARGET = "flood_risk"
    
    def __init__(self):
        self.models = {}
        self.results = {}
        self.X_test = None
        self.y_test = None
        self._load_data()
        
    def _load_data(self):
        """Load and preprocess flood dataset"""
        if not self.DATASET_PATH.exists():
            logger.warning(f"Dataset not found at {self.DATASET_PATH}")
            return
            
        try:
            df = pd.read_csv(self.DATASET_PATH)
            logger.info(f"Loaded flood dataset: {df.shape}")
            
            # Prepare features and target.
            if all(col in df.columns for col in self.FEATURES):
                X = df[self.FEATURES].fillna(df[self.FEATURES].mean(numeric_only=True))

                if self.TARGET in df.columns:
                    y = pd.to_numeric(df[self.TARGET], errors="coerce")
                elif "flood_occurrence_current_event" in df.columns:
                    y = df["flood_occurrence_current_event"].map({"Yes": 1, "No": 0})
                elif "flood_probability" in df.columns:
                    flood_probability = pd.to_numeric(df["flood_probability"], errors="coerce")
                    y = (flood_probability > flood_probability.median()).astype(int)
                else:
                    logger.warning("No usable flood target column found")
                    return

                y = y.dropna()
                X = X.loc[y.index]
                
                self.X_test, _, self.y_test, _ = train_test_split(
                    X, y, test_size=0.2, random_state=42
                )
                logger.info(f"Prepared test set: {self.X_test.shape}")
            else:
                logger.warning("Required features not found in dataset")
                
        except Exception as e:
            logger.error(f"Error loading data: {e}")
    
    def load_models(self) -> Dict[str, object]:
        """Load every saved flood model from MODELS_DIR"""
        model_files = sorted(
            path for path in MODELS_DIR.glob("*.pkl") if not path.name.startswith("resource_")
        )

        for model_path in model_files:
            model_name = model_path.stem
            
            if not model_path.exists():
                logger.warning(f"Flood model not found: {model_path}")
                continue
                
            try:
                model = joblib.load(model_path)
                self.models[model_name] = model
                logger.info(f"✓ Loaded flood model: {model_name}")
            except Exception as e:
                logger.error(f"Error loading {model_name}: {e}")
        
        return self.models

    def best_result(self) -> Optional[ModelMetrics]:
        """Return the best flood model using F1, then ROC-AUC, then accuracy."""
        if not self.results:
            return None

        ranked = sorted(
            self.results.values(),
            key=lambda metrics: (
                metrics.f1 if metrics.f1 is not None else -1,
                metrics.roc_auc if metrics.roc_auc is not None else -1,
                metrics.accuracy if metrics.accuracy is not None else -1,
            ),
            reverse=True,
        )
        return ranked[0]
    
    def evaluate_models(self) -> Dict[str, ModelMetrics]:
        """Evaluate all loaded models"""
        if self.X_test is None or len(self.models) == 0:
            logger.warning("No test data or models available")
            return {}
        
        for model_name, model in self.models.items():
            try:
                y_pred = model.predict(self.X_test)
                y_pred_proba = model.predict_proba(self.X_test)[:, 1] if hasattr(model, 'predict_proba') else y_pred
                
                metrics = ModelMetrics(
                    model_name=model_name,
                    model_type="Flood Prediction",
                    accuracy=accuracy_score(self.y_test, y_pred),
                    precision=precision_score(self.y_test, y_pred, zero_division=0),
                    recall=recall_score(self.y_test, y_pred, zero_division=0),
                    f1=f1_score(self.y_test, y_pred, zero_division=0),
                    roc_auc=roc_auc_score(self.y_test, y_pred_proba)
                )
                
                self.results[model_name] = metrics
                logger.info(f"{model_name}: Accuracy={metrics.accuracy:.4f}, F1={metrics.f1:.4f}")
                
            except Exception as e:
                logger.error(f"Error evaluating {model_name}: {e}")
        
        return self.results


class ComparisonReport:
    """Generate comparison reports and visualizations"""
    
    def __init__(self, flood_results: Dict, resource_results: Dict):
        self.flood_results = flood_results
        self.resource_results = resource_results
        
    def generate_summary_table(self) -> pd.DataFrame:
        """Generate summary table of all models"""
        all_results = []
        
        for model_name, metrics in self.flood_results.items():
            all_results.append(metrics.to_dict())
        
        for target, metrics in self.resource_results.items():
            all_results.append(metrics.to_dict())
        
        if not all_results:
            logger.warning("No results to summarize")
            return pd.DataFrame()
        
        df = pd.DataFrame(all_results)
        return df.round(4)
    
    def save_summary_report(self):
        """Save summary report as CSV and JSON"""
        df = self.generate_summary_table()
        
        if df.empty:
            logger.warning("No data to save")
            return df
        
        # Save as CSV
        csv_path = OUTPUT_DIR / "model_comparison_summary.csv"
        df.to_csv(csv_path, index=False)
        logger.info(f"Saved summary to {csv_path}")
        
        # Save as JSON
        json_path = OUTPUT_DIR / "model_comparison_summary.json"
        with open(json_path, 'w') as f:
            json.dump(df.to_dict('records'), f, indent=2)
        logger.info(f"Saved JSON to {json_path}")
        
        return df
    
    def generate_visualizations(self):
        """Generate comparison visualizations"""
        df = self.generate_summary_table()
        
        if df.empty:
            logger.warning("No data for visualizations")
            return
        
        # Setup plot style
        sns.set_style("whitegrid")
        plt.rcParams['figure.figsize'] = (14, 10)
        
        # Classification metrics comparison (flood models)
        classification_cols = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc']
        flood_df = df[df['model_type'] == 'Flood Prediction'].copy()
        
        if not flood_df.empty:
            fig, ax = plt.subplots(figsize=(12, 6))
            
            for col in classification_cols:
                if col in flood_df.columns:
                    values = flood_df[col].dropna()
                    if len(values) > 0:
                        ax.plot(flood_df['model_name'].dropna(), values, marker='o', label=col)
            
            ax.set_title('Flood Model Comparison - Classification Metrics', fontsize=14, fontweight='bold')
            ax.set_xlabel('Model')
            ax.set_ylabel('Score')
            ax.legend()
            ax.grid(True, alpha=0.3)
            plt.xticks(rotation=45)
            plt.tight_layout()
            
            fig_path = OUTPUT_DIR / "flood_model_comparison.png"
            plt.savefig(fig_path, dpi=300, bbox_inches='tight')
            logger.info(f"Saved flood comparison plot to {fig_path}")
            plt.close()
        
        # Regression metrics comparison (resource models)
        regression_cols = ['mae', 'rmse', 'r2']
        resource_df = df[df['model_type'] == 'Resource Prediction'].copy()
        
        if not resource_df.empty:
            fig, axes = plt.subplots(1, 3, figsize=(15, 5))
            
            for idx, col in enumerate(regression_cols):
                if col in resource_df.columns:
                    values = resource_df[col].dropna()
                    if len(values) > 0:
                        axes[idx].bar(range(len(values)), values, color='steelblue')
                        axes[idx].set_title(f'Resource Model {col.upper()}', fontweight='bold')
                        axes[idx].set_ylabel(col)
                        axes[idx].set_xticks(range(len(resource_df)))
                        axes[idx].set_xticklabels(resource_df['model_name'], rotation=45, ha='right')
            
            plt.tight_layout()
            fig_path = OUTPUT_DIR / "resource_model_comparison.png"
            plt.savefig(fig_path, dpi=300, bbox_inches='tight')
            logger.info(f"Saved resource comparison plot to {fig_path}")
            plt.close()
    
    def generate_recommendations(self) -> str:
        """Generate model recommendations based on metrics"""
        df = self.generate_summary_table()
        
        if df.empty:
            return "No models evaluated"
        
        report = "\n" + "="*60 + "\n"
        report += "MODEL COMPARISON RECOMMENDATIONS\n"
        report += "="*60 + "\n\n"
        
        flood_df = df[df['model_type'] == 'Flood Prediction'].copy()
        if not flood_df.empty:
            report += "FLOOD PREDICTION MODELS:\n"
            report += "-" * 40 + "\n"
            
            if 'f1' in flood_df.columns:
                best_model = flood_df.loc[flood_df['f1'].idxmax()]
                report += f"✓ Best Model (by F1): {best_model['model_name']}\n"
                report += f"  - Accuracy: {best_model.get('accuracy', 'N/A')}\n"
                report += f"  - F1 Score: {best_model.get('f1', 'N/A')}\n"
                report += f"  - ROC-AUC: {best_model.get('roc_auc', 'N/A')}\n"
            
            report += "\nAll Models Performance:\n"
            for _, row in flood_df.iterrows():
                report += f"  {row['model_name']}: "
                report += f"Accuracy={row.get('accuracy', 'N/A')}, "
                report += f"F1={row.get('f1', 'N/A')}\n"
        
        report += "\n" + "="*60 + "\n"
        
        return report


def main():
    parser = argparse.ArgumentParser(description='Compare saved models and find the best one')
    parser.add_argument('--generate-report', action='store_true',
                        help='Generate visualizations for the evaluated models')
    
    args = parser.parse_args()
    
    logger.info("Starting Model Comparison")
    logger.info("="*60)
    
    logger.info("\n--- Comparing Saved Flood Models ---")
    flood_comp = FloodModelComparison()
    flood_comp.load_models()
    flood_results = flood_comp.evaluate_models()
    
    # Generate reports
    logger.info("\n--- Generating Reports ---")
    report = ComparisonReport(flood_results, {})
    summary_df = report.save_summary_report()
    
    if summary_df is not None and not summary_df.empty:
        print("\n" + summary_df.to_string())
    else:
        print("\nNo results available")

    best_result = flood_comp.best_result()
    if best_result is not None:
        print(
            "\nBest saved model: "
            f"{best_result.model_name} (F1={best_result.f1:.4f}, "
            f"ROC-AUC={best_result.roc_auc:.4f}, Accuracy={best_result.accuracy:.4f})"
        )
    else:
        print("\nNo flood models could be evaluated")

    print(report.generate_recommendations())
    
    if args.generate_report:
        logger.info("Generating visualizations...")
        report.generate_visualizations()
    
    logger.info(f"\nResults saved to: {OUTPUT_DIR}")
    logger.info("Model Comparison Complete!")


if __name__ == "__main__":
    main()
