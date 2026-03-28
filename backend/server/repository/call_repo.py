from connection import get_connection

def get_call_by_id(call_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT conversation_id FROM calls WHERE id = %s
    """, (call_id,))

    row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        raise Exception("Call not found")

    return row[0]   # ✅ เหมือน create_call ที่ใช้ index

def create_call(conversation_id, started_by, call_type):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO calls (conversation_id, started_by, call_type, status)
        VALUES (%s,%s,%s,'ringing')
        RETURNING id
    """, (conversation_id, started_by, call_type))

    call_id = cur.fetchone()[0]

    conn.commit()
    cur.close()
    conn.close()

    return str(call_id)


def join_call(call_id, user_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO call_participants (call_id, user_id)
        VALUES (%s,%s)
        ON CONFLICT DO NOTHING
    """, (call_id, user_id))

    conn.commit()
    cur.close()
    conn.close()


def leave_call(call_id, user_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE call_participants
        SET left_at = NOW()
        WHERE call_id=%s AND user_id=%s
    """, (call_id, user_id))

    conn.commit()
    cur.close()
    conn.close()


def end_call(call_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE calls
        SET status='ended', ended_at=NOW()
        WHERE id=%s
        RETURNING conversation_id, call_type
    """, (call_id,))

    row = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    if row:
        return {
            "conversation_id": str(row[0]),
            "call_type": row[1]
        }
    return None
    
def get_call_participants(call_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT user_id
        FROM call_participants
        WHERE call_id = %s
    """, (call_id,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [str(row[0]) for row in rows]