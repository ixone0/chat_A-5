#conversation_repo.py
import psycopg2
import os
import uuid
from connection import get_connection

def get_other_user(conversation_id, user_id):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT user_id
        FROM conversation_members
        WHERE conversation_id = %s AND user_id != %s
    """, (conversation_id, user_id))

    row = cur.fetchone()

    cur.close()
    conn.close()

    return row[0] if row else None

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )

def create_conversation_db(title, owner_id, chat_type="group"):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        conv_id = str(uuid.uuid4())
        
        # 1. สร้างห้อง
        query = """
            INSERT INTO conversations (id, type, title, owner_id, created_at) 
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        """
        cursor.execute(query, (conv_id, chat_type, title, owner_id))
        
        # 2. เพิ่มเจ้าของห้องเป็นสมาชิกคนแรก
        member_query = """
            INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) 
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
        """
        cursor.execute(member_query, (conv_id, owner_id, 'owner'))
        
        conn.commit()
        return conv_id
    except Exception as e:
        print(f"Error create_conversation_db: {e}")
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()

def get_members_by_conversation(conversation_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT user_id FROM conversation_members WHERE conversation_id = %s",
                (conversation_id,)
            )
            return [str(row[0]) for row in cursor.fetchall()]
    finally:
        conn.close()

def get_user_conversations_db(user_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT c.id, c.title, c.type, c.created_at
                FROM conversations c
                JOIN conversation_members cm
                  ON cm.conversation_id = c.id
                WHERE cm.user_id = %s
                ORDER BY c.created_at DESC
            """, (user_id,))

            rows = cursor.fetchall()

            return [
                {
                    "id": str(row[0]),
                    "title": row[1],
                    "type": row[2],
                    "created_at": row[3].isoformat() if row[3] else None
                }
                for row in rows
            ]
    finally:
        conn.close()

