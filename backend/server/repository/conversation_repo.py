import sqlite3

def get_db_connection():
    conn = sqlite3.connect('chat_app.db')
    conn.row_factory = sqlite3.Row
    return conn

def get_conversation_members(conversation_id):
    """ดึงรายชื่อ user_id ทั้งหมดที่อยู่ในห้องนี้ เพื่อใช้ทำ Broadcast"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT user_id FROM conversation_members WHERE conversation_id = ?"
    cursor.execute(query, (conversation_id,))
    members = [row['user_id'] for row in cursor.fetchall()]
    
    conn.close()
    return members

def create_conversation(name, member_ids):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. สร้างห้อง
        cursor.execute("INSERT INTO conversations (name) VALUES (?)", (name,))
        conv_id = cursor.lastrowid
        
        # 2. เพิ่มสมาชิกเข้าห้อง
        for uid in member_ids:
            cursor.execute(
                "INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)",
                (conv_id, uid)
            )
        
        conn.commit()
        return conv_id
    except Exception as e:
        conn.rollback()
        return None
    finally:
        conn.close()