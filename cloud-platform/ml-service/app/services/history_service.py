"""History service — in-memory session history + baselines, and DB persistence."""

from datetime import datetime, timezone
from sqlalchemy import delete, insert, select, update

from ..database import (
    pages_behavioral_signals,
    pages_children,
    pages_gate_decisions,
    pages_sessions,
)


def _now_text() -> str:
   return datetime.now(timezone.utc).isoformat()


def _local_date_time() -> tuple[str, str]:
    local_now = datetime.now(timezone.utc)
    return local_now.strftime('%Y-%m-%d'), local_now.strftime('%H:%M:%S')


class HistoryService:
    """Tracks per-child session history and rolling baselines in memory,
    and persists scoring results to the source-of-truth database."""

    def __init__(self, engine, config):
        self.engine = engine
        self.config = config
        self.session_history: dict = {}
        self.child_baselines: dict = {}

    # ── Loading ─────────────────────────────────────────────────────

    def load_from_db(self):
        """Load history and baselines from the database on startup."""
        self.session_history = {}
        self.child_baselines = {}

        try:
            with self.engine.connect() as conn:
                child_rows = conn.execute(
                    select(pages_children.c.child_id, pages_children.c.baseline_score, pages_children.c.total_sessions)
                ).mappings().all()

                for row in child_rows:
                    self.child_baselines[row['child_id']] = float(row['baseline_score'] or self.config.BASELINE_INIT)
                    self.session_history.setdefault(row['child_id'], [])

                session_rows = conn.execute(
                    select(
                        pages_sessions.c.child_id,
                        pages_sessions.c.session_id,
                        pages_sessions.c.composite_score,
                        pages_sessions.c.task_score,
                        pages_sessions.c.passive_score,
                        pages_sessions.c.created_at,
                    )
                    .where(pages_sessions.c.composite_score.is_not(None))
                    .order_by(pages_sessions.c.child_id, pages_sessions.c.created_at)
                ).mappings().all()

                for row in session_rows:
                    self.session_history.setdefault(row['child_id'], []).append({
                        'session_id': row['session_id'],
                        'composite': float(row['composite_score'] or 0),
                        'task': float(row['task_score'] or 0),
                        'passive': float(row['passive_score'] or 0),
                        'ts': row['created_at'] or _now_text(),
                    })
        except Exception as e:
            print(f'[INIT] Could not load history from database: {e}')
            self.session_history = {}
            self.child_baselines = {}

    def load_child_from_db(self, child_id: str):
        with self.engine.connect() as conn:
            child_row = conn.execute(
                select(pages_children.c.baseline_score, pages_children.c.total_sessions)
                .where(pages_children.c.child_id == child_id)
            ).mappings().first()

            session_rows = conn.execute(
                select(
                    pages_sessions.c.session_id,
                    pages_sessions.c.composite_score,
                    pages_sessions.c.task_score,
                    pages_sessions.c.passive_score,
                    pages_sessions.c.created_at,
                )
                .where(pages_sessions.c.child_id == child_id)
                .where(pages_sessions.c.composite_score.is_not(None))
                .order_by(pages_sessions.c.created_at)
            ).mappings().all()

        history = [
            {
                'session_id': row['session_id'],
                'composite': float(row['composite_score'] or 0),
                'task': float(row['task_score'] or 0),
                'passive': float(row['passive_score'] or 0),
                'ts': row['created_at'] or _now_text(),
            }
            for row in session_rows
        ]
        baseline = float((child_row or {}).get('baseline_score') or self.config.BASELINE_INIT)
        return history, baseline

    # ── Persistence ─────────────────────────────────────────────────

    def _upsert_child_state(self, conn, child_id: str, baseline_score: float, total_sessions: int):
        existing = conn.execute(
            select(pages_children.c.child_id).where(pages_children.c.child_id == child_id)
        ).first()

        child_values = {
            'res_id': 'UNKNOWN',
            'grade': 3,
            'camp_id': self.config.CAMP_ID,
            'zone_id': None,
            'language': 'si',
            'enrolled_at': _now_text(),
            'total_sessions': total_sessions,
            'baseline_score': baseline_score,
            'consecutive_low': 0,
            'sdq_band': 'unknown',
            'alert_status': 'none',
            'synced': 1,
        }

        if existing:
            conn.execute(
                update(pages_children)
                .where(pages_children.c.child_id == child_id)
                .values(baseline_score=baseline_score, total_sessions=total_sessions)
            )
        else:
            conn.execute(insert(pages_children).values(child_id=child_id, **child_values))

    def persist_score_result(
        self,
        child_id: str,
        session_id: str,
        task_metrics: dict,
        passive_signals: dict,
        composite_score: float,
        task_score: float,
        passive_score: float,
        z_score: float | None,
        if_score: float | None,
        anomaly_flagged: bool,
        gate_decision: str,
        baseline_before: float,
        baseline_after: float,
    ):
        session_count = len(self.session_history.get(child_id, [])) + 1
        session_date, session_time = _local_date_time()
        created_at = _now_text()
        signal_id = f'{session_id}-signals'
        decision_id = f'{session_id}-gate-1'

        signal_values = {
            'signal_id': signal_id,
            'session_id': session_id,
            'child_id': child_id,
            'accuracy_rate': float(task_metrics.get('accuracyRate', 0)),
            'false_tap_rate': float(task_metrics.get('falseTapRate', 0)),
            'avg_reaction_time': float(task_metrics.get('avgReactionTime', 0)),
            'reaction_variance': float(task_metrics.get('reactionVariance', 0)),
            'idle_time_ratio': float(passive_signals.get('idleTimeRatio', 0)),
            'rapid_click_count': int(passive_signals.get('rapidClickCount', 0) or 0),
            'time_to_first_ms': float(passive_signals.get('timeToFirstMs', 0)),
            'completion_ratio': float(passive_signals.get('completionRatio', 0)),
            'synced': 1,
        }

        session_values = {
            'session_id': session_id,
            'child_id': child_id,
            'content_session_id': None,
            'session_date': session_date,
            'session_time': session_time,
            'condition_label': 'A',
            'composite_score': composite_score,
            'task_score': task_score,
            'passive_score': passive_score,
            'baseline_score_used': baseline_before,
            'gate_decision': gate_decision,
            'second_gate_score': None,
            'cognitive_score': None,
            'session_complete': 0,
            'anomaly_flagged': 1 if anomaly_flagged else 0,
            'z_score': z_score,
            'if_score': if_score,
            'alert_triggered': 0,
            'synced': 1,
            'created_at': created_at,
        }

        decision_values = {
            'decision_id': decision_id,
            'session_id': session_id,
            'child_id': child_id,
            'attempt_number': 1,
            'composite_score': composite_score,
            'decision': gate_decision,
            'decided_at': created_at,
            'synced': 1,
        }

        with self.engine.begin() as conn:
            existing_session = conn.execute(
                select(pages_sessions.c.session_id)
                .where(pages_sessions.c.session_id == session_id)
            ).first()

            if existing_session:
                conn.execute(
                    update(pages_sessions)
                    .where(pages_sessions.c.session_id == session_id)
                    .values(**session_values)
                )
                existing_signal = conn.execute(
                    select(pages_behavioral_signals.c.signal_id)
                    .where(pages_behavioral_signals.c.signal_id == signal_id)
                ).first()

                if existing_signal:
                    conn.execute(
                        update(pages_behavioral_signals)
                        .where(pages_behavioral_signals.c.signal_id == signal_id)
                        .values(**signal_values)
                    )

                else:
                    conn.execute(
                        insert(pages_behavioral_signals).values(**signal_values)
                    )


            else:
                # First submission of this session.
                conn.execute(
                    insert(pages_sessions).values(**session_values)
                )

                conn.execute(
                    insert(pages_behavioral_signals).values(**signal_values)
                )

            # Gate decision must use the SAME live connection.
            existing_decision = conn.execute(
                select(pages_gate_decisions.c.decision_id)
                .where(pages_gate_decisions.c.decision_id == decision_id)
            ).first()

            if existing_decision:
                conn.execute(
                    update(pages_gate_decisions)
                    .where(pages_gate_decisions.c.decision_id == decision_id)
                    .values(**decision_values)
                )
            else:
                conn.execute(
                    insert(pages_gate_decisions).values(**decision_values)
                )

            self._upsert_child_state(
                conn,
                child_id,
                baseline_after,
                session_count,
            )

    # ── In-memory updates ──────────────────────────────────────────

    def update_history(
        self,
        child_id: str,
        session_id: str,
        composite: float,
        task: float,
        passive: float,
        ) -> float:
        """Add a session result to child history and update the rolling baseline."""

        if child_id not in self.session_history:
            self.session_history[child_id] = []

        existing = next(
            (
                session
                for session in self.session_history[child_id]
                if session.get('session_id') == session_id
            ),
            None,
        )

        if existing:
            existing.update({
                'composite': composite,
                'task': task,
                'passive': passive,
                'ts': datetime.now(timezone.utc).isoformat(),
            })
        else:
            self.session_history[child_id].append({
                'session_id': session_id,
                'composite': composite,
                'task': task,
                'passive': passive,
                'ts': datetime.now(timezone.utc).isoformat(),
            })
            # Keep last 50 sessions in memory
        self.session_history[child_id] = self.session_history[child_id][-50:]

        old_baseline = self.child_baselines.get(
            child_id,
            self.config.BASELINE_INIT
        )
        new_baseline = round(
            old_baseline * (1 - self.config.BASELINE_ALPHA)
            + composite * self.config.BASELINE_ALPHA,
            2,
        )

        self.child_baselines[child_id] = new_baseline
        return new_baseline

    def reset_child(self, child_id: str):
        """Delete all records for a child and reset in-memory state (testing/dev only)."""
        with self.engine.begin() as conn:
            conn.execute(delete(pages_behavioral_signals).where(pages_behavioral_signals.c.child_id == child_id))
            conn.execute(delete(pages_gate_decisions).where(pages_gate_decisions.c.child_id == child_id))
            conn.execute(delete(pages_sessions).where(pages_sessions.c.child_id == child_id))

            existing_child = conn.execute(
                select(pages_children.c.child_id).where(pages_children.c.child_id == child_id)
            ).first()

            if existing_child:
                conn.execute(
                    update(pages_children)
                    .where(pages_children.c.child_id == child_id)
                    .values(
                        baseline_score=self.config.BASELINE_INIT,
                        total_sessions=0,
                        alert_status='none',
                    )
                )

        self.session_history.pop(child_id, None)
        self.child_baselines.pop(child_id, None)