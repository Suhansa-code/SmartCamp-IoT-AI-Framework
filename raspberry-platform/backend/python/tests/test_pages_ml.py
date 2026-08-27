import pytest
import json
import os
import tempfile
import shutil
from pathlib import Path

os.environ['DATA_DIR'] = '/tmp/test_pages_data'
os.environ['MODELS_DIR'] = '/tmp/test_pages_models'
os.environ['FLASK_DEBUG'] = 'true'
os.environ['ZSCORE_MIN_SESSIONS'] = '3'
os.environ['IF_MIN_SESSIONS'] = '8'
os.environ['GATE_THRESHOLD'] = '55'
os.environ['ZSCORE_THRESHOLD'] = '-2.0'
os.environ['IF_SCORE_THRESHOLD'] = '-0.10'
os.environ['BASELINE_INIT'] = '60.0'
os.environ['BASELINE_ALPHA'] = '0.20'

from app import app as flask_app


@pytest.fixture
def client():
    test_data_dir = Path('/tmp/test_pages_data')
    test_models_dir = Path('/tmp/test_pages_models')
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir)
    if test_models_dir.exists():
        shutil.rmtree(test_models_dir)
    test_data_dir.mkdir(parents=True)
    test_models_dir.mkdir(parents=True)

    flask_app.config['TESTING'] = True
    with flask_app.test_client() as client:
        yield client

    if test_data_dir.exists():
        shutil.rmtree(test_data_dir)
    if test_models_dir.exists():
        shutil.rmtree(test_models_dir)


def valid_payload(child_id='TEST-001', session_id='SESS-001'):
    return {
        'child_id': child_id,
        'session_id': session_id,
        'taskMetrics': {
            'accuracyRate': 0.8,
            'falseTapRate': 0.1,
            'avgReactionTime': 300,
            'reactionVariance': 100,
        },
        'passiveSignals': {
            'idleTimeRatio': 0.1,
            'rapidClickCount': 2,
            'completionRatio': 0.9,
        },
    }


class TestHealth:
    def test_health_returns_ok(self, client):
        res = client.get('/health')
        assert res.status_code == 200
        body = res.get_json()
        assert body['status'] == 'ok'
        assert body['service'] == 'PAGES ML Scoring Service'
        assert 'numpy' in body
        assert 'sklearn' in body


class TestScoreContract:
    def test_score_returns_full_contract(self, client):
        res = client.post('/score', json=valid_payload())
        assert res.status_code == 200
        body = res.get_json()
        required_keys = ('compositeScore', 'taskScore', 'passiveScore', 'baselineScore',
                         'zScore', 'ifScore', 'anomalyFlagged', 'gateDecision')
        for key in required_keys:
            assert key in body, f"Missing key: {key}"
        assert body['gateDecision'] in ('PASS', 'FAIL_FIRST')
        assert isinstance(body['anomalyFlagged'], bool)
        assert isinstance(body['compositeScore'], (int, float))
        assert 0 <= body['compositeScore'] <= 100

    def test_score_rejects_empty_body(self, client):
        res = client.post('/score', json={})
        assert res.status_code == 400

    def test_score_rejects_missing_metrics(self, client):
        res = client.post('/score', json={
            'child_id': 'TEST-001',
            'session_id': 'SESS-001',
            'taskMetrics': {},
            'passiveSignals': {},
        })
        assert res.status_code == 400


class TestZScoreActivation:
    def test_zscore_always_null_in_flask(self, client):
        child_id = 'ZSCORE-TEST-1'
        for i in range(5):
            res = client.post('/score', json=valid_payload(child_id, f'{child_id}-S{i}'))
            assert res.status_code == 200
            body = res.get_json()
            assert body['zScore'] is None, f"Z-score should be None in Flask (computed in Node.js) at session {i+1}"


class TestIsolationForestActivation:
    def test_if_score_null_before_session_8(self, client):
        child_id = 'IF-TEST-1'
        for i in range(7):
            res = client.post('/score', json=valid_payload(child_id, f'{child_id}-S{i}'))
            assert res.status_code == 200
            body = res.get_json()
            assert body['ifScore'] is None, f"IF score should be None at session {i+1}"

    def test_if_model_created_at_session_8(self, client):
        child_id = 'IF-TEST-2'
        for i in range(8):
            res = client.post('/score', json=valid_payload(child_id, f'{child_id}-S{i}'))
            assert res.status_code == 200
            body = res.get_json()
        assert body['ifScore'] is not None, "IF score should be computed at session 8"
        assert isinstance(body['ifScore'], (int, float))

    def test_if_model_persists_and_updates(self, client):
        child_id = 'IF-PERSIST'
        for i in range(9):
            res = client.post('/score', json=valid_payload(child_id, f'{child_id}-S{i}'))
            assert res.status_code == 200
            body = res.get_json()
            if i >= 7:
                assert body['ifScore'] is not None

    def test_if_anomaly_detection(self, client):
        child_id = 'IF-ANOMALY'
        for i in range(8):
            client.post('/score', json=valid_payload(child_id, f'{child_id}-S{i}'))
        res = client.post('/score', json={
            'child_id': child_id,
            'session_id': f'{child_id}-S8',
            'taskMetrics': {'accuracyRate': 0.05, 'falseTapRate': 0.95, 'avgReactionTime': 5000, 'reactionVariance': 5000},
            'passiveSignals': {'idleTimeRatio': 0.95, 'rapidClickCount': 50, 'completionRatio': 0.05},
        })
        body = res.get_json()
        if body['ifScore'] is not None and body['ifScore'] < -0.10:
            assert body['anomalyFlagged'] is True


