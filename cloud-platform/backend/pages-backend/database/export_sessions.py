import sqlite3
import csv

conn = sqlite3.connect("pages.db")
cursor = conn.cursor()

cursor.execute("SELECT * FROM pages_behavioral_signals")
rows = cursor.fetchall()

headers = [desc[0] for desc in cursor.description]

with open("../../data/pages_behavioral_signals.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    writer.writerows(rows)

conn.close()
