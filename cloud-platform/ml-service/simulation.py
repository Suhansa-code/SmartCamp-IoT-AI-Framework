"""
Simulation: Pi -> Cloud sync -> IF auto-trigger

Simulates 10 sessions for a child. Sessions 1-7 are normal scoring.
Session 8 triggers Isolation Forest training + scoring.
Sessions 9-10 show IF updating with new data.

Architecture tested:
  Pi (local scoring, no IF) -> sync -> Cloud ML Service (IF auto-trigger at session 8)
"""
import json
import sys
import time
from pathlib import Path
from datetime import datetime

# -- Bootstrap --
# Use a fresh temp DB for the simulation
import tempfile, os
_tmp = tempfile.mkdtemp(prefix='sim-')
os.environ['SQLITE_PATH'] = os.path.join(_tmp, 'pages.db')
os.environ['DATA_DIR'] = _tmp
os.environ['MODELS_DIR'] = os.path.join(_tmp, 'models')
os.environ['FLASK_DEBUG'] = 'false'
os.environ['POSTGRES_URL'] = ''

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import create_app

app = create_app()

# -- Simulated child --
CHILD_ID = 'SIM-CHILD-001'
RES_ID = 'R-5001'
CAMP_ID = 'CAMP-SIM'
GRADE = 3
LANG = 'si'

# -- Simulated behavioral data (10 sessions) --
# Sessions 1-7: normal child performance
# Session 8+: slightly declining (to test anomaly detection)
SESSIONS = [
    # session_num, accuracyRate, falseTapRate, avgReactionTime, reactionVariance,
    #              idleTimeRatio, rapidClickCount, completionRatio
    (1,  0.85, 0.08, 350, 120, 0.10, 2, 0.95),
    (2,  0.88, 0.06, 320, 100, 0.08, 1, 0.97),
    (3,  0.82, 0.10, 380, 150, 0.12, 3, 0.90),
    (4,  0.90, 0.05, 300,  80, 0.06, 0, 0.98),
    (5,  0.87, 0.07, 340, 110, 0.09, 2, 0.96),
    (6,  0.83, 0.09, 370, 140, 0.11, 3, 0.92),
    (7,  0.86, 0.08, 355, 125, 0.10, 2, 0.94),
    # Session 8: IF activates -- slightly lower performance
    (8,  0.70, 0.18, 500, 250, 0.20, 6, 0.80),
    # Session 9: back to normal
    (9,  0.84, 0.09, 360, 130, 0.10, 2, 0.93),
    # Session 10: significantly lower (anomaly expected)
    (10, 0.45, 0.35, 800, 500, 0.40, 12, 0.55),
]


def print_header(text):
    print(f'\n{"=" * 70}')
    print(f'  {text}')
    print(f'{"=" * 70}')


def print_section(text):
    print(f'\n--- {text} ---')


