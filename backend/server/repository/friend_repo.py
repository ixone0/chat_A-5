# repository/friend_repo.py

import uuid
from psycopg2.extras import RealDictCursor
from connection import get_connection


# ==========================================================
# 1️⃣  ดึงรายชื่อเพื่อน
# ==========================================================
def get_user_friends(user_id: str):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            sql = """
            SELECT 
                f.friend_id AS id,
                u.display_name,
                u.custom_id,
                u.last_seen
            FROM friendships f
            JOIN users u ON u.id = f.friend_id
            WHERE f.user_id = %s
            """
            cur.execute(sql, (user_id,))
            return cur.fetchall()
    finally:
        conn.close()


# ==========================================================
# 2️⃣  หา direct conversation ที่มีสมาชิกครบ 2 คน
# ==========================================================
def find_direct_conversation(user_a: str, user_b: str):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            sql = """
            SELECT c.id
            FROM conversations c
            JOIN conversation_members m1 
                ON m1.conversation_id = c.id AND m1.user_id = %s
            JOIN conversation_members m2 
                ON m2.conversation_id = c.id AND m2.user_id = %s
            WHERE c.type = 'direct'
            LIMIT 1
            """
            cur.execute(sql, (user_a, user_b))
            row = cur.fetchone()
            return str(row[0]) if row else None
    finally:
        conn.close()


# ==========================================================
# 3️⃣  สร้าง direct conversation ใหม่
# ==========================================================
def create_direct_conversation(user_a: str, user_b: str):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO conversations (id, type, owner_id)
                VALUES (%s, 'direct', %s)
                RETURNING id
            """, (str(uuid.uuid4()), user_a))

            conv_id = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO conversation_members (conversation_id, user_id)
                VALUES (%s, %s), (%s, %s)
            """, (conv_id, user_a, conv_id, user_b))

            conn.commit()
            return str(conv_id)
    except:
        conn.rollback()
        raise
    finally:
        conn.close()


# ==========================================================
# 4️⃣  หา หรือ สร้าง direct conversation
# ==========================================================
def get_or_create_direct_conversation(user_a: str, user_b: str):
    conv = find_direct_conversation(user_a, user_b)
    if conv:
        return conv
    return create_direct_conversation(user_a, user_b)


# ==========================================================
# 5️⃣  ดึง last message ของห้อง
# ==========================================================
def get_last_message(conversation_id: str):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, content, sender_id, created_at
                FROM messages
                WHERE conversation_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (conversation_id,))
            return cur.fetchone()
    finally:
        conn.close()


# ==========================================================
# 6️⃣  ดึงรายการ conversation ของ user
# ==========================================================
def get_user_conversations(user_id: str):
    """
    คืนค่า list ของ conversation
    สำหรับ direct จะคืน metadata ของอีกฝั่งด้วย
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:

            # ดึง conversation ทั้งหมดที่ user อยู่
            cur.execute("""
                SELECT c.id, c.type, c.title
                FROM conversations c
                JOIN conversation_members cm 
                    ON cm.conversation_id = c.id
                WHERE cm.user_id = %s
                ORDER BY c.created_at DESC
            """, (user_id,))

            conversations = cur.fetchall()

            results = []

            for conv in conversations:
                conv_id = conv["id"]

                # ดึง last message
                last_msg = get_last_message(conv_id)

                # ถ้าเป็น direct ให้ดึงข้อมูลอีกฝ่าย
                other_user = None
                if conv["type"] == "direct":
                    cur.execute("""
                        SELECT u.id, u.display_name, u.custom_id, u.last_seen
                        FROM conversation_members cm
                        JOIN users u ON u.id = cm.user_id
                        WHERE cm.conversation_id = %s
                        AND u.id != %s
                        LIMIT 1
                    """, (conv_id, user_id))

                    other_user = cur.fetchone()

                results.append({
                    "id": str(conv_id),
                    "type": conv["type"],
                    "title": conv["title"],
                    "other_user": other_user,
                    "last_message": last_msg
                })

            return results

    finally:
        conn.close()
