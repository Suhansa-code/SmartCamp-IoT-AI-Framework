"""
Simulate 3 sessions for TEST-CHILD-000300 on Raspberry Pi SQLite.
Writes directly to pages.db so you can view in DB browser.
"""
import sqlite3
import os
import uuid
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'db', 'pages.db')

CHILD_ID = 'TEST-CHILD-000300'
RES_ID = 'R-300'
CAMP_ID = 'CAMP-001'
GRADE = 3
LANG = 'si'
BASELINE = 60.0

# 3 sessions with realistic behavioral data
SESSIONS = [
    {
        'session_num': 1,
        'accuracy_rate': 0.85, 'false_tap_rate': 0.08,
        'avg_reaction_time': 350, 'reaction_variance': 120,
        'idle_time_ratio': 0.10, 'rapid_click_count': 2,
        'time_to_first_ms': 450, 'completion_ratio': 0.95,
    },
    {
        'session_num': 2,
        'accuracy_rate': 0.88, 'false_tap_rate': 0.06,
        'avg_reaction_time': 320, 'reaction_variance': 100,
        'idle_time_ratio': 0.08, 'rapid_click_count': 1,
        'time_to_first_ms': 420, 'completion_ratio': 0.97,
    },
    {
        'session_num': 3,
        'accuracy_rate': 0.82, 'false_tap_rate': 0.10,
        'avg_reaction_time': 380, 'reaction_variance': 150,
        'idle_time_ratio': 0.12, 'rapid_click_count': 3,
        'time_to_first_ms': 480, 'completion_ratio': 0.90,
    },
]


def compute_task_score(s):
    return round(
        s['accuracy_rate'] * 100 * 0.40
        + (1 - s['false_tap_rate']) * 100 * 0.30
        + max(0, 1 - s['avg_reaction_time'] / 800) * 100 * 0.15
        + max(0, 1 - s['reaction_variance'] / 500) * 100 * 0.15
    , 2)


def compute_passive_score(s):
    return round(
        (1 - s['idle_time_ratio']) * 100 * 0.35
        + max(0, 1 - s['rapid_click_count'] / 10) * 100 * 0.25
        + s['completion_ratio'] * 100 * 0.40
    , 2)


