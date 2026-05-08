"""
Manual entry prediction tool.
Run: python src/predict_manual.py
Enter Sri Lanka values when prompted, see model predictions vs actuals.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path

MODELS_DIR   = Path(__file__).parent.parent / 'models'
DATA_DIR     = Path(__file__).parent.parent / 'data' / 'processed'

TARGET_COLS  = ['food_kg_day', 'water_liters_day', 'shelter_units', 'medical_staff_needed']
TARGET_UNITS = {
    'food_kg_day':           'kg/day',
    'water_liters_day':      'liters/day',
    'shelter_units':         'units',
    'medical_staff_needed':  'staff',
}

# Sri Lanka actuals (2010-2022) hardcoded since country column was removed from dataset
LKA_ACTUALS = {
    2010: {'food_kg_day': 261154.8, 'water_liters_day': 8705160, 'shelter_units': 96724, 'medical_staff_needed': 1180.4},
    2011: {'food_kg_day': 170017.8, 'water_liters_day': 5667260, 'shelter_units': 62970, 'medical_staff_needed': 822.6},
    2012: {'food_kg_day':  83073.6, 'water_liters_day': 2769120, 'shelter_units': 30768, 'medical_staff_needed': 404.7},
    2013: {'food_kg_day':  50778.0, 'water_liters_day': 1692600, 'shelter_units': 18807, 'medical_staff_needed': 236.2},
    2014: {'food_kg_day':  19594.8, 'water_liters_day':  653160, 'shelter_units':  7257, 'medical_staff_needed':  90.0},
    2015: {'food_kg_day':  32657.4, 'water_liters_day': 1088580, 'shelter_units': 12095, 'medical_staff_needed': 150.0},
    2016: {'food_kg_day':  32010.0, 'water_liters_day': 1067000, 'shelter_units': 11856, 'medical_staff_needed': 148.6},
    2017: {'food_kg_day':  24707.4, 'water_liters_day':  823580, 'shelter_units':  9151, 'medical_staff_needed': 107.7},
    2018: {'food_kg_day':  24517.2, 'water_liters_day':  817240, 'shelter_units':  9080, 'medical_staff_needed': 106.9},
    2019: {'food_kg_day':  22125.0, 'water_liters_day':  737500, 'shelter_units':  8194, 'medical_staff_needed':  96.5},
    2020: {'food_kg_day':  15825.6, 'water_liters_day':  527520, 'shelter_units':  5861, 'medical_staff_needed':  69.0},
    2021: {'food_kg_day':  15857.4, 'water_liters_day':  528580, 'shelter_units':  5873, 'medical_staff_needed':  69.1},
    2022: {'food_kg_day':   5716.8, 'water_liters_day':  190560, 'shelter_units':  2117, 'medical_staff_needed':  24.9},
}

def load_lka_actuals():
    return LKA_ACTUALS

def get_float(prompt, default=None):
    while True:
        raw = input(prompt).strip()
        if raw == '' and default is not None:
            return default
        try:
            return float(raw)
        except ValueError:
            print('  Please enter a number.')

def build_features(inp):
    count_cols = ['refugees', 'asylum_seekers', 'idps', 'total_population', 'yearly_arrivals']
    log_map = {c: f'log_{c}' for c in count_cols}

    row = dict(inp)
    for col, log_col in log_map.items():
        row[log_col] = np.log1p(row.get(col, 0))

    row['years_elapsed']       = row['year'] - 2010
    row['vulnerability_index'] = row['children_ratio'] + row['elderly_ratio']

    feature_order = [
        'year',
        'refugees', 'asylum_seekers', 'returned_refugees',
        'idps', 'returned_idps', 'stateless', 'ooc',
        'total_population',
        'children_ratio', 'elderly_ratio', 'female_ratio',
        'yearly_arrivals', 'arrival_growth_rate',
        'log_refugees', 'log_asylum_seekers', 'log_idps',
        'log_total_population', 'log_yearly_arrivals',
        'years_elapsed', 'vulnerability_index',
    ]
    return pd.DataFrame([row])[feature_order]

def run_prediction(X):
    scaler  = joblib.load(MODELS_DIR / 'resource_scaler.pkl')
    X_sc    = scaler.transform(X)
    results = {}
    for target in TARGET_COLS:
        model_path = MODELS_DIR / f'resource_model_{target}.pkl'
        model      = joblib.load(model_path)
        # Ridge uses scaled input; tree models use raw
        import json
        meta = json.loads((MODELS_DIR / 'resource_models_meta.json').read_text())
        use_scaled = meta[target]['model_type'] == 'Ridge'
        pred = model.predict(X_sc if use_scaled else X)[0]
        results[target] = max(0, pred)
    return results

def main():
    print('\n=== Sri Lanka Camp Resource Predictor ===')
    print('Enter your known values. Press Enter to use 0 as default.\n')

    actuals = load_lka_actuals()

    year = int(get_float('Year (e.g. 2022): '))

    # Show actual values for that year if available so user can compare
    if year in actuals:
        print(f'\n  [Actual values for {year} are available — will compare after prediction]')

    print()
    inp = {
        'year':              year,
        'refugees':          get_float('Refugees: ', 0),
        'asylum_seekers':    get_float('Asylum seekers: ', 0),
        'returned_refugees': get_float('Returned refugees: ', 0),
        'idps':              get_float('IDPs (internally displaced): ', 0),
        'returned_idps':     get_float('Returned IDPs: ', 0),
        'stateless':         get_float('Stateless persons: ', 0),
        'ooc':               get_float('Others of concern (ooc): ', 0),
        'total_population':  get_float('Total displaced population: ', 0),
        'children_ratio':    get_float('Children ratio (0-1, e.g. 0.33): ', 0.33),
        'elderly_ratio':     get_float('Elderly ratio  (0-1, e.g. 0.03): ', 0.03),
        'female_ratio':      get_float('Female ratio   (0-1, e.g. 0.45): ', 0.45),
        'yearly_arrivals':   get_float('Yearly arrivals (new asylum applications): ', 0),
        'arrival_growth_rate': get_float('Arrival growth rate (e.g. 0.1 = 10% growth): ', 0),
    }

    X       = build_features(inp)
    preds   = run_prediction(X)
    actual  = actuals.get(year, {})

    print(f'\n{"─"*60}')
    print(f'  Results for year {year}')
    print(f'{"─"*60}')
    print(f'  {"Target":<26} {"Predicted":>14}  {"Actual":>14}  {"Error %":>8}')
    print(f'  {"─"*22}  {"─"*14}  {"─"*14}  {"─"*8}')

    for target in TARGET_COLS:
        pred   = preds[target]
        unit   = TARGET_UNITS[target]
        act    = actual.get(target)

        if act is not None:
            act    = float(act)
            err_pct = abs(pred - act) / act * 100 if act != 0 else float('nan')
            act_str = f'{act:>14,.1f}'
            err_str = f'{err_pct:>7.1f}%'
        else:
            act_str = f'{"N/A":>14}'
            err_str = f'{"N/A":>8}'

        print(f'  {target:<26} {pred:>14,.1f}  {act_str}  {err_str}')

    print(f'{"─"*60}')
    print(f'  Units: food=kg/day, water=liters/day, shelter=units, medical=staff\n')

if __name__ == '__main__':
    main()
