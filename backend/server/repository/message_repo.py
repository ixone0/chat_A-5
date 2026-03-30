# repository/message_repo.py
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

            # convert created_at (datetime) -> ISO8601 string with timezone
            if message and message.get("created_at"):
                # message["created_at"] is tz-aware; isoformat will include offset
                message["created_at"] = message["created_at"].isoformat()

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
            rows = cursor.fetchall()

            # convert created_at to ISO strings with timezone if present
            for r in rows:
                if r.get("created_at"):
                    # r["created_at"] may be a datetime with tzinfo
                    try:
                        r["created_at"] = r["created_at"].isoformat()
                    except Exception:
                        # if it's already a string, leave it
                        pass

            return rows

    finally:
        conn.close()


def insert_system_message(conversation_id, content):
    """Insert a system message (no sender) for group events like join/leave/kick"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            message_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO messages
                (id, conversation_id, sender_id, content, msg_type, created_at)
                VALUES (%s, %s, NULL, %s, %s, %s)
                RETURNING *
            """, (
                message_id,
                conversation_id,
                content,
                "system",
                datetime.now(timezone.utc)
            ))
            message = cursor.fetchone()
            conn.commit()
            if message and message.get("created_at"):
                message["created_at"] = message["created_at"].isoformat()
            return message
    except Exception as e:
        conn.rollback()
        print(f"Error insert_system_message: {e}")
        return None
    finally:
        conn.close()


def toggle_reaction_db(message_id, user_id, reaction):
    """Toggle a reaction on a message. Returns 'added' or 'removed'."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Check if reaction exists
            cursor.execute("""
                SELECT id FROM message_reactions
                WHERE message_id = %s AND user_id = %s AND reaction = %s
            """, (message_id, user_id, reaction))
            existing = cursor.fetchone()

            if existing:
                cursor.execute("DELETE FROM message_reactions WHERE id = %s", (existing[0],))
                conn.commit()
                return "removed"
            else:
                rid = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO message_reactions (id, message_id, user_id, reaction, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, (rid, message_id, user_id, reaction, datetime.now(timezone.utc)))
                conn.commit()
                return "added"
    except Exception as e:
        conn.rollback()
        print(f"Error toggle_reaction_db: {e}")
        return None
    finally:
        conn.close()

def get_reactions_for_messages(message_ids):
    """Get reactions grouped by message_id. Returns dict {msg_id: [{reaction, count, users}]}"""
    if not message_ids:
        return {}
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            placeholders = ','.join(['%s'] * len(message_ids))
            cursor.execute(f"""
                SELECT message_id, reaction, COUNT(*) as cnt,
                       ARRAY_AGG(user_id::text) as user_ids
                FROM message_reactions
                WHERE message_id IN ({placeholders})
                GROUP BY message_id, reaction
                ORDER BY cnt DESC
            """, message_ids)
            rows = cursor.fetchall()
            result = {}
            for row in rows:
                mid = str(row[0])
                if mid not in result:
                    result[mid] = []
                result[mid].append({
                    "reaction": row[1],
                    "count": row[2],
                    "users": row[3] or []
                })
            return result
    except Exception as e:
        print(f"Error get_reactions_for_messages: {e}")
        return {}
    finally:
        conn.close()
