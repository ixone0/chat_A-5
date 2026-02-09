#server/db.py
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )

def save_message(client_id, ip, content):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO messages (client_id, ip_address, content) VALUES (%s,%s,%s)",
        (client_id, ip, content)
    )

    conn.commit()
    cur.close()
    conn.close()


def get_messages(client_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT content, created_at FROM messages WHERE client_id=%s ORDER BY created_at",
        (client_id,)
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return rows
