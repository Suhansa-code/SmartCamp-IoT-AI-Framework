# Model Comparison Guide

This directory contains tools to compare and evaluate all trained models in the SmartCamp IoT-AI Framework, with focus on edge-gateway flood prediction models.

## Files

### 1. **model_comparison.py** (Command-line tool)
Comprehensive Python script to compare both flood prediction and resource prediction models.

Located in: `edge-gateway/prediction-models/src/`

**Usage:**
```bash
cd edge-gateway/prediction-models/src

# Compare all models (flood + resource from cloud platform)
python model_comparison.py

# Compare only flood models
python model_comparison.py --model-type flood

# Compare only resource models (from cloud platform)
python model_comparison.py --model-type resource

# Generate detailed report with visualizations
python model_comparison.py --generate-report
```

**Output:**
- `src/comparison_results/model_comparison_summary.csv` - Summary metrics for all models
- `src/comparison_results/model_comparison_summary.json` - Detailed JSON report
- `src/comparison_results/flood_model_comparison.png` - Flood model visualization
- `src/comparison_results/resource_model_comparison.png` - Resource model visualization

---

## Models Being Compared

### Flood Prediction Models
Located in: `edge-gateway/prediction-models/`

- **Decision Tree Model** - `decision_tree_model/decision_tree_model.py`
- **Logistic Regression** - `logistic_regression_model/logistic_regression_model.py`
- **Random Forest** - `random_forest_model/random_forest_model.py`
- **XGBoost** - `xgboost_model/xgboost_model.py`

**Features Used:**
- `rainfall_7d_mm` - 7-day cumulative rainfall
- `longitude` - Geographic location (X coordinate)
- `latitude` - Geographic location (Y coordinate)
- `elevation_m` - Elevation above sea level
- `distance_to_river_m` - Distance to nearest river

**Dataset:** `edge-gateway/resources/sri_lanka_flood_risk_dataset_25000.csv`

---

### Resource Prediction Models
Located in: `cloud-platform/prediction-models/models/`

- `food_kg_day` - Daily food requirements (kg)
- `water_liters_day` - Daily water requirements (liters)
- `shelter_units` - Number of shelter units needed
- `medical_staff_needed` - Medical staff requirements

**Features Used:**
- Population statistics (refugees, IDPs, asylum seekers)
- Demographic ratios (children, elderly, female)
- Temporal features (year, arrival growth rate)
- Computed features (vulnerability index, log-transformed values)

---

## Performance Metrics Explained

### Classification Metrics (Flood Models)

| Metric | Range | Interpretation |
|--------|-------|-----------------|
| **Accuracy** | 0 to 1 | Proportion of correct predictions |
| **Precision** | 0 to 1 | Correctness of positive predictions (true positives / all positives) |
| **Recall** | 0 to 1 | Ability to find all positive cases (true positives / actual positives) |
| **F1 Score** | 0 to 1 | Harmonic mean of Precision and Recall (best overall balance) |
| **ROC-AUC** | 0 to 1 | Area under ROC curve, handles class imbalance well |

### Regression Metrics (Resource Models)

| Metric | Range | Interpretation |
|--------|-------|-----------------|
| **R² Score** | 0 to 1 | Proportion of variance explained. Higher is better (1.0 = perfect fit) |
| **MAE** | 0 to ∞ | Mean Absolute Error in original units. Lower is better |
| **RMSE** | 0 to ∞ | Root Mean Squared Error. Lower is better, penalizes large errors more |
| **MAPE** | 0% to ∞% | Mean Absolute Percentage Error. Lower is better for interpretability |

---

## Quality Assessment Guidelines

### For Flood Models (F1 Score):
- **🟢 Excellent**: F1 > 0.90 (90%+ performance)
- **🟡 Good**: F1 0.80-0.90 (80-90% performance)
- **🟠 Fair**: F1 0.70-0.80 (70-80% performance)
- **🔴 Poor**: F1 < 0.70 (less than 70% performance)

### For Resource Models (R² Score):
- **🟢 Excellent**: R² > 0.95 (95%+ variance explained)
- **🟡 Good**: R² 0.85-0.95 (85-95% variance explained)
- **🟠 Fair**: R² 0.70-0.85 (70-85% variance explained)
- **🔴 Poor**: R² < 0.70 (less than 70% variance explained)

