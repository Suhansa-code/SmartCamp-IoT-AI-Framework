import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'db', 'pages.db')
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute("DELETE FROM pages_behavioral_signals WHERE child_id = 'TEST-CHILD-000300'")
cur.execute("DELETE FROM pages_gate_decisions WHERE child_id = 'TEST-CHILD-000300'")
cur.execute("DELETE FROM pages_sessions WHERE child_id = 'TEST-CHILD-000300'")
cur.execute("DELETE FROM pages_children WHERE child_id = 'TEST-CHILD-000300'")
conn.commit()
print('Cleaned up old TEST-CHILD-000300 data')
conn.close()
