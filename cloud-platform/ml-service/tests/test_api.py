class TestHealth:
    def test_health_returns_ok(self, client):
        res = client.get('/health')
        assert res.status_code == 200
        body = res.get_json()
        assert body['status'] == 'ok'
        assert body['service'] == 'PAGES ML Scoring Service'


class TestScore:
    def test_score_returns_contract(self, client):
        res = client.post('/score', json={
            'child_id': 'TEST-001',
            'session_id': 'SESS-001',
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
        })
        assert res.status_code == 200
        body = res.get_json()
        for key in ('compositeScore', 'taskScore', 'passiveScore', 'baselineScore',
                    'zScore', 'ifScore', 'anomalyFlagged', 'gateDecision'):
            assert key in body
        assert body['gateDecision'] in ('PASS', 'FAIL_FIRST')

    def test_score_rejects_invalid_body(self, client):
        assert client.post('/score', json={}).status_code == 400
        assert client.post('/score', data='not json', content_type='application/json').status_code == 400

    def test_score_requires_both_metric_groups(self, client):
        res = client.post('/score', json={
            'child_id': 'TEST-001',
            'session_id': 'SESS-002',
            'taskMetrics': {},
            'passiveSignals': {},
        })
        assert res.status_code == 400


class TestHistoryAndReset:
    def test_score_then_read_history(self, client):
        client.post('/score', json={
            'child_id': 'HIST-001',
            'session_id': 'HS-001',
            'taskMetrics': {'accuracyRate': 0.7, 'falseTapRate': 0.1, 'avgReactionTime': 300, 'reactionVariance': 100},
            'passiveSignals': {'idleTimeRatio': 0.1, 'rapidClickCount': 1, 'completionRatio': 0.9},
        })
        res = client.get('/history/HIST-001')
        assert res.status_code == 200
        body = res.get_json()
        assert body['child_id'] == 'HIST-001'
        assert body['session_count'] == 1

    def test_reset_child(self, client):
        client.post('/score', json={
            'child_id': 'RESET-001',
            'session_id': 'RS-001',
            'taskMetrics': {'accuracyRate': 0.7, 'falseTapRate': 0.1, 'avgReactionTime': 300, 'reactionVariance': 100},
            'passiveSignals': {'idleTimeRatio': 0.1, 'rapidClickCount': 1, 'completionRatio': 0.9},
        })
        res = client.post('/reset/RESET-001')
        assert res.status_code == 200
        assert res.get_json()['success'] is True

        history = client.get('/history/RESET-001').get_json()
        assert history['session_count'] == 0