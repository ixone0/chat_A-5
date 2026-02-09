#server/db.py
from connection import get_connection   # ถ้ามี connection แยก
# หรือ from db import get_connection ถ้าอยู่ไฟล์เดียว


def save_message(client_id, ip, content):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO messages (content, msg_type)
        VALUES (%s, 'text')
    """, (content,))

    conn.commit()
    cur.close()
    conn.close()


def get_messages(client_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT content, created_at
        FROM messages
        ORDER BY created_at DESC
        LIMIT 20
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return rows