class TestBaselineAndGating:
    def test_baseline_updates_each_session(self, client):
        child_id = 'BASELINE-TEST'
        baselines = []
        for i in range(5):
            res = client.post('/score', json=valid_payload(child_id, f'{child_id}-S{i}'))
            body = res.get_json()
            baselines.append(body['baselineScore'])
        for i in range(1, len(baselines)):
            assert baselines[i] != baselines[i-1], "Baseline should update each session"

    def test_gate_decision_pass_above_threshold(self, client):
        res = client.post('/score', json={
            'child_id': 'GATE-PASS',
            'session_id': 'GP-001',
            'taskMetrics': {'accuracyRate': 0.95, 'falseTapRate': 0.02, 'avgReactionTime': 200, 'reactionVariance': 50},
            'passiveSignals': {'idleTimeRatio': 0.05, 'rapidClickCount': 0, 'completionRatio': 1.0},
        })
        body = res.get_json()
        assert body['gateDecision'] == 'PASS'

    def test_gate_decision_fail_below_threshold(self, client):
        res = client.post('/score', json={
            'child_id': 'GATE-FAIL',
            'session_id': 'GF-001',
            'taskMetrics': {'accuracyRate': 0.2, 'falseTapRate': 0.5, 'avgReactionTime': 1500, 'reactionVariance': 1000},
            'passiveSignals': {'idleTimeRatio': 0.5, 'rapidClickCount': 10, 'completionRatio': 0.5},
        })
        body = res.get_json()
        assert body['gateDecision'] == 'FAIL_FIRST'


class TestHistoryAndReset:
    def test_history_tracks_sessions(self, client):
        child_id = 'HIST-TEST'
        for i in range(3):
            client.post('/score', json=valid_payload(child_id, f'{child_id}-S{i}'))
        res = client.get(f'/history/{child_id}')
        assert res.status_code == 200
        body = res.get_json()
        assert body['child_id'] == child_id
        assert body['session_count'] == 3
        assert len(body['sessions']) == 3

    def test_history_shows_activation_flags(self, client):
        child_id = 'HIST-FLAGS'
        for i in range(2):
            client.post('/score', json=valid_payload(child_id, f'{child_id}-S{i}'))
        res = client.get(f'/history/{child_id}')
        body = res.get_json()
        assert body['z_score_active'] is False  # Z-score now in Node.js
        assert body['if_score_active'] is False

        for i in range(2, 7):
            client.post('/score', json=valid_payload(child_id, f'{child_id}-S{i}'))
        res = client.get(f'/history/{child_id}')
        body = res.get_json()
        assert body['z_score_active'] is False  # Z-score now in Node.js
        assert body['if_score_active'] is False

        client.post('/score', json=valid_payload(child_id, f'{child_id}-S7'))
        res = client.get(f'/history/{child_id}')
        body = res.get_json()
        assert body['z_score_active'] is False  # Z-score now in Node.js
        assert body['if_score_active'] is True

    def test_reset_clears_history(self, client):
        child_id = 'RESET-TEST'
        for i in range(3):
            client.post('/score', json=valid_payload(child_id, f'{child_id}-S{i}'))
        res = client.post(f'/reset/{child_id}')
        assert res.status_code == 200
        assert res.get_json()['success'] is True
        res = client.get(f'/history/{child_id}')
        body = res.get_json()
        assert body['session_count'] == 0


class TestScoreComputationAccuracy:
    def test_task_score_formula(self, client):
        res = client.post('/score', json={
            'child_id': 'FORMULA-TEST',
            'session_id': 'FT-001',
            'taskMetrics': {'accuracyRate': 1.0, 'falseTapRate': 0.0, 'avgReactionTime': 0, 'reactionVariance': 0},
            'passiveSignals': {'idleTimeRatio': 0.0, 'rapidClickCount': 0, 'completionRatio': 1.0},
        })
        body = res.get_json()
        assert body['taskScore'] == 100.0

    def test_passive_score_formula(self, client):
        res = client.post('/score', json={
            'child_id': 'FORMULA-TEST-2',
            'session_id': 'FT-002',
            'taskMetrics': {'accuracyRate': 0.5, 'falseTapRate': 0.5, 'avgReactionTime': 800, 'reactionVariance': 500},
            'passiveSignals': {'idleTimeRatio': 0.0, 'rapidClickCount': 0, 'completionRatio': 1.0},
        })
        body = res.get_json()
        assert body['passiveScore'] == 100.0

    def test_composite_formula_matches_spec(self, client):
        child_id = 'COMPOSITE-TEST'
        res1 = client.post('/score', json=valid_payload(child_id, f'{child_id}-S0'))
        body1 = res1.get_json()
        old_baseline = body1['baselineScore']
        res2 = client.post('/score', json=valid_payload(child_id, f'{child_id}-S1'))
        body2 = res2.get_json()
        expected = round(
            body2['taskScore'] * 0.50 +
            body2['passiveScore'] * 0.30 +
            old_baseline * 0.20, 2
        )
        assert abs(body2['compositeScore'] - expected) < 0.01


class TestConcurrentChildren:
    def test_multiple_children_independent(self, client):
        for cid in ['CHILD-A', 'CHILD-B', 'CHILD-C']:
            for i in range(3):
                client.post('/score', json=valid_payload(cid, f'{cid}-S{i}'))
        for cid in ['CHILD-A', 'CHILD-B', 'CHILD-C']:
            res = client.get(f'/history/{cid}')
            body = res.get_json()
            assert body['session_count'] == 3
            assert body['child_id'] == cid


if __name__ == '__main__':
    pytest.main([__file__, '-v'])