def run():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('PRAGMA foreign_keys = ON')
    cur = conn.cursor()

    # Apply schema
    schema_path = os.path.join(os.path.dirname(__file__), 'db', 'pages-schema.sql')
    if os.path.exists(schema_path):
        with open(schema_path) as f:
            cur.executescript(f.read())
        print(f'[OK] Schema applied')

    # Insert child
    cur.execute('''
        INSERT OR REPLACE INTO pages_children
        (child_id, res_id, grade, camp_id, language, total_sessions, baseline_score, synced)
        VALUES (?, ?, ?, ?, ?, 0, ?, 0)
    ''', (CHILD_ID, RES_ID, GRADE, CAMP_ID, LANG, BASELINE))
    print(f'[OK] Child {CHILD_ID} created')

    now = datetime.utcnow()
    baseline = BASELINE

    for s in SESSIONS:
        sid = f'{CHILD_ID}-SES{s["session_num"]:03d}'
        sig_id = f'{sid}-SIG'
        dec_id = f'{sid}-DEC'
        ts = (now + timedelta(minutes=s['session_num'] * 2)).strftime('%Y-%m-%d %H:%M:%S')
        date = (now + timedelta(minutes=s['session_num'] * 2)).strftime('%Y-%m-%d')
        time_str = (now + timedelta(minutes=s['session_num'] * 2)).strftime('%H:%M:%S')
        created = (now + timedelta(minutes=s['session_num'] * 2)).isoformat()

        task_score = compute_task_score(s)
        passive_score = compute_passive_score(s)
        composite = round(task_score * 0.50 + passive_score * 0.30 + baseline * 0.20, 2)
        gate = 'PASS' if composite >= 55 else 'FAIL_FIRST'

        # Z-score (need at least 2 previous sessions)
        z_score = None
        if s['session_num'] >= 3:
            prev_composites = []
            for ps in SESSIONS[:s['session_num'] - 1]:
                ts_task = compute_task_score(ps)
                ts_passive = compute_passive_score(ps)
                prev_composites.append(ts_task * 0.50 + ts_passive * 0.30 + baseline * 0.20)
            if prev_composites:
                mean = sum(prev_composites) / len(prev_composites)
                var = sum((x - mean) ** 2 for x in prev_composites) / len(prev_composites)
                std = var ** 0.5 if var > 0 else 1.0
                z_score = round((composite - mean) / std, 4)

        # Session
        cur.execute('''
            INSERT OR REPLACE INTO pages_sessions
            (session_id, child_id, session_date, session_time, condition_label,
             composite_score, task_score, passive_score, baseline_score_used,
             gate_decision, session_complete, anomaly_flagged, z_score, if_score,
             alert_triggered, synced, created_at)
            VALUES (?, ?, ?, ?, 'A', ?, ?, ?, ?, ?, 1, 0, ?, NULL, 0, 0, ?)
        ''', (sid, CHILD_ID, date, time_str, composite, task_score, passive_score,
              baseline, gate, z_score, created))

        # Behavioral signals
        cur.execute('''
            INSERT OR REPLACE INTO pages_behavioral_signals
            (signal_id, session_id, child_id, accuracy_rate, false_tap_rate,
             avg_reaction_time, reaction_variance, idle_time_ratio,
             rapid_click_count, time_to_first_ms, completion_ratio, synced)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ''', (sig_id, sid, CHILD_ID, s['accuracy_rate'], s['false_tap_rate'],
              s['avg_reaction_time'], s['reaction_variance'], s['idle_time_ratio'],
              s['rapid_click_count'], s['time_to_first_ms'], s['completion_ratio']))

        # Gate decision
        cur.execute('''
            INSERT OR REPLACE INTO pages_gate_decisions
            (decision_id, session_id, child_id, attempt_number, composite_score,
             decision, decided_at, synced)
            VALUES (?, ?, ?, 1, ?, ?, ?, 0)
        ''', (dec_id, sid, CHILD_ID, composite, gate, created))

        # Update baseline
        baseline = round(baseline * 0.80 + composite * 0.20, 2)

        print(f'  Session {s["session_num"]}: composite={composite} task={task_score} passive={passive_score} z={z_score} gate={gate}')

    # Update child total_sessions
    cur.execute('UPDATE pages_children SET total_sessions = 3, baseline_score = ? WHERE child_id = ?',
                (baseline, CHILD_ID))

    conn.commit()

    # Verify
    print(f'\n--- Verification ---')
    rows = cur.execute('SELECT session_id, composite_score, task_score, passive_score, z_score, gate_decision FROM pages_sessions WHERE child_id = ? ORDER BY session_date', (CHILD_ID,)).fetchall()
    for r in rows:
        print(f'  {r[0]}: composite={r[1]} task={r[2]} passive={r[3]} z={r[4]} gate={r[5]}')

    rows = cur.execute('SELECT signal_id, session_id, accuracy_rate, false_tap_rate FROM pages_behavioral_signals WHERE child_id = ?', (CHILD_ID,)).fetchall()
    print(f'\n  Behavioral signals: {len(rows)} records')
    for r in rows:
        print(f'    {r[0]}: accuracy={r[2]} false_tap={r[3]}')

    rows = cur.execute('SELECT decision_id, session_id, composite_score, decision FROM pages_gate_decisions WHERE child_id = ?', (CHILD_ID,)).fetchall()
    print(f'\n  Gate decisions: {len(rows)} records')
    for r in rows:
        print(f'    {r[0]}: composite={r[2]} decision={r[3]}')

    child = cur.execute('SELECT child_id, total_sessions, baseline_score, synced FROM pages_children WHERE child_id = ?', (CHILD_ID,)).fetchone()
    print(f'\n  Child: {child[0]} total_sessions={child[1]} baseline={child[2]} synced={child[3]}')

    conn.close()
    print(f'\n[OK] Done. DB at: {DB_PATH}')


if __name__ == '__main__':
    run()
