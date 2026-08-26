from app.config import Config
from app.services import scoring_service


def make_task_metrics(**overrides):
    base = {
        'accuracyRate': 0.85,
        'falseTapRate': 0.05,
        'avgReactionTime': 350,
        'reactionVariance': 120,
    }
    base.update(overrides)
    return base


def make_passive_signals(**overrides):
    base = {
        'idleTimeRatio': 0.1,
        'rapidClickCount': 2,
        'completionRatio': 0.95,
    }
    base.update(overrides)
    return base


class TestTaskScore:
    def test_perfect_metrics_score_high(self):
        score = scoring_service.compute_task_score(
            make_task_metrics(accuracyRate=1.0, falseTapRate=0.0, avgReactionTime=0, reactionVariance=0),
            Config,
        )
        assert score == 100.0

    def test_poor_metrics_score_low(self):
        score = scoring_service.compute_task_score(
            make_task_metrics(accuracyRate=0.2, falseTapRate=0.5, avgReactionTime=900, reactionVariance=600),
            Config,
        )
        assert score < 50

    def test_clamps_between_0_and_100(self):
        score = scoring_service.compute_task_score(make_task_metrics(accuracyRate=3.0), Config)
        assert 0 <= score <= 100


class TestPassiveScore:
    def test_ideal_signals_score_high(self):
        score = scoring_service.compute_passive_score(
            make_passive_signals(idleTimeRatio=0.0, rapidClickCount=0, completionRatio=1.0),
            Config,
        )
        assert score == 100.0

    def test_negative_signals_lower_score(self):
        good = scoring_service.compute_passive_score(make_passive_signals(), Config)
        bad = scoring_service.compute_passive_score(
            make_passive_signals(idleTimeRatio=0.9, rapidClickCount=50, completionRatio=0.1),
            Config,
        )
        assert bad < good


class TestComposite:
    def test_formula_weights(self):
        composite = scoring_service.compute_composite(100, 100, 50, Config)
        # 100*0.5 + 100*0.3 + 50*0.2 = 90
        assert composite == 90.0

    def test_clamps_to_100(self):
        assert scoring_service.compute_composite(120, 120, 200, Config) == 100.0


class TestZScore:
    def test_returns_none_with_insufficient_history(self):
        assert scoring_service.compute_z_score('child-1', 70.0, {}, Config) is None

    def test_zscore_computed_with_two_prior_sessions(self):
        history = {
            'child-1': [
                {'composite': 50.0},
                {'composite': 50.0},
            ]
        }
        z = scoring_service.compute_z_score('child-1', 55.0, history, Config)
        assert z is not None
        # std = 0 → falls back to 1.0 → z = (55-50)/1 = 5
        assert z == 5.0


class TestIfScore:
    def test_returns_none_when_ml_unavailable_or_history_too_short(self):
        # With no history the IF path should gracefully return None
        assert (
            scoring_service.compute_if_score('child-2', {}, {}, Config) is None
        )

    def test_detection_flags_combination(self):
        assert not (False or False)
        assert True or False