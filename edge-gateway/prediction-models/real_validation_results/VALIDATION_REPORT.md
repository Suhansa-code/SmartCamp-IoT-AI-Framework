# Flood Model Validation — Real Disaster Data

## 1. Objective

Check whether the flood-prediction model works on real Sri Lankan disaster
situations (panel request), not only on synthetic training data.

## 2. Data sources

| Data | Source | Link |
|---|---|---|
| River water levels + flood labels | DMC daily water-level PDF reports | https://www.dmc.gov.lk/index.php?option=com_dmcreports&view=reports&Itemid=277&report_type_id=6&lang=en |
| Flood events (Sri Lanka 2025–26) | IDMC (reported by DMC) | https://data.internal-displacement.org/ |
| Rainfall (ERA5) | Open-Meteo archive API | https://open-meteo.com/en/docs/historical-weather-api |
| Elevation (SRTM) | Open-Meteo elevation API | https://open-meteo.com/en/docs/elevation-api |
| Gauge thresholds (alert/minor/major) | DMC gauge network | `edge-gateway/resources/gauging_stations.csv` |

## 3. Dataset

`edge-gateway/resources/sri_lanka_flood_real_dataset.csv`, built by
`build_real_flood_dataset.py` (scrapes DMC PDFs, merges ERA5 + SRTM,
targets dates of known IDMC events):

| Property | Value |
|---|---|
| Station-days | 3,335 |
| Flood days (label = 1) | 125 (3.7%) |
| Gauge stations | 39 |
| Period | 2025-06 → 2026-10 |
| Label rule | DMC status: Minor/Major Flood or inaccessible gauge = 1, Normal = 0 |

## 4. Train / validation / test split

Temporal split by report date (no shuffling, no future data in training):

| Split | Date range | Rows | Flood days |
|---|---|---|---|
| Train | < 2026-02-25 | 2,483 | 111 |
| Validation | 2026-02-25 → 2026-06-30 | 428 | 9 |
| Test (untouched) | ≥ 2026-06-30 | 424 | 5 |

Class imbalance (3.7% positive) is handled with `scale_pos_weight` on the
train split only. Calibration (sigmoid, cv=3) is fit on the train split only.

## 5. Threshold selection

- **Method:** F2-optimal threshold computed on the **validation split only**.
  F2 is used because, in disaster warning, missing a flood costs more than a
  false alarm (recall weighted 4× precision).
- **Result:** threshold = **0.570**. The F1-optimal threshold on the same
  validation split is also 0.570 (both criteria agree).
- The test split is evaluated **once** at this frozen threshold.
- Previous protocol (threshold tuned on the test split itself) was removed
  after review; all numbers below use the corrected protocol.

## 6. Evaluation methodology

Two complementary tests:

1. **Internal temporal test** — held-out future dates from the same 39 stations.
2. **External real-event test** (`validate_real_events.py`) — 30 documented
   IDMC flood events (2025–26) vs 500 control locations.
   - **Controls** = 500 locations sampled from the legacy dataset's no-flood
     rows, all >10 km from any documented event. They are *assumed* non-flood
     (no flood documented within 10 km); they are not independently verified
     non-flood ground truth.
   - **Forecast-only scenarios** (during_event / pre_event): no gauge stage
     given to any location — measures pure forecast skill.
   - **Gauge scenario** (during_event_gauge): event locations are given the
     real nearest-gauge reading at minor-flood stage, controls stay at 0.0 —
     this mirrors the operator workflow (staff reports "gauge in flood",
     model decides) and intentionally gives the model that reading.

## 7. Key results

### 7.1 Internal temporal test (untouched, threshold 0.570)

| Metric | Value |
|---|---|
| ROC-AUC | 1.000 |
| Precision / Recall / F1 | 1.000 / 0.800 / 0.889 |
| Confusion matrix | 419 TN, 0 FP, 1 FN, 4 TP |

Caveat: only 5 flood days fall in the test split — internal numbers are weak
evidence on their own. The external test below is the main evidence.

### 7.2 External test — 30 real flood events vs 500 controls (threshold 0.570)

| Scenario | ROC-AUC | Events found | Precision | F1 |
|---|---|---|---|---|
| during_event (rain 400 mm, no gauge) | 0.333 | 0 / 30 | 0.00 | 0.00 |
| pre_event (rain 106 mm, no gauge) | 0.324 | 0 / 30 | 0.00 | 0.00 |
| during_event + real gauge stage | **0.930** | **26 / 30 (87%)** | 0.317 | 0.464 |

Gauge scenario detail: confusion matrix 444 TN, 56 FP, 4 FN, 26 TP
(56 of 500 controls = 11.2% false alarms); mean probability 0.74 on events
vs 0.22 on controls.

### 7.3 Case study — Cyclone Ditwah, Polonnaruwa (27 Nov – 3 Dec 2025)

Real inputs: rain 255.8 mm/7d (ERA5), elevation 39 m (SRTM), Manampitiya
gauge (Mahaweli Ganga) at minor-flood stage 4.3 m; 13,365 displaced
(IDMC/DMC, event_id 37189).

| Model | Probability | Verdict | Correct? |
|---|---|---|---|
| Old synthetic model (threshold 0.30) | 0.000 | No flood | ✗ missed |
| **New real-data model (threshold 0.57)** | **0.853** | **Flood** | **✓** |

Reproduce: `python edge-gateway/prediction-models/validate_ditwah_case.py`

## 8. Limitations

1. **Forecast-only skill is still near chance** (AUC ≈ 0.33). The model is
   decision support on top of a live/entered gauge reading, not a standalone
   rain-only forecaster.
2. Gauge-scenario metrics partly reflect the asymmetric information design
   (events get a flood-stage reading, controls do not) — this is the intended
   operator workflow, but it is not a blind forecast test.
3. Internal test has only 5 flood days; validation only 9. The dataset starts
   2025-06 (older DMC PDFs are scanned images, no OCR).
4. Controls are assumed non-flood, not verified. 11.2% of them are flagged
   at threshold 0.57.
5. `distance_to_river_m` was 0 for gauge rows during dataset build (OSM
   unreachable) — the model ignores this feature; re-run
   `build_real_flood_dataset.py` + `train_real_flood.py` when OSM is up.
6. 39 stations only; more gauge history would strengthen the model.

## 9. Reproduce

```
python edge-gateway/prediction-models/build_real_flood_dataset.py   # build real dataset
python edge-gateway/prediction-models/train_real_flood.py           # train + select threshold on validation
python edge-gateway/prediction-models/validate_ditwah_case.py       # case study
python edge-gateway/prediction-models/validate_real_events.py       # 30-event external test
```

Outputs in `edge-gateway/prediction-models/real_validation_results/`.
Old synthetic model kept at `models/xgboost_model_improved.synthetic25k.pkl`.
