import sqlite3
from datetime import datetime

def get_db_connection():
    conn = sqlite3.connect('chat_app.db')
    conn.row_factory = sqlite3.Row
    return conn

def insert_message(conversation_id, sender_id, content):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
            INSERT INTO messages (conversation_id, sender_id, content, created_at)
            VALUES (?, ?, ?, ?)
        """
        cursor.execute(query, (conversation_id, sender_id, content, datetime.now()))
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()

def get_messages_by_conversation(conversation_id, limit=50):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT m.*, u.username FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at ASC LIMIT ?
    """
    cursor.execute(query, (conversation_id, limit))
    messages = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return messages