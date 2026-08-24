# TASK — Generate a 10-page DOCX technical report on the two prediction models

You are working inside my existing repository:

```
SmartCamp-IoT-AI-Framework
```

Produce ONE Microsoft Word file:

```
docs/Prediction_Models_Report.docx
```

covering **two models only**:

1. **Network Prediction Model** (network state / QoS adaptation)
2. **Food and Resource Prediction Model** (daily camp resource requirements)

---

## HARD CONSTRAINT — THE DOCUMENT MUST BE 10 PAGES

This is the single most important formatting requirement. Ten pages, not
eleven, not twenty. Enforce it with a budget, not by guessing:

- **Total body prose: 2,800–3,400 words.** Count it before saving.
- **Maximum 10 tables.** Compact ones only — no table wider than 5 columns.
- **Maximum 4 figures**, each no wider than 14 cm.
- Body font 10 pt, table font 8 pt, margins 2.0 cm, line spacing 1.05.
- **No table of contents page**, no separate title page — put a compact title
  block at the top of page 1 and start the content immediately underneath.
- Do not add appendices, a glossary, a references section, or a revision
  history. If content will not fit, cut detail — never add pages.

Page budget to plan against:

| Pages | Content |
|---|---|
| 1 | Title block, abstract (~120 words), Section 1 Introduction |
| 2–3 | Section 2 Food and Resource Prediction Model — inputs, outputs, sample output |
| 3–4 | Section 3 Network Prediction Model — inputs, outputs, sample output |
| 5 | Section 4 Model explanation (both models, how each actually works) |
| 6–7 | Section 5 Training methodology and model comparison |
| 8 | Section 6 Selected model per target, with the selection rationale |
| 9 | Section 7 Selected-model analysis (error behaviour, reliability, limits) |
| 10 | Section 8 Conclusion |

python-docx cannot count pages. Control length by the word/table/figure
budget above, then state in your final message what the counts came to so I
can confirm when I open the file.

---

## STEP 1 — INSPECT BEFORE YOU WRITE

Do not write a single line of the report until you have read the actual
implementation. Read these files in full:

**Food and Resource Prediction Model**
```
cloud-platform/prediction-models/src/resource_predictor.py
cloud-platform/prediction-models/src/camp_data.py
cloud-platform/prediction-models/src/predict_manual.py
cloud-platform/prediction-models/models/lka/resource_models_meta.json
cloud-platform/prediction-models/models/resource_models_meta.json
cloud-platform/prediction-models/notebooks/02_resource_prediction_model.ipynb
cloud-platform/prediction-models/notebooks/05_sri_lanka_camp_model.ipynb
raspberry-platform/backend/services/resource/prediction.js
raspberry-platform/backend/data/resource/distribution.json
```

**Network Prediction Model**
```
raspberry-platform/prediction-models/src/network_predictor.py
raspberry-platform/prediction-models/src/feature_extraction.py
raspberry-platform/prediction-models/src/data_generator.py
raspberry-platform/prediction-models/models/network_model_meta.json
raspberry-platform/prediction-models/scripts/network_monitor_service.py
raspberry-platform/backend/services/network/saamp-mqtt.js
raspberry-platform/prediction-models/notebooks/03_network_prediction_model.ipynb
```

Read hyperparameters back from the fitted `.pkl` artifacts with joblib —
do not copy them from notebook source, because the two can differ.

---

## STEP 2 — GROUND TRUTH TO VERIFY (do not assume, confirm each)

These facts were established by a previous audit of this repository. Treat
them as claims to re-verify, not as input to copy. If your inspection
contradicts any of them, trust your inspection and say so in the document.

**Food and Resource model**
- Four separate single-output regressors, one per target. Targets:
  `food_kg_day`, `water_liters_day`, `shelter_units`, `medical_staff_needed`.
- "Resource" means humanitarian supplies — NOT CPU, RAM, bandwidth or compute.
  State this explicitly once, early, to prevent misreading.
- Deployed artifacts live in `models/lka/`, are all `GradientBoostingRegressor`
  (n_estimators=200, learning_rate=0.05, max_depth=5, random_state=42),
  21 input features, shared `StandardScaler`.
- `models/` is MISSING `resource_model_*.pkl` and `resource_scaler.pkl`, so
  `ResourcePredictor()` on its default path raises FileNotFoundError. Only
  `ResourcePredictor(models_dir='models/lka')` works. Verify by instantiating.
- Recorded test metrics (models/lka), n=1,600: R² 0.999948 / 0.999998 /
  0.999998 / 0.999621; MAE 90.396 kg/day / 184.633 L/day / 2.752 units /
  0.411 staff.
- The targets are computed from a per-person rate table before training, so
  they are a deterministic function of `total_population` and the demographic
  ratios. This is why R² approaches 1. Say so plainly — do not present the R²
  as evidence of predictive skill.
- Rate table provenance (stored in `_rate_sources` in the metadata): child food
  1.76 kg/day from a real Sri Lankan 24-h dietary recall survey (n=653, ages
  6–14); adult 1.60 kg/day from production `distribution.json`; elderly
  1.36 kg/day = adult × 0.85, flagged in the artifact as an unmeasured
  assumption; water 15 L/day from the Sphere minimum.
- The older global model in notebook 02 selected Ridge for three targets and
  GradientBoosting for `medical_staff_needed`, trained on 2,251 UNHCR
  country-year rows.

**Network model**
- Two stages: a `RandomForestClassifier` (n_estimators=200, max_depth=12,
  min_samples_leaf=5, class_weight='balanced', random_state=42, 18 features)
  predicting STABLE / DEGRADED / CRITICAL, then a deterministic rule
  `decideAdaptiveQoS()` in `saamp-mqtt.js` mapping (priority, base QoS, state)
  to an MQTT QoS level and a publish-or-buffer action.
