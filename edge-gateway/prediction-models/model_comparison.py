"""
model_comparison.py

Comprehensive model comparison script to evaluate which models work best.
Compares both flood prediction models and resource prediction models.

Located in: edge-gateway/prediction-models/src/

Usage:
    python model_comparison.py
    python model_comparison.py --model-type flood
    python model_comparison.py --model-type resource
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

# Setup paths - adjusted for edge-gateway location
HERE = Path(__file__).parent
EDGE_GATEWAY_ROOT = HERE.parent
RESOURCES_DIR = EDGE_GATEWAY_ROOT / "resources"
OUTPUT_DIR = HERE / "comparison_results"
OUTPUT_DIR.mkdir(exist_ok=True)

# Cloud platform paths (for resource models if needed)
CLOUD_PLATFORM_ROOT = EDGE_GATEWAY_ROOT.parent.parent / "cloud-platform" / "prediction-models"
CLOUD_MODELS_DIR = CLOUD_PLATFORM_ROOT / "models"
CLOUD_DATA_DIR = CLOUD_PLATFORM_ROOT / "data" / "processed"

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
    """Compare flood prediction models"""
    
    MODEL_TYPES = [
        "decision_tree_model",
        "logistic_regression_model", 
        "random_forest_model",
        "xgboost_model"
    ]
    
    FLOOD_MODELS_DIR = EDGE_GATEWAY_ROOT
    DATASET_PATH = RESOURCES_DIR / "sri_lanka_flood_risk_dataset_25000.csv"
    
    FEATURES = [
        "rainfall_7d_mm",
        "longitude",
        "latitude",
        "elevation_m",
        "distance_to_river_m",
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
            
            # Prepare features and target
            if self.TARGET not in df.columns:
                logger.warning(f"Target column '{self.TARGET}' not found. Using 'flood_probability'")
                if 'flood_probability' in df.columns:
                    df[self.TARGET] = (df['flood_probability'] > df['flood_probability'].median()).astype(int)
            
            if all(col in df.columns for col in self.FEATURES):
                X = df[self.FEATURES].fillna(df[self.FEATURES].mean())
                y = df[self.TARGET]
                
                self.X_test, _, self.y_test, _ = train_test_split(
                    X, y, test_size=0.2, random_state=42
                )
                logger.info(f"Prepared test set: {self.X_test.shape}")
            else:
                logger.warning("Required features not found in dataset")
                
        except Exception as e:
            logger.error(f"Error loading data: {e}")
    
    def load_models(self) -> Dict[str, object]:
        """Load all flood prediction models"""
        for model_name in self.MODEL_TYPES:
            model_path = self.FLOOD_MODELS_DIR / model_name / f"{model_name}.py"
            
            if not model_path.exists():
                logger.warning(f"Model file not found: {model_path}")
                continue
                
            try:
                # Try to load pickled model if available
                artifact_dir = self.FLOOD_MODELS_DIR / model_name / "artifacts"
                if artifact_dir.exists():
                    # Look for .pkl or .joblib files
                    pkl_files = list(artifact_dir.glob("*.pkl")) + list(artifact_dir.glob("*.joblib"))
                    if pkl_files:
                        model = joblib.load(pkl_files[0])
                        self.models[model_name] = model
                        logger.info(f"Loaded {model_name}")
                        
            except Exception as e:
                logger.error(f"Error loading {model_name}: {e}")
        
        return self.models
    
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


class ResourceModelComparison:
    """Compare resource prediction models from cloud platform"""
    
    TARGET_COLS = [
        'food_kg_day',
        'water_liters_day', 
        'shelter_units',
        'medical_staff_needed'
    ]
    
    def __init__(self):
        self.models = {}
        self.results = {}
        self.metadata = {}
        self.X_test = None
        self.y_test = None
        self._load_metadata()
        self._load_data()
        
    def _load_metadata(self):
        """Load model metadata"""
        meta_path = CLOUD_MODELS_DIR / "resource_models_meta.json"
        if meta_path.exists():
            with open(meta_path, 'r') as f:
                self.metadata = json.load(f)
            logger.info(f"Loaded metadata for {len(self.metadata)} resource models from cloud platform")
        else:
            logger.warning(f"Metadata file not found at {meta_path}")
    
    def _load_data(self):
        """Load resource dataset"""
        data_file = CLOUD_DATA_DIR / "camp_features.csv"
        if not data_file.exists():
            logger.warning(f"Data file not found: {data_file}")
            return
        
        try:
            df = pd.read_csv(data_file)
            logger.info(f"Loaded resource data: {df.shape}")
            
            # Identify feature columns
            feature_cols = [col for col in df.columns if col not in self.TARGET_COLS]
            
            if feature_cols and any(target in df.columns for target in self.TARGET_COLS):
                X = df[feature_cols].fillna(df[feature_cols].mean())
                
                self.X_test, _, _, _ = train_test_split(
                    X, X, test_size=0.2, random_state=42
                )
                logger.info(f"Prepared test set: {self.X_test.shape}")
                
        except Exception as e:
            logger.error(f"Error loading resource data: {e}")
    
    def load_models(self) -> Dict[str, object]:
        """Load all trained resource models from cloud platform"""
        for target in self.TARGET_COLS:
            model_path = CLOUD_MODELS_DIR / f"resource_model_{target}.pkl"
            
            if not model_path.exists():
                logger.warning(f"Model not found: {model_path}")
                continue
            
            try:
                model = joblib.load(model_path)
                self.models[target] = model
                logger.info(f"Loaded model for {target} from cloud platform")
                
            except Exception as e:
                logger.error(f"Error loading model for {target}: {e}")
        
        return self.models
    
    def evaluate_models(self) -> Dict[str, ModelMetrics]:
        """Evaluate all resource models"""
        if len(self.models) == 0:
            logger.warning("No resource models available")
            return {}
        
        for target, model in self.models.items():
            try:
                # Get test data for this target
                test_file = CLOUD_DATA_DIR / "camp_features.csv"
                if test_file.exists():
                    df = pd.read_csv(test_file)
                    
                    feature_cols = [col for col in df.columns if col not in self.TARGET_COLS]
                    X = df[feature_cols].fillna(df[feature_cols].mean())
                    y = df[target] if target in df.columns else None
                    
                    if y is not None:
                        _, X_test, _, y_test = train_test_split(
                            X, y, test_size=0.2, random_state=42
                        )
                        
                        y_pred = model.predict(X_test)
                        
                        metrics = ModelMetrics(
                            model_name=f"Resource_{target}",
                            model_type="Resource Prediction",
                            mae=mean_absolute_error(y_test, y_pred),
                            rmse=np.sqrt(mean_squared_error(y_test, y_pred)),
                            r2=r2_score(y_test, y_pred)
                        )
                        
                        self.results[target] = metrics
                        logger.info(f"{target}: R²={metrics.r2:.4f}, MAE={metrics.mae:.2f}, RMSE={metrics.rmse:.2f}")
                        
            except Exception as e:
                logger.error(f"Error evaluating {target}: {e}")
        
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
            return
        
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
        
        # Flood models
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
        
        report += "\n"
        
        # Resource models
        resource_df = df[df['model_type'] == 'Resource Prediction'].copy()
        if not resource_df.empty:
            report += "RESOURCE PREDICTION MODELS:\n"
            report += "-" * 40 + "\n"
            
            if 'r2' in resource_df.columns:
                best_model = resource_df.loc[resource_df['r2'].idxmax()]
                report += f"✓ Best Model (by R²): {best_model['model_name']}\n"
                report += f"  - R² Score: {best_model.get('r2', 'N/A')}\n"
                report += f"  - MAE: {best_model.get('mae', 'N/A')}\n"
                report += f"  - RMSE: {best_model.get('rmse', 'N/A')}\n"
            
            report += "\nAll Models Performance:\n"
            for _, row in resource_df.iterrows():
                report += f"  {row['model_name']}: "
                report += f"R²={row.get('r2', 'N/A')}, "
                report += f"MAE={row.get('mae', 'N/A')}\n"
        
        report += "\n" + "="*60 + "\n"
        
        return report


def main():
    parser = argparse.ArgumentParser(description='Compare all trained models')
    parser.add_argument('--model-type', choices=['flood', 'resource', 'all'], 
                       default='all', help='Type of models to compare')
    parser.add_argument('--generate-report', action='store_true', 
                       help='Generate detailed report and visualizations')
    
    args = parser.parse_args()
    
    logger.info("Starting Model Comparison")
    logger.info("="*60)
    
    flood_results = {}
    resource_results = {}
    
    # Compare flood models
    if args.model_type in ['flood', 'all']:
        logger.info("\n--- Comparing Flood Models ---")
        flood_comp = FloodModelComparison()
        flood_comp.load_models()
        flood_results = flood_comp.evaluate_models()
    
    # Compare resource models
    if args.model_type in ['resource', 'all']:
        logger.info("\n--- Comparing Resource Models ---")
        resource_comp = ResourceModelComparison()
        resource_comp.load_models()
        resource_results = resource_comp.evaluate_models()
    
    # Generate reports
    logger.info("\n--- Generating Reports ---")
    report = ComparisonReport(flood_results, resource_results)
    summary_df = report.save_summary_report()
    
    print("\n" + summary_df.to_string() if not summary_df.empty else "\nNo results available")
    print(report.generate_recommendations())
    
    if args.generate_report:
        logger.info("Generating visualizations...")
        report.generate_visualizations()
    
    logger.info(f"\nResults saved to: {OUTPUT_DIR}")
    logger.info("Model Comparison Complete!")


if __name__ == "__main__":
    main()
