import pytest
from app.config import Config
from app.services import if_service


class TestModelSerialization:
    def test_serialize_and_deserialize(self):
        try:
            import numpy as np
            from sklearn.ensemble import IsolationForest

            X = np.array([[60, 50, 70], [65, 55, 75], [70, 60, 80], [75, 65, 85],
                          [80, 70, 90], [85, 75, 95], [90, 80, 100], [95, 85, 100]])
            model = IsolationForest(contamination=0.1, random_state=42)
            model.fit(X)

            blob = if_service.serialize_model(model)
            restored = if_service.deserialize_model(blob)

            test_point = np.array([[80, 70, 90]])
            original_score = float(model.score_samples(test_point)[0])
            restored_score = float(restored.score_samples(test_point)[0])

            assert abs(original_score - restored_score) < 0.0001
        except ImportError:
            pytest.skip("numpy/sklearn not available")


class TestTrainIfModel:
    def test_returns_none_insufficient_history(self):
        history = {'child-1': [{'composite': 60, 'task': 50, 'passive': 70}]}
        result = if_service.train_if_model('child-1', history, Config)
        assert result is None

    def test_trains_with_minimum_sessions(self):
        try:
            import numpy as np
            history = {
                'child-1': [
                    {'composite': 60, 'task': 50, 'passive': 70},
                    {'composite': 65, 'task': 55, 'passive': 75},
                    {'composite': 70, 'task': 60, 'passive': 80},
                    {'composite': 75, 'task': 65, 'passive': 85},
                    {'composite': 80, 'task': 70, 'passive': 90},
                    {'composite': 85, 'task': 75, 'passive': 95},
                    {'composite': 90, 'task': 80, 'passive': 100},
                    {'composite': 95, 'task': 85, 'passive': 100},
                ]
            }
            model = if_service.train_if_model('child-1', history, Config)
            assert model is not None
            assert hasattr(model, 'score_samples')
        except ImportError:
            pytest.skip("numpy/sklearn not available")


class TestComputeIfScore:
    def test_returns_none_insufficient_history(self):
        history = {'child-1': [{'composite': 60, 'task': 50, 'passive': 70}]}
        result = if_service.compute_if_score(
            'child-1',
            {'accuracyRate': 0.8, 'falseTapRate': 0.1, 'avgReactionTime': 300, 'reactionVariance': 100},
            {'idleTimeRatio': 0.1, 'rapidClickCount': 2, 'timeToFirstMs': 450, 'completionRatio': 0.9},
            history, Config, None
        )
        assert result is None


class TestSaveIfInsight:
    def test_saves_insight(self):
        from app import create_app
        app = create_app()
        with app.app_context():
            engine = app.extensions['engine']
            try:
                if_service.save_if_insight(
                    engine, 'test-child', 'test-session', -0.05, False,
                    75.0, 80.0, 70.0,
                    {'composite': 37.5, 'task': 24.0, 'passive': 14.0}
                )
                insights = if_service.get_child_insights(engine, 'test-child')
                assert len(insights) == 1
                assert insights[0]['child_id'] == 'test-child'
                assert insights[0]['if_score'] == -0.05
                assert insights[0]['anomaly_flagged'] == 0
            finally:
                if_service.reset_child(engine, 'test-child')
                engine.dispose()

    def test_get_insights_empty(self):
        from app import create_app
        app = create_app()
        with app.app_context():
            engine = app.extensions['engine']
            try:
                insights = if_service.get_child_insights(engine, 'nonexistent-child')
                assert len(insights) == 0
            finally:
                engine.dispose()


class TestGetModelInfo:
    def test_returns_none_for_nonexistent(self):
        from app import create_app
        app = create_app()
        with app.app_context():
            engine = app.extensions['engine']
            try:
                result = if_service.get_model_info(engine, 'nonexistent-child')
                assert result is None
            finally:
                engine.dispose()
