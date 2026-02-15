#message_repo.py
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import uuid


def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )


def insert_message(conversation_id, sender_id, content):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:

            cursor.execute("""
                SELECT 1 FROM conversation_members
                WHERE conversation_id = %s AND user_id = %s
            """, (conversation_id, sender_id))

            if not cursor.fetchone():
                raise Exception("User not in conversation")

            message_id = str(uuid.uuid4())

            cursor.execute("""
                INSERT INTO messages
                (id, conversation_id, sender_id, content, msg_type, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                message_id,
                conversation_id,
                sender_id,
                content,
                "text",
                datetime.now(timezone.utc)
            ))

            message = cursor.fetchone()
            conn.commit()

            return message

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()



def get_messages_by_conversation(conversation_id, limit=50):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:

            query = """
                SELECT m.*, u.username
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.conversation_id = %s
                ORDER BY m.created_at ASC
                LIMIT %s
            """

            cursor.execute(query, (conversation_id, limit))
            return cursor.fetchall()

    finally:
        conn.close()