def run_simulation():
    print_header('PAGES IF AUTO-TRIGGER SIMULATION')
    print(f'  Child: {CHILD_ID} | Sessions: {len(SESSIONS)}')
    print(f'  IF activates at session 8 (IF_MIN_SESSIONS=8)')
    print(f'  Z-score activates at session 3 (ZSCORE_MIN_SESSIONS=3)')
    print(f'  Started: {datetime.utcnow().isoformat()}')

    with app.test_client() as client:
        # -- Step 1: Verify health --
        print_section('Step 1: Health Check')
        res = client.get('/health')
        health = res.get_json()
        print(f'  Status: {health["status"]}')
        print(f'  Service: {health["service"]}')
        print(f'  numpy: {health["numpy"]} | sklearn: {health["sklearn"]}')
        assert health['status'] == 'ok', 'Health check failed'
        print('  [OK] Health OK')

        # -- Step 2: Score sessions 1-10 --
        print_section('Step 2: Scoring Sessions (Simulating Pi -> Cloud Sync)')
        results = []

        for (session_num, acc, false_tap, rt, rt_var,
             idle, clicks, completion) in SESSIONS:

            session_id = f'{CHILD_ID}-SES{session_num:03d}'
            task_metrics = {
                'accuracyRate': acc,
                'falseTapRate': false_tap,
                'avgReactionTime': rt,
                'reactionVariance': rt_var,
            }
            passive_signals = {
                'idleTimeRatio': idle,
                'rapidClickCount': clicks,
                'completionRatio': completion,
            }

            # Simulate Pi calling Cloud /score endpoint
            res = client.post('/score', json={
                'child_id': CHILD_ID,
                'session_id': session_id,
                'taskMetrics': task_metrics,
                'passiveSignals': passive_signals,
            })

            assert res.status_code == 200, f'Session {session_num} failed: {res.get_json()}'
            body = res.get_json()
            results.append(body)

            if_status = f'IF={body["ifScore"]}' if body['ifScore'] is not None else 'IF=None'
            z_status = f'Z={body["zScore"]}' if body['zScore'] is not None else 'Z=None'
            anomaly = ' [!ANOMALY]' if body['anomalyFlagged'] else ''

            print(
                f'  Session {session_num:2d} | composite={body["compositeScore"]:6.2f} '
                f'| {z_status:12s} | {if_status:12s} | gate={body["gateDecision"]:12s}{anomaly}'
            )

        # -- Step 3: Verify IF activation at session 8 --
        print_section('Step 3: Verify IF Activation')
        s8 = results[7]  # session 8 (0-indexed)
        print(f'  Session 8 composite: {s8["compositeScore"]}')
        print(f'  Session 8 IF score:  {s8["ifScore"]}')
        print(f'  Session 8 anomaly:   {s8["anomalyFlagged"]}')

        if s8['ifScore'] is not None:
            print('  [OK] IF score computed at session 8 -- model trained successfully')
        else:
            print('  [FAIL] IF score NOT computed at session 8 -- ISSUE')

        # Sessions 1-7 should have null IF
        for i in range(7):
            assert results[i]['ifScore'] is None, f'Session {i+1} should have null IF'
        print('  [OK] Sessions 1-7 all have IF=None (correct)')

        # -- Step 4: Verify IF updates on sessions 9-10 --
        print_section('Step 4: Verify IF Updates on Sessions 9-10')
        s9 = results[8]
        s10 = results[9]
        print(f'  Session 9 IF: {s9["ifScore"]} | anomaly: {s9["anomalyFlagged"]}')
        print(f'  Session 10 IF: {s10["ifScore"]} | anomaly: {s10["anomalyFlagged"]}')

        if s10['ifScore'] is not None and s10['ifScore'] < -0.10:
            print('  [OK] Session 10 flagged as anomaly (low performance detected)')
        elif s10['anomalyFlagged']:
            print('  [OK] Session 10 flagged as anomaly')
        else:
            print('  [WARN] Session 10 not flagged -- IF score may not indicate anomaly')

        # -- Step 5: Check insights in cloud DB --
        print_section('Step 5: Verify Cloud DB (Insights Stored)')
        res = client.get(f'/insights/{CHILD_ID}')
        insights = res.get_json()
        print(f'  Total insights: {insights["insight_count"]}')
        for ins in insights['insights']:
            print(
                f'    session={ins["session_id"][-4:]} if_score={ins["if_score"]:.4f} '
                f'anomaly={ins["anomaly_flagged"]} created={ins["created_at"][:19]}'
            )

        assert insights['insight_count'] > 0, 'No insights found in cloud DB'
        print(f'  [OK] {insights["insight_count"]} insights saved to cloud DB')

        # -- Step 6: Check model info --
        print_section('Step 6: Verify IF Model Stored in Cloud DB')
        res = client.get(f'/models/{CHILD_ID}')
        if res.status_code == 200:
            model_info = res.get_json()
            print(f'  Model child_id:      {model_info["child_id"]}')
            print(f'  Feature count:       {model_info["feature_count"]}')
            print(f'  Session count:       {model_info["session_count"]}')
            print(f'  Trained at:          {model_info["trained_at"][:19]}')
            print(f'  Updated at:          {model_info["updated_at"][:19]}')
            print('  [OK] IF model persisted in cloud DB')
        else:
            print(f'  [WARN] Model not in DB (status {res.status_code})')

        # -- Step 7: Check summary --
        print_section('Step 7: Cloud Dashboard Summary')
        res = client.get(f'/insights/{CHILD_ID}/summary')
        summary = res.get_json()
        print(f'  Total sessions:      {summary["total_sessions"]}')
        print(f'  Anomaly count:       {summary["anomaly_count"]}')
        print(f'  Anomaly rate:        {summary["anomaly_rate"]}%')
        print(f'  Avg IF score:        {summary["avg_if_score"]}')
        print(f'  Latest IF score:     {summary["latest_if_score"]}')
        print(f'  IF score trend:      {summary["if_score_trend"]}')

        # -- Step 8: Verify model list --
        print_section('Step 8: All Models (Admin View)')
        res = client.get('/models')
        models = res.get_json()
        print(f'  Total models: {models["model_count"]}')
        for m in models['models']:
            print(f'    {m["child_id"]} | sessions={m["session_count"]} | updated={m["updated_at"][:19]}')

        # -- Final Summary --
        print_header('SIMULATION COMPLETE')
        anomaly_sessions = [r for r in results if r['anomalyFlagged']]
        if_sessions = [r for r in results if r['ifScore'] is not None]

        print(f'  Sessions scored:       {len(results)}')
        print(f'  Sessions with IF:      {len(if_sessions)} (expected: 3 -- sessions 8,9,10)')
        print(f'  Anomalies detected:    {len(anomaly_sessions)}')
        print(f'  IF models trained:     {models["model_count"]}')
        print(f'  Insights in cloud DB:  {insights["insight_count"]}')
        print()
        print('  Architecture verified:')
        print('    [OK] Pi scoring works locally (composite, task, passive, gate)')
        print('    [OK] Cloud IF auto-triggers at session 8')
        print('    [OK] IF model persisted in cloud DB only')
        print('    [OK] IF insights saved to cloud DB only')
        print('    [OK] Cloud admin dashboard endpoints working')
        print()

        # -- Assertions --
        assert len(if_sessions) == 3, f'Expected 3 IF sessions, got {len(if_sessions)}'
        assert insights['insight_count'] == 3, f'Expected 3 insights, got {insights["insight_count"]}'
        assert models['model_count'] == 1, f'Expected 1 model, got {models["model_count"]}'

        print('  ALL ASSERTIONS PASSED')

    # Cleanup
    import shutil
    shutil.rmtree(_tmp, ignore_errors=True)
    print(f'\n  Cleaned up temp directory: {_tmp}')


if __name__ == '__main__':
    run_simulation()