- Recorded test result: accuracy 1.0000, precision/recall/F1 = 1.0000 for all
  three classes, support 2,567 / 730 / 703 on a 4,000-row test split.
- The 1.0000 is caused by label leakage: `label_network_state()` derives the
  class labels by thresholding `packet_loss`, `rtt_avg`, `queue_depth` and
  `bridge_alive`, which are four of the model's own input features. Report this
  as the explanation. Do not present 1.0000 as a performance achievement.
- Trained on `data/network_qos_dataset.csv`, 20,000 synthetic rows generated by
  `src/data_generator.py` with seed 42.
- The direct QoS classifier from notebook 03 Part B was never saved —
  `qos_model.pkl` does not exist, so its accuracy is unavailable.

---

## STEP 3 — REQUIRED CONTENT

Cover exactly these, in this order. Give each model equal weight.

### Model inputs
For each model, a table of the actual features: name, meaning, unit, where the
value comes from at runtime. The resource model has 21 features (14 base + 7
derived); the network model has 18. If a feature is derived rather than
measured at serving time, say so — several of the network features are
computed from `rtt_avg` by fixed formulas in `network_monitor_service.py`.

### Model outputs
For each model: what it emits, the data type, the unit, and the range. For the
network model include both stages — the state label and the resulting
`{qos, action}` decision.

### Sample model output
Run the models and paste **real** output. For the resource model, load
`models/lka/` and predict for at least three camp sizes. For the network model,
run the three built-in profiles in `network_monitor_service.py`
(`--simulate STABLE|DEGRADED|CRITICAL`) or call the model directly on those
metric dictionaries. Show the literal dictionaries returned. If a model cannot
be loaded in your environment, say exactly why instead of inventing output.

### Model explanation
Plain-English description of how each model actually works — the mechanism, not
generic ML theory. A reader should understand the model without opening the
source. Include the adaptive rule table for the network model (3 states ×
4 priorities = 12 cells, all readable from `decideAdaptiveQoS()`).

### Model training and comparison
The pipeline for each: data source, feature construction, split, scaling,
candidates compared, and the metrics for every candidate — not just the winner.
Notebook 02 records a five-algorithm comparison (Ridge, RandomForest,
GradientBoosting, XGBoost, LightGBM) with R²/MAE/RMSE per target; include it.
State plainly that there is no validation split and no cross-validation.

### Selected model
Which model won per target, and why. Be specific about the selection criterion
(highest test R², chosen on the same split later reported as the result) and
note the bias that introduces.

### Selected model analysis
Not a restatement of the metrics. Analyse: where the error actually is, whether
the model generalises, what the leakage means for the headline numbers, and any
train/serve mismatch. If you can compute a disaggregated error — for example
relative error stratified by camp population — do it and report it, clearly
labelled as computed by you rather than recorded in the repo.

### Conclusion
What each model does well, what the numbers genuinely support, and the two or
three things that would need to be measured before the results could be claimed
more strongly. Keep it to roughly 250 words.

---

## STEP 4 — ABSOLUTE RULE: NO FABRICATION

Never invent an accuracy, MAE, RMSE, R², F1, latency, throughput, packet-loss,
QoS improvement, training time, dataset size, hyperparameter or layer count.
Every number must come from a file in the repo, from a saved artifact, or from
code you actually executed. Where something cannot be found, write exactly:

> Not available in the current repository.

and add one sentence on what would need to be measured to obtain it. A short
honest report is the goal; a padded one is a failure.

---

## STEP 5 — FIGURES (maximum 4)

Only generate figures from real data. Suggested, in priority order:
1. Actual vs predicted for the resource targets, from held-out predictions.
2. Confusion matrix for the network classifier on its test split.
3. Feature importance for the network classifier.
4. Algorithm comparison (test MAE) for the resource model.

Each needs a numbered caption and one sentence of explanation in the body. Skip
any figure you cannot build from genuine data — do not fill the slot.

---

## STEP 6 — BUILD AND VERIFY

Use the project virtual environment. There is **no `.venv` at the repository
root**; the one that exists is:

```
cloud-platform/prediction-models/.venv
```

It already has python-docx, matplotlib, pandas and scikit-learn. Check first:

```bash
cloud-platform/prediction-models/.venv/bin/python -c "import docx; print(docx.__version__)"
```

Note: the `models/lka/*.pkl` artifacts were pickled under scikit-learn 1.8.0 and
may fail to load under a newer scikit-learn with
`ModuleNotFoundError: No module named '_loss'`. If that happens, try
`~/ds-env/bin/python`, which has 1.8.0. Report which interpreter you used.

Generate the file with python-docx — a genuine `.docx`, not a renamed Markdown
file. Use real Word heading styles (Heading 1/2), page numbers in the footer,
and proper table styling.

Verify before finishing:

```bash
ls -lh docs/Prediction_Models_Report.docx
cloud-platform/prediction-models/.venv/bin/python -c "from docx import Document; d=Document('docs/Prediction_Models_Report.docx'); print('Paragraphs:', len(d.paragraphs), 'Tables:', len(d.tables), 'Images:', len(d.inline_shapes))"
unzip -t docs/Prediction_Models_Report.docx | tail -1
```

---

## STEP 7 — FINAL MESSAGE

Report concisely:
- Word count, table count, figure count, and your estimated page count.
- The selected model and headline metric for each of the two models.
- Anything you marked "Not available in the current repository."
- Which Python interpreter you used and whether the artifacts loaded.

Do not describe what you would do. Inspect the repository, run the models,
write the report, generate the file, verify it, and tell me where it is.