### MAPE Interpretation:
- **🟢 Excellent**: < 10%
- **🟡 Good**: 10-20%
- **🟠 Fair**: 20-50%
- **🔴 Poor**: > 50%

---

## Interpreting Results

### Best Model Selection for Flood Prediction

1. **Primary metric: F1 Score** - Balances precision and recall
2. **Secondary metric: ROC-AUC** - Good for handling class imbalance
3. **Verify with Recall** - Minimize false negatives (missed floods are critical)

**Why F1?** In flood prediction, both false positives (unnecessary evacuations) and false negatives (missed warnings) have costs. F1 balances them.

### Best Model Selection for Resource Prediction

1. **Primary metric: R² Score** - Higher is better
2. **Secondary metric: MAE** - Lower is better (interpretable error in original units)
3. **Use MAPE** - For percentage-based comparison across different scales

---

## Typical Output Example

```
================================================================================
MODEL COMPARISON SUMMARY
================================================================================
                      Model Name Model Type      Accuracy   Precision    Recall  F1 Score  ROC-AUC
              decision_tree_model Flood Predict       0.82       0.79     0.81      0.80    0.87
           logistic_regression_mo Flood Predict       0.85       0.84     0.83      0.84    0.91
              random_forest_model Flood Predict       0.88       0.87     0.88      0.88    0.93
                   xgboost_model Flood Predict       0.91       0.90     0.91      0.91    0.95
                Resource_food_kg_ Resource Predic       NaN       NaN     NaN      NaN    0.9999
           Resource_water_liters_ Resource Predic       NaN       NaN     NaN      NaN    0.9999
              Resource_shelter_un Resource Predic       NaN       NaN     NaN      NaN    0.9999
            Resource_medical_staf Resource Predic       NaN       NaN     NaN      NaN    0.9999
================================================================================

✅ BEST PERFORMING MODEL:
   Target: xgboost_model
   Model Type: Flood Prediction
   F1 Score: 0.91 (91% balanced performance)
   ROC-AUC: 0.95
```

---

## Troubleshooting

### Issue: "Model file not found"
- Ensure all model Python files exist in subdirectories:
  - `edge-gateway/prediction-models/decision_tree_model/decision_tree_model.py`
  - `edge-gateway/prediction-models/xgboost_model/xgboost_model.py`
  - etc.
- Check that `.pkl` model files exist in `artifacts/` subdirectories

### Issue: "Dataset not found"
- Verify flood dataset exists at: `edge-gateway/resources/sri_lanka_flood_risk_dataset_25000.csv`
- For resource models: `cloud-platform/prediction-models/data/processed/camp_features.csv`

### Issue: "Resource models not loading"
- Ensure cloud platform models exist at: `cloud-platform/prediction-models/models/resource_model_*.pkl`
- Check metadata: `cloud-platform/prediction-models/models/resource_models_meta.json`

### Issue: Import errors
- Install dependencies:
  ```bash
  pip install scikit-learn pandas matplotlib seaborn xgboost lightgbm joblib
  ```

### Issue: Visualization errors
- Ensure matplotlib backend is available
- For headless systems, use: `matplotlib.use('Agg')`

---

## Model Location Reference

```
SmartCamp-IoT-AI-Framework/
├── edge-gateway/
│   ├── prediction-models/
│   │   ├── src/
│   │   │   ├── model_comparison.py          ← Run this
│   │   │   └── comparison_results/          ← Output here
│   │   ├── decision_tree_model/
│   │   ├── logistic_regression_model/
│   │   ├── random_forest_model/
│   │   ├── xgboost_model/
│   │   └── resources/                       ← Flood dataset
│   └── scripts/
│
└── cloud-platform/
    └── prediction-models/
        ├── models/                          ← Resource models
        ├── data/processed/                  ← Resource data
        └── notebooks/
```

---

## Next Steps

1. **Run comparison:**
   ```bash
   cd edge-gateway/prediction-models/src
   python model_comparison.py --generate-report
   ```

2. **Review results** in `src/comparison_results/`

3. **Deploy best model** based on metrics

4. **Monitor performance** with regular comparison runs

5. **Retrain if needed** when metrics degrade

---

## Related Documentation

- Flood models: See individual model Python files for detailed documentation
- Resource models: See `cloud-platform/prediction-models/MODEL_COMPARISON_README.md`
- Data: See `edge-gateway/resources/` for dataset descriptions
