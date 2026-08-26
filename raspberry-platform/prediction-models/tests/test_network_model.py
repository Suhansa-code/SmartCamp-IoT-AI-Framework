"""Tests for the network forecaster's data and decision logic.

Runs under pytest, or standalone (`python3 tests/test_network_model.py`) since
pytest is not currently a dependency of this directory.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'src'))

from data_generator import (HORIZON, QOS_RELIABILITY_TARGET, SEVERITY,  # noqa: E402
                            delivery_probability, generate_timeseries,
                            label_network_state, required_qos)
from feature_extraction import WINDOW, engineer_features             # noqa: E402
from network_predictor import decide_state, escalation_metrics       # noqa: E402


def test_label_thresholds():
    df = pd.DataFrame({
        'packet_loss': [0.0, 5.0, 15.0, 0.0, 0.0],
        'rtt_avg':     [10.0, 10.0, 10.0, 300.0, 10.0],
        'queue_depth': [0, 0, 0, 0, 0],
        'bridge_alive': [True, True, True, True, False],
    })
    assert list(label_network_state(df)) == [
        'STABLE', 'DEGRADED', 'CRITICAL', 'DEGRADED', 'CRITICAL'
    ]


def test_future_target_looks_forward_only():
    """The horizon label must cover t+1..t+H — never the current row.

    An off-by-one here leaks the present into the target and quietly recreates
    the exact 'accuracy 1.0' problem this model was rebuilt to avoid.
    """
    states = ['STABLE'] * 30
    states[15] = 'CRITICAL'
    df = pd.DataFrame({'network_state': states})

    sev = df['network_state'].map(SEVERITY)
    future = (sev.shift(-1).rolling(HORIZON, min_periods=1).max()
                 .shift(-(HORIZON - 1)))

    # Row 15 is itself CRITICAL, but nothing after it is, so its label is STABLE.
    assert future.iloc[15] == 0
    # The CRITICAL at 15 must show up for the H rows before it.
    assert future.iloc[14] == 2
    assert future.iloc[15 - HORIZON] == 2
    assert future.iloc[15 - HORIZON - 1] == 0


def test_rolling_features_use_only_past_samples():
    df = pd.DataFrame({
        'rtt_avg': [10.0] * 5 + [1000.0],
        'packet_loss': [0.0] * 6,
        'jitter': [0.0] * 6,
        'broker_rtt': [10.0] * 6,
        'queue_depth': [0] * 6,
        'bridge_alive': [True] * 6,
        'hour': [12.0] * 6,
        'day_of_week': [1.0] * 6,
    })
    f = engineer_features(df)

    # The spike at row 5 must not affect row 4's rolling mean.
    assert f[f'rtt_avg_mean_{WINDOW}'].iloc[4] == 10.0
    assert f[f'rtt_avg_mean_{WINDOW}'].iloc[5] > 10.0
    # Slope should register the jump as a positive trend.
    assert f[f'rtt_avg_slope_{WINDOW}'].iloc[5] > 0


def test_decide_state_escalates_on_doubt():
    classes = ['STABLE', 'DEGRADED', 'CRITICAL']
    proba = [0.70, 0.02, 0.28]      # argmax would say STABLE

    assert decide_state(proba, classes, 0.25, 0.25) == 'CRITICAL'
    # With a strict threshold the same row is not escalated.
    assert decide_state(proba, classes, 0.50, 0.50) == 'STABLE'


def test_decide_state_stable_when_confident():
    classes = ['STABLE', 'DEGRADED', 'CRITICAL']
    assert decide_state([0.95, 0.03, 0.02], classes, 0.25, 0.25) == 'STABLE'


def test_escalation_metrics_scores_persistence_at_zero():
    now = np.array(['STABLE', 'STABLE', 'DEGRADED'])
    future = np.array(['CRITICAL', 'STABLE', 'DEGRADED'])

    # Persistence predicts "same as now" and so catches no escalation at all.
    m = escalation_metrics(now, future, now.copy())
    assert m['escalations_in_test'] == 1
    assert m['escalation_recall'] == 0.0

    perfect = escalation_metrics(now, future, future.copy())
    assert perfect['escalation_recall'] == 1.0
    assert perfect['false_alarm_rate'] == 0.0


def test_generator_is_deterministic_and_ordered():
    rng_a = np.random.default_rng(42)
    rng_b = np.random.default_rng(42)
    a = generate_timeseries(500, rng_a)
    b = generate_timeseries(500, rng_b)

    assert a['rtt_avg'].equals(b['rtt_avg'])
    assert a['timestamp'].is_monotonic_increasing
    assert a['future_network_state'].iloc[:-HORIZON].notna().all()


def test_generator_produces_all_three_states():
    df = generate_timeseries(20000, np.random.default_rng(42))
    seen = set(df['network_state'].unique())
    assert seen == {'STABLE', 'DEGRADED', 'CRITICAL'}, seen


def test_required_qos_meets_each_priority_bar():
    """The chosen QoS must actually clear the reliability the priority needs."""
    healthy = {'bridge_alive': True, 'packet_loss': 0.5, 'rtt_avg': 40,
               'queue_depth': 3, 'drop_rate': 0.2}

    for priority, need in QOS_RELIABILITY_TARGET.items():
        qos = required_qos(healthy, priority)
        assert qos != -1, f'priority {priority} should be sendable on a healthy link'
        assert delivery_probability(healthy, qos) >= need


def test_required_qos_picks_the_cheapest_option_that_clears_the_bar():
    healthy = {'bridge_alive': True, 'packet_loss': 0.5, 'rtt_avg': 40,
               'queue_depth': 3, 'drop_rate': 0.2}
    # LOW needs 0.70 and QoS 0 delivers exactly that — no reason to pay more.
    assert required_qos(healthy, 0) == 0
    # CRITICAL needs 0.99, which only QoS 2 reaches.
    assert required_qos(healthy, 3) == 2


def test_required_qos_buffers_all_but_critical_on_a_dead_link():
    dead = {'bridge_alive': True, 'packet_loss': 30, 'rtt_avg': 2000,
            'queue_depth': 150, 'drop_rate': 20}
    assert required_qos(dead, 0) == -1
    assert required_qos(dead, 1) == -1
    assert required_qos(dead, 2) == -1
    # CRITICAL is time-sensitive: send best-effort and let the ack path buffer
    # it if delivery actually fails.
    assert required_qos(dead, 3) == 2


def test_optimal_qos_target_is_the_one_that_misleads():
    """Guards the reason required_qos exists at all.

    optimal_qos takes the lowest QoS that succeeded in a single draw, so it can
    label QoS 0 optimal on a link where QoS 0 delivers only 70% of the time.
    """
    healthy = {'bridge_alive': True, 'packet_loss': 0.5, 'rtt_avg': 40,
               'queue_depth': 3, 'drop_rate': 0.2}
    assert delivery_probability(healthy, 0) == 0.70
    # ...which is below what anything above LOW is allowed to accept.
    assert QOS_RELIABILITY_TARGET[1] > 0.70
    assert required_qos(healthy, 1) > 0


if __name__ == '__main__':
    tests = [v for k, v in sorted(globals().items()) if k.startswith('test_')]
    failed = 0
    for t in tests:
        try:
            t()
            print(f'  PASS  {t.__name__}')
        except Exception as e:
            failed += 1
            print(f'  FAIL  {t.__name__}: {type(e).__name__}: {e}')
    print(f'\n{len(tests) - failed} passed, {failed} failed')
    sys.exit(1 if failed else 